import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma } from '../generated/prisma/client.js';
import type { MotifSortie, TypeOperation } from '../generated/prisma/enums.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { QualiteService } from '../qualite/qualite.service.js';
import { type ContenuCuve, controlerArrivee, controlerAssemblage, joursEntre, verifierMouvements } from './regles.js';

type Db = PrismaService | Prisma.TransactionClient;

export interface NouveauMouvement {
  lotId: number;
  stockageId: number;
  quantiteKg: number;
}

/**
 * Stock en cuves : calculé à partir des mouvements, jamais saisi directement.
 * Toute opération passe par `enregistrer`, qui verrouille les cuves concernées et vérifie les règles.
 */
@Injectable()
export class StockService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly qualite: QualiteService,
  ) {}

  /** Contenu des cuves : lot et quantité (seulement les quantités non nulles). */
  async contenu(db: Db, stockageIds?: number[]): Promise<Map<number, ContenuCuve[]>> {
    const groupes = await db.mouvement.groupBy({
      by: ['stockageId', 'lotId'],
      where: stockageIds ? { stockageId: { in: stockageIds } } : {},
      _sum: { quantiteKg: true },
    });
    const contenu = new Map<number, ContenuCuve[]>();
    for (const g of groupes) {
      const quantiteKg = g._sum.quantiteKg ?? 0;
      if (quantiteKg === 0) continue;
      contenu.set(g.stockageId, [...(contenu.get(g.stockageId) ?? []), { lotId: g.lotId, quantiteKg }]);
    }
    return contenu;
  }

  /** Stock total de chaque lot, toutes cuves confondues. */
  async stockParLot(db: Db, lotIds?: number[]): Promise<Map<number, number>> {
    const groupes = await db.mouvement.groupBy({
      by: ['lotId'],
      where: lotIds ? { lotId: { in: lotIds } } : {},
      _sum: { quantiteKg: true },
    });
    return new Map(groupes.map((g) => [g.lotId, g._sum.quantiteKg ?? 0]));
  }

  /** Enregistre une opération et ses mouvements après avoir vérifié capacité, stock et unicité du lot par cuve. */
  async enregistrer(
    tx: Prisma.TransactionClient,
    operation: {
      type: TypeOperation;
      date: Date;
      userId: number;
      motif?: MotifSortie;
      clientId?: number;
      notes?: string;
    },
    mouvements: NouveauMouvement[],
  ) {
    const stockageIds = [...new Set(mouvements.map((m) => m.stockageId))].sort((a, b) => a - b);
    // Verrou sur les cuves jusqu'à la fin de la transaction : deux opérations simultanées sur une même cuve
    // sont traitées l'une après l'autre.
    await tx.$queryRaw`SELECT id FROM \`Stockage\` WHERE id IN (${Prisma.join(stockageIds)}) FOR UPDATE`;
    const cuves = await tx.stockage.findMany({ where: { id: { in: stockageIds } } });
    if (cuves.length !== stockageIds.length) throw new NotFoundException('Cuve ou citerne introuvable');

    const contenu = await this.contenu(tx, stockageIds);
    const lotIds = new Set([...mouvements.map((m) => m.lotId), ...[...contenu.values()].flat().map((c) => c.lotId)]);
    const lots = await tx.lot.findMany({ where: { id: { in: [...lotIds] } }, select: { id: true, code: true } });
    const codes = new Map(lots.map((l) => [l.id, l.code]));

    const erreurs = verifierMouvements(cuves, contenu, mouvements, (id) => codes.get(id) ?? `#${id}`);
    if (erreurs.length) throw new BadRequestException(erreurs);

    return tx.operation.create({
      data: { ...operation, mouvements: { create: mouvements } },
      include: { mouvements: true },
    });
  }

  /** Vue des cuves : lot contenu, quantité, taux de remplissage, ancienneté. */
  async etatCuves() {
    const [cuves, contenu] = await Promise.all([
      this.prisma.stockage.findMany({ where: { actif: true }, orderBy: { code: 'asc' } }),
      this.contenu(this.prisma),
    ]);
    const lotIds = [...contenu.values()].flat().map((c) => c.lotId);
    const lots = await this.prisma.lot.findMany({
      where: { id: { in: lotIds } },
      include: { variete: { select: { nom: true } }, huilerie: { select: { nom: true } } },
    });
    const parId = new Map(lots.map((l) => [l.id, l]));
    const maintenant = new Date();

    return cuves.map((cuve) => {
      const lot = (contenu.get(cuve.id) ?? [])[0];
      const infos = lot && parId.get(lot.lotId);
      const quantiteKg = lot?.quantiteKg ?? 0;
      return {
        ...cuve,
        quantiteKg,
        tauxRemplissage: Math.round((quantiteKg / cuve.capaciteKg) * 1000) / 10,
        lot: infos
          ? {
              id: infos.id,
              code: infos.code,
              variete: infos.variete?.nom ?? null,
              huilerie: infos.huilerie?.nom ?? null,
              dateReception: infos.dateReception,
              joursEnStock: joursEntre(infos.dateReception, maintenant),
            }
          : null,
      };
    });
  }

  /**
   * Alertes du stock : lots stockés depuis trop longtemps, lots sans analyse, réserves à la réception (transport),
   * incompatibilités de lots (assemblages de qualités, variétés ou campagnes différentes) et lots conditionnés
   * qui ne respectent plus le cahier des charges du client pour lequel ils ont été préparés.
   */
  async alertes() {
    const dureeMax = Number(this.config.get('ALERTE_DUREE_STOCKAGE_JOURS', 180));
    const stock = await this.stockParLot(this.prisma);
    const enStock = [...stock].filter(([, q]) => q > 0).map(([id]) => id);
    const derniereAnalyse = { orderBy: [{ dateAnalyse: 'desc' as const }, { id: 'desc' as const }], take: 1, select: { acidite: true } };
    const [lots, produitsFinis] = await Promise.all([
      this.prisma.lot.findMany({
        where: { id: { in: enStock } },
        orderBy: { dateReception: 'asc' },
        include: {
          transport: true,
          origines: {
            include: {
              parent: { select: { code: true, campagne: true, variete: { select: { nom: true } }, analyses: derniereAnalyse } },
            },
          },
        },
      }),
      this.prisma.mouvementProduitFini.groupBy({ by: ['lotConditionneId'], _sum: { quantiteUnites: true } }),
    ]);
    const maintenant = new Date();

    const alertes: { niveau: 'ALERTE' | 'INFO'; type: string; lotId: number; lotCode: string; message: string; lien?: string }[] = [];
    for (const lot of lots) {
      const jours = joursEntre(lot.dateReception, maintenant);
      if (jours > dureeMax) {
        alertes.push({
          niveau: 'ALERTE',
          type: 'DUREE_STOCKAGE',
          lotId: lot.id,
          lotCode: lot.code,
          message: `Lot ${lot.code} en stock depuis ${jours} jours (seuil : ${dureeMax} jours).`,
        });
      }
      if (lot.statutQualite === 'NON_ANALYSE') {
        alertes.push({
          niveau: 'INFO',
          type: 'SANS_ANALYSE',
          lotId: lot.id,
          lotCode: lot.code,
          message: `Lot ${lot.code} en stock sans analyse de laboratoire.`,
        });
      }
      if (lot.transport) {
        const { reserves } = controlerArrivee({
          quantiteRecueKg: lot.quantiteInitialeKg,
          quantiteAnnonceeKg: lot.transport.quantiteAnnonceeKg,
          temperatureC: lot.transport.temperatureC === null ? null : Number(lot.transport.temperatureC),
          citerneConforme: lot.transport.citerneConforme,
          plombsIntacts: lot.transport.plombsIntacts,
        });
        if (reserves.length) {
          alertes.push({
            niveau: 'INFO',
            type: 'RESERVE_RECEPTION',
            lotId: lot.id,
            lotCode: lot.code,
            message: `Lot ${lot.code} reçu avec réserves (bon ${lot.transport.numeroBon}) : ${reserves.join(' ')}`,
          });
        }
      }
      if (lot.origine === 'ASSEMBLAGE' && lot.origines.length > 1) {
        const controle = controlerAssemblage(
          lot.origines.map((o) => ({
            code: o.parent.code,
            quantiteKg: o.quantiteKg,
            variete: o.parent.variete?.nom ?? null,
            campagne: o.parent.campagne,
            acidite: o.parent.analyses[0]?.acidite == null ? null : Number(o.parent.analyses[0].acidite),
          })),
        );
        // Les lots d'origine sans analyse sont déjà signalés par les alertes qualité.
        const incompatibilites = controle.avertissements.filter((a) => !a.includes('sans analyse'));
        if (incompatibilites.length) {
          alertes.push({
            niveau: controle.risqueQualite ? 'ALERTE' : 'INFO',
            type: 'INCOMPATIBILITE_LOTS',
            lotId: lot.id,
            lotCode: lot.code,
            message: `Assemblage ${lot.code} : ${incompatibilites.join(' ')}`,
          });
        }
      }
    }

    // Lots conditionnés pour un client, encore en stock : ils doivent respecter son cahier des charges.
    const enStockPf = produitsFinis.filter((g) => (g._sum.quantiteUnites ?? 0) > 0).map((g) => g.lotConditionneId);
    const pourClient = await this.prisma.lotConditionne.findMany({
      where: { id: { in: enStockPf }, clientId: { not: null } },
      select: { id: true, code: true, lotVracId: true, clientId: true, client: { select: { raisonSociale: true } } },
    });
    for (const lc of pourClient) {
      const controle = await this.qualite.controleExpedition(lc.lotVracId, lc.clientId!);
      if (!controle.autorise) {
        alertes.push({
          niveau: 'ALERTE',
          type: 'INCOMPATIBILITE_CLIENT',
          lotId: lc.lotVracId,
          lotCode: lc.code,
          lien: `/conditionnement/${lc.id}`,
          message: `Lot conditionné ${lc.code} préparé pour ${lc.client!.raisonSociale} : ${controle.blocages.join(' ')}`,
        });
      }
    }
    return { dureeMaxJours: dureeMax, alertes };
  }
}

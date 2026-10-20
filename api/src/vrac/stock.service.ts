import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma } from '../generated/prisma/client.js';
import type { MotifSortie, TypeOperation } from '../generated/prisma/enums.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { type ContenuCuve, joursEntre, verifierMouvements } from './regles.js';

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

  /** Alertes simples : lots stockés depuis trop longtemps, lots en stock sans analyse. */
  async alertes() {
    const dureeMax = Number(this.config.get('ALERTE_DUREE_STOCKAGE_JOURS', 180));
    const stock = await this.stockParLot(this.prisma);
    const enStock = [...stock].filter(([, q]) => q > 0).map(([id]) => id);
    const lots = await this.prisma.lot.findMany({
      where: { id: { in: enStock } },
      orderBy: { dateReception: 'asc' },
    });
    const maintenant = new Date();

    const alertes: { niveau: 'ALERTE' | 'INFO'; type: string; lotId: number; lotCode: string; message: string }[] = [];
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
    }
    return { dureeMaxJours: dureeMax, alertes };
  }
}

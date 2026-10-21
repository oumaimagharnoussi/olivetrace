import { createHash } from 'node:crypto';
import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AuditService } from '../audit/audit.service.js';
import { prochainCode } from '../conditionnement/codes.js';
import { DENSITE_HUILE_KG_L } from '../conditionnement/regles.js';
import { Prisma } from '../generated/prisma/client.js';
import type { ParametreAnalyse, StatutExpedition } from '../generated/prisma/enums.js';
import { PasseportService, nomPays } from '../passeport/passeport.service.js';
import { PdfService } from '../pdf/pdf.service.js';
import { societe } from '../pdf/societe.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { LIBELLES_CATEGORIE, QualiteService } from '../qualite/qualite.service.js';
import { PARAMETRES } from '../qualite/regles.js';
import { type DossierExport, type LigneDossier, pageHtml } from './documents.js';
import { CreateExpeditionDto, LigneExpeditionDto, StatutExpeditionDto, UpdateExpeditionDto } from './export.dto.js';
import { CODES_NC, DOCUMENTS, PAYS_UE, type TypeDocument, colisage, controlerLignes, controlerTransition } from './regles.js';

type Db = PrismaService | Prisma.TransactionClient;

const RESULTATS: Record<string, string> = {
  NON_ANALYSE: 'Non analysé',
  CONFORME: 'Conforme',
  INCOMPLET: 'Analyse partielle',
  NON_CONFORME: 'Non conforme',
};

const expeditionInclude = {
  client: { select: { id: true, code: true, raisonSociale: true, pays: true, ville: true, adresse: true, numeroTva: true } },
  user: { select: { id: true, nom: true } },
  lignes: {
    orderBy: { id: 'asc' },
    include: {
      lotConditionne: {
        include: {
          format: true,
          operation: { select: { date: true } },
          passeport: { select: { nomProduit: true } },
          lotVrac: { select: { id: true, code: true, categorieVisee: true, statutQualite: true, bloque: true } },
        },
      },
    },
  },
} satisfies Prisma.ExpeditionInclude;

/**
 * Expéditions export de produits finis et documents PDF du dossier export.
 * Le stock ne sort qu'au départ ; le contrôle qualité est refait à chaque étape.
 */
@Injectable()
export class ExpeditionsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly qualite: QualiteService,
    private readonly passeports: PasseportService,
    private readonly pdf: PdfService,
    private readonly audit: AuditService,
    private readonly config: ConfigService,
  ) {}

  private densite() {
    return Number(this.config.get('DENSITE_HUILE_KG_L', DENSITE_HUILE_KG_L));
  }

  /** Lots conditionnés demandés, avec leur stock en unités. */
  private async stockLots(db: Db, ids: number[]) {
    const [lots, groupes] = await Promise.all([
      db.lotConditionne.findMany({ where: { id: { in: ids } }, select: { id: true, code: true, lotVracId: true } }),
      db.mouvementProduitFini.groupBy({ by: ['lotConditionneId'], where: { lotConditionneId: { in: ids } }, _sum: { quantiteUnites: true } }),
    ]);
    const stock = new Map(groupes.map((g) => [g.lotConditionneId, g._sum.quantiteUnites ?? 0]));
    return new Map(lots.map((l) => [l.id, { ...l, stockUnites: stock.get(l.id) ?? 0 }]));
  }

  /**
   * Contrôle qualité de chaque lot pour le client (étapes 3 et 4) : lot vrac d'origine bloqué depuis,
   * hors cahier des charges du client… Avec `strict`, le lot doit en plus être analysé et conforme.
   */
  private async controlerQualite(lots: { code: string; lotVracId: number }[], clientId: number, strict = false) {
    const blocages: string[] = [];
    const avertissements: string[] = [];
    for (const lot of lots) {
      const controle = await this.qualite.controleExpedition(lot.lotVracId, clientId, strict);
      blocages.push(...controle.blocages.map((m) => `Lot ${lot.code} : ${m}`));
      avertissements.push(...controle.avertissements.map((m) => `Lot ${lot.code} : ${m}`));
    }
    return { autorise: blocages.length === 0, blocages, avertissements };
  }

  /** Lignes contrôlées (stock disponible, qualité) : erreurs en refus, avertissements renvoyés. */
  private async controlerLignesEtQualite(lignes: LigneExpeditionDto[], clientId: number) {
    const lots = await this.stockLots(this.prisma, lignes.map((l) => l.lotConditionneId));
    const erreurs = controlerLignes(lignes, lots);
    if (erreurs.length) throw new BadRequestException(erreurs);
    const controle = await this.controlerQualite([...lots.values()], clientId);
    if (!controle.autorise) throw new BadRequestException(controle.blocages);
    return controle.avertissements;
  }

  private async client(clientId: number) {
    const client = await this.prisma.client.findUnique({ where: { id: clientId } });
    if (!client) throw new NotFoundException('Client introuvable');
    if (!client.actif) throw new BadRequestException(`Le client ${client.raisonSociale} est désactivé.`);
    return client;
  }

  findAll(filtres: { statut?: StatutExpedition; lotConditionneId?: number; lotVracId?: number; pays?: string; clientId?: number } = {}) {
    const { statut, lotConditionneId, lotVracId, pays, clientId } = filtres;
    return this.prisma.expedition.findMany({
      where: {
        statut,
        clientId,
        paysDestination: pays?.toUpperCase(),
        ...(lotConditionneId || lotVracId ? { lignes: { some: { lotConditionneId, lotConditionne: lotVracId ? { lotVracId } : undefined } } } : {}),
      },
      orderBy: [{ datePrevue: 'desc' }, { id: 'desc' }],
      take: 500,
      include: expeditionInclude,
    });
  }

  /**
   * Suivi des expéditions par destination : pour chaque pays, nombre d'expéditions par statut, volume parti
   * et lots expédiés, avec la date du dernier départ.
   */
  async suivi() {
    const expeditions = await this.prisma.expedition.findMany({
      where: { statut: { not: 'ANNULEE' } },
      select: {
        paysDestination: true,
        statut: true,
        dateDepart: true,
        lignes: { select: { quantiteUnites: true, lotConditionne: { select: { id: true, code: true, format: { select: { contenanceMl: true } } } } } },
      },
    });
    const parPays = new Map<
      string,
      { pays: string; nomPays: string | null; ue: boolean; preparees: number; expediees: number; livrees: number; litres: number; lots: Map<number, string>; dernierDepart: Date | null }
    >();
    for (const e of expeditions) {
      const ligne = parPays.get(e.paysDestination) ?? {
        pays: e.paysDestination,
        nomPays: nomPays(e.paysDestination),
        ue: PAYS_UE.has(e.paysDestination),
        preparees: 0,
        expediees: 0,
        livrees: 0,
        litres: 0,
        lots: new Map<number, string>(),
        dernierDepart: null,
      };
      if (e.statut === 'PREPAREE') ligne.preparees++;
      else if (e.statut === 'EXPEDIEE') ligne.expediees++;
      else ligne.livrees++;
      if (e.statut !== 'PREPAREE') {
        for (const l of e.lignes) {
          ligne.litres += (l.quantiteUnites * l.lotConditionne.format.contenanceMl) / 1000;
          ligne.lots.set(l.lotConditionne.id, l.lotConditionne.code);
        }
        if (e.dateDepart && (!ligne.dernierDepart || e.dateDepart > ligne.dernierDepart)) ligne.dernierDepart = e.dateDepart;
      }
      parPays.set(e.paysDestination, ligne);
    }
    return [...parPays.values()]
      .map(({ lots, ...l }) => ({ ...l, litres: Math.round(l.litres * 10) / 10, lots: [...lots].map(([id, code]) => ({ id, code })) }))
      .sort((a, b) => b.litres - a.litres || a.pays.localeCompare(b.pays));
  }

  /** Fiche d'une expédition, avec le contrôle qualité actuel des lots et les totaux de colisage. */
  async findOne(id: number) {
    const expedition = await this.prisma.expedition.findUnique({ where: { id }, include: expeditionInclude });
    if (!expedition) throw new NotFoundException('Expédition introuvable');
    const lots = expedition.lignes.map((l) => ({ code: l.lotConditionne.code, lotVracId: l.lotConditionne.lotVracId }));
    const [controle, conformite, stock] = await Promise.all([
      this.controlerQualite(lots, expedition.clientId),
      this.controlerQualite(lots, expedition.clientId, true),
      this.stockLots(this.prisma, expedition.lignes.map((l) => l.lotConditionneId)),
    ]);
    const lignes = expedition.lignes.map((l) => ({
      ...l,
      stockUnites: stock.get(l.lotConditionneId)?.stockUnites ?? 0,
      ...colisage(l.quantiteUnites, l.lotConditionne.format.contenanceMl, this.densite(), l.lotConditionne.format.unitesParCarton),
    }));
    return {
      ...expedition,
      lignes,
      ue: PAYS_UE.has(expedition.paysDestination),
      totaux: totaux(lignes),
      controle,
      // La déclaration de conformité demande des lots analysés et conformes : sinon elle n'est pas éditée.
      conformiteEditable: conformite.autorise,
      blocagesConformite: conformite.blocages,
    };
  }

  async creer({ lignes, ...dto }: CreateExpeditionDto, userId: number) {
    const client = await this.client(dto.clientId);
    const avertissements = await this.controlerLignesEtQualite(lignes, client.id);
    const datePrevue = new Date(dto.datePrevue);
    const expedition = await this.prisma.$transaction(async (tx) =>
      tx.expedition.create({
        data: {
          ...dto,
          paysDestination: dto.paysDestination ?? client.pays,
          adresseLivraison: dto.adresseLivraison ?? ([client.adresse, client.ville].filter(Boolean).join(', ') || undefined),
          datePrevue,
          code: await prochainCode(tx, 'expedition', 'E', datePrevue),
          userId,
          lignes: { create: lignes.map((l) => ({ lotConditionneId: l.lotConditionneId, quantiteUnites: l.quantiteUnites })) },
        },
      }),
    );
    await this.audit.log({ userId, action: 'CREATE', entite: 'Expedition', entiteId: expedition.id, donnees: { code: expedition.code, ...dto, lignes } });
    return { expedition: await this.findOne(expedition.id), avertissements };
  }

  async modifier(id: number, { lignes, ...dto }: UpdateExpeditionDto, userId: number) {
    const expedition = await this.prisma.expedition.findUnique({ where: { id }, include: { lignes: true } });
    if (!expedition) throw new NotFoundException('Expédition introuvable');
    if (expedition.statut === 'ANNULEE') throw new BadRequestException('Une expédition annulée ne se modifie plus.');
    const changeContenu = lignes !== undefined || (dto.clientId !== undefined && dto.clientId !== expedition.clientId);
    if (changeContenu && expedition.statut !== 'PREPAREE') {
      throw new BadRequestException('Le client et les lots ne se modifient plus après le départ.');
    }
    let avertissements: string[] = [];
    if (changeContenu) {
      const clientId = (await this.client(dto.clientId ?? expedition.clientId)).id;
      avertissements = await this.controlerLignesEtQualite(lignes ?? expedition.lignes, clientId);
    }
    await this.prisma.$transaction(async (tx) => {
      await tx.expedition.update({ where: { id }, data: { ...dto, datePrevue: dto.datePrevue ? new Date(dto.datePrevue) : undefined } });
      if (lignes) {
        await tx.expeditionLigne.deleteMany({ where: { expeditionId: id } });
        await tx.expeditionLigne.createMany({ data: lignes.map((l) => ({ expeditionId: id, lotConditionneId: l.lotConditionneId, quantiteUnites: l.quantiteUnites })) });
      }
    });
    await this.audit.log({ userId, action: 'UPDATE', entite: 'Expedition', entiteId: id, donnees: { ...dto, lignes } });
    return { expedition: await this.findOne(id), avertissements };
  }

  /**
   * Départ, livraison ou annulation. Au départ, le contrôle qualité et le stock sont vérifiés à nouveau,
   * puis chaque ligne devient une sortie du stock de produits finis (référence : le code de l'expédition).
   */
  async changerStatut(id: number, { statut, date: dateSaisie }: StatutExpeditionDto, userId: number) {
    const expedition = await this.prisma.expedition.findUnique({
      where: { id },
      include: { lignes: { include: { lotConditionne: { select: { code: true, lotVracId: true } } } } },
    });
    if (!expedition) throw new NotFoundException('Expédition introuvable');
    const erreur = controlerTransition(expedition.statut, statut);
    if (erreur) throw new BadRequestException(erreur);
    if (expedition.statut === statut) return this.findOne(id);
    const date = dateSaisie ? new Date(dateSaisie) : new Date();

    if (statut === 'EXPEDIEE') {
      const controle = await this.controlerQualite(expedition.lignes.map((l) => l.lotConditionne), expedition.clientId);
      if (!controle.autorise) throw new BadRequestException(controle.blocages);
      await this.prisma.$transaction(async (tx) => {
        const ids = expedition.lignes.map((l) => l.lotConditionneId);
        // Verrou sur les lots : une autre sortie simultanée attend la fin de ce départ.
        await tx.$queryRaw`SELECT id FROM \`LotConditionne\` WHERE id IN (${Prisma.join(ids)}) FOR UPDATE`;
        const erreurs = controlerLignes(expedition.lignes, await this.stockLots(tx, ids));
        if (erreurs.length) throw new BadRequestException(erreurs);
        for (const ligne of expedition.lignes) {
          const mouvement = await tx.mouvementProduitFini.create({
            data: {
              lotConditionneId: ligne.lotConditionneId,
              type: 'EXPEDITION',
              date,
              quantiteUnites: -ligne.quantiteUnites,
              clientId: expedition.clientId,
              reference: expedition.code,
              userId,
              notes: `Expédition ${expedition.code}`,
            },
          });
          await tx.expeditionLigne.update({ where: { id: ligne.id }, data: { mouvementId: mouvement.id } });
        }
        await tx.expedition.update({ where: { id }, data: { statut, dateDepart: date } });
      });
    } else {
      await this.prisma.expedition.update({ where: { id }, data: { statut, ...(statut === 'LIVREE' ? { dateLivraison: date } : {}) } });
    }
    await this.audit.log({ userId, action: 'UPDATE', entite: 'Expedition', entiteId: id, donnees: { statut, date } });
    return this.findOne(id);
  }

  // --- Dossier export (PDF) --------------------------------------------------------------------

  /** Données du dossier export, lues dans la base : analyses, origine (huileries, variétés), colisage. */
  async dossier(id: number): Promise<DossierExport> {
    const expedition = await this.prisma.expedition.findUnique({ where: { id }, include: expeditionInclude });
    if (!expedition) throw new NotFoundException('Expédition introuvable');
    const criteres = await this.qualite.criteresParCategorie(this.prisma);

    const lignes: LigneDossier[] = [];
    for (const l of expedition.lignes) {
      const lot = l.lotConditionne;
      const categorie = lot.lotVrac.categorieVisee;
      const [{ lot: lotQualite, reference, analyse }, ascendance] = await Promise.all([
        this.qualite.sourceQualite(this.prisma, lot.lotVracId),
        this.passeports.ascendance(lot.lotVracId),
      ]);
      const limites = new Map((criteres[categorie] ?? []).map((c) => [c.parametre, c]));
      lignes.push({
        code: lot.code,
        produit: lot.passeport?.nomProduit || `Huile d'olive ${LIBELLES_CATEGORIE[categorie]}`,
        categorie: LIBELLES_CATEGORIE[categorie],
        codeNc: CODES_NC[categorie],
        format: lot.format,
        quantiteUnites: l.quantiteUnites,
        ...colisage(l.quantiteUnites, lot.format.contenanceMl, this.densite(), lot.format.unitesParCarton),
        dateConditionnement: lot.operation.date,
        dluo: lot.dluo,
        lotVrac: lot.lotVrac.code,
        origine: { huileries: ascendance.huileries, varietes: ascendance.varietes, campagnes: ascendance.campagnes, assemblage: ascendance.assemblage },
        filtrations: ascendance.filtrations,
        analyse: analyse
          ? {
              date: analyse.dateAnalyse,
              laboratoire: analyse.laboratoire,
              reference: analyse.reference,
              categorie: analyse.categorie ? LIBELLES_CATEGORIE[analyse.categorie] : null,
              resultat: RESULTATS[lotQualite.statutQualite],
              lotAnalyse: reference.code,
              valeurs: (Object.keys(PARAMETRES) as ParametreAnalyse[])
                .filter((p) => analyse[PARAMETRES[p].champ] != null)
                .map((p) => ({
                  libelle: PARAMETRES[p].libelle,
                  unite: PARAMETRES[p].unite,
                  valeur: Number(analyse[PARAMETRES[p].champ]),
                  min: limites.get(p)?.min ?? null,
                  max: limites.get(p)?.max ?? null,
                })),
            }
          : null,
        conforme: lotQualite.statutQualite === 'CONFORME' && !lotQualite.bloque,
      });
    }

    return {
      exportateur: societe(this.config),
      expedition: {
        ...expedition,
        paysDestinationNom: nomPays(expedition.paysDestination) ?? expedition.paysDestination,
        ue: PAYS_UE.has(expedition.paysDestination),
      },
      client: { ...expedition.client, pays: nomPays(expedition.client.pays) ?? expedition.client.pays },
      lignes,
      totaux: totaux(lignes),
      genereLe: new Date(),
    };
  }

  /**
   * PDF d'un document du dossier export, ou du dossier complet.
   * La déclaration de conformité (et donc le dossier complet) est refusée si un lot n'est pas analysé,
   * conforme et non bloqué, ou s'il sort du cahier des charges du client.
   */
  async document(id: number, type: TypeDocument | 'dossier', userId: number) {
    const expedition = await this.prisma.expedition.findUnique({
      where: { id },
      include: { lignes: { include: { lotConditionne: { select: { code: true, lotVracId: true } } } } },
    });
    if (!expedition) throw new NotFoundException('Expédition introuvable');
    if (expedition.statut === 'ANNULEE') throw new BadRequestException('Expédition annulée : pas de document export.');
    const documents = type === 'dossier' ? (Object.keys(DOCUMENTS) as TypeDocument[]) : [type];
    if (documents.includes('conformite')) {
      const controle = await this.controlerQualite(expedition.lignes.map((l) => l.lotConditionne), expedition.clientId, true);
      if (!controle.autorise) {
        throw new BadRequestException(['Déclaration de conformité impossible :', ...controle.blocages]);
      }
    }
    const dossier = await this.dossier(id);
    const titre = type === 'dossier' ? 'Dossier export' : DOCUMENTS[type];
    const pdf = await this.pdf.genererPdf(pageHtml(dossier, documents), `${dossier.exportateur.raisonSociale.replace(/[<>&"]/g, '')} · ${titre} · ${expedition.code}`);
    // L'empreinte de chaque PDF remis est gardée dans le journal d'audit (preuve du document envoyé).
    const sha256 = createHash('sha256').update(pdf).digest('hex');
    await this.audit.log({ userId, action: 'CREATE', entite: 'DocumentExport', entiteId: expedition.id, donnees: { code: expedition.code, type, sha256 } });
    const nom = type === 'dossier' ? 'dossier-export' : type === 'origine' ? 'certificat-origine' : type;
    return { pdf, nomFichier: `${nom}-${expedition.code}.pdf` };
  }
}

function totaux(lignes: { quantiteUnites: number; litres: number; poidsNetKg: number; cartons: number | null }[]) {
  return {
    unites: lignes.reduce((s, l) => s + l.quantiteUnites, 0),
    litres: lignes.reduce((s, l) => s + l.litres, 0),
    poidsNetKg: Math.round(lignes.reduce((s, l) => s + l.poidsNetKg, 0) * 10) / 10,
    cartons: lignes.every((l) => l.cartons !== null) ? lignes.reduce((s, l) => s + (l.cartons ?? 0), 0) : null,
  };
}

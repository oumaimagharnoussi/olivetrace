import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AuditService } from '../audit/audit.service.js';
import { Prisma } from '../generated/prisma/client.js';
import type { CategorieHuile, StatutNonConformite } from '../generated/prisma/enums.js';
import { PrismaService } from '../prisma/prisma.service.js';
import {
  type ChampAnalyse,
  type Critere,
  PARAMETRES,
  type ValeursAnalyse,
  controlerExpedition,
  decrireEcart,
  evaluerPourLot,
} from './regles.js';
import {
  AnalyseDto,
  CreateNonConformiteDto,
  CreateSpecificationDto,
  CritereDto,
  UpdateNonConformiteDto,
  UpdateSpecificationDto,
} from './qualite.dto.js';

type Db = PrismaService | Prisma.TransactionClient;

const CHAMPS = Object.values(PARAMETRES).map((p) => p.champ);

/** Valeurs mesurées d'une analyse enregistrée (les décimaux Prisma deviennent des nombres). */
export function valeursAnalyse(analyse: Partial<Record<ChampAnalyse, Prisma.Decimal | number | null>>): ValeursAnalyse {
  return Object.fromEntries(CHAMPS.map((c) => [c, analyse[c] == null ? null : Number(analyse[c])]));
}

function versCriteres(criteres: { parametre: Critere['parametre']; min: Prisma.Decimal | null; max: Prisma.Decimal | null }[]): Critere[] {
  return criteres.map((c) => ({ parametre: c.parametre, min: c.min == null ? null : Number(c.min), max: c.max == null ? null : Number(c.max) }));
}

const nonConformiteInclude = {
  lot: { select: { id: true, code: true, categorieVisee: true, bloque: true } },
  analyse: { select: { id: true, dateAnalyse: true, reference: true, categorie: true } },
  ouvertePar: { select: { id: true, nom: true } },
  clotureePar: { select: { id: true, nom: true } },
} satisfies Prisma.NonConformiteInclude;

/**
 * Contrôle qualité : résultat des analyses, non-conformités et blocage des lots, contrôle avant expédition.
 * Les analyses passent toutes par `enregistrerAnalyse`, y compris celles saisies à la réception.
 */
@Injectable()
export class QualiteService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly config: ConfigService,
  ) {}

  /** Critères réglementaires actifs, par catégorie. */
  async criteresParCategorie(db: Db): Promise<Partial<Record<CategorieHuile, Critere[]>>> {
    const specs = await db.specification.findMany({ where: { categorie: { not: null }, actif: true }, include: { criteres: true } });
    return Object.fromEntries(specs.map((s) => [s.categorie!, versCriteres(s.criteres)]));
  }

  /**
   * Enregistre une analyse avec son résultat, met à jour le statut qualité du lot et,
   * si l'analyse n'est pas conforme, ouvre une non-conformité qui bloque le lot.
   */
  async enregistrerAnalyse(tx: Prisma.TransactionClient, lotId: number, { dateAnalyse, ...dto }: AnalyseDto, userId: number) {
    const lot = await tx.lot.findUnique({ where: { id: lotId }, select: { id: true, code: true, categorieVisee: true } });
    if (!lot) throw new NotFoundException('Lot introuvable');

    const evaluation = evaluerPourLot(valeursAnalyse(dto), lot.categorieVisee, await this.criteresParCategorie(tx));
    const analyse = await tx.analyse.create({
      data: {
        ...dto,
        lotId,
        dateAnalyse: new Date(dateAnalyse),
        categorie: evaluation.categorie,
        resultat: evaluation.resultat,
        ecarts: evaluation.ecarts.length ? (evaluation.ecarts as unknown as Prisma.InputJsonValue) : Prisma.DbNull,
      },
    });

    let nonConformite = null;
    if (evaluation.resultat === 'NON_CONFORME') {
      const motifs = evaluation.ecarts.map(decrireEcart);
      if (!motifs.length && evaluation.categorie) motifs.push(`huile classée ${LIBELLES_CATEGORIE[evaluation.categorie]}`);
      nonConformite = await tx.nonConformite.create({
        data: {
          code: await this.prochainCode(tx, new Date()),
          lotId,
          analyseId: analyse.id,
          ouverteParId: userId,
          description:
            `Analyse du ${analyse.dateAnalyse.toLocaleDateString('fr-FR')}${analyse.reference ? ` (bulletin ${analyse.reference})` : ''} ` +
            `non conforme à la catégorie ${LIBELLES_CATEGORIE[lot.categorieVisee]} : ${motifs.join(' ; ')}.`,
        },
      });
    }
    await this.majLot(tx, lotId);
    return { analyse, nonConformite, evaluation };
  }

  /**
   * Lot et analyse qui font foi pour la qualité d'un lot : sa dernière analyse,
   * ou, pour un lot filtré qui n'a pas encore la sienne, celle du lot qu'il a filtré.
   */
  async sourceQualite(db: Db, lotId: number) {
    const include = {
      analyses: { orderBy: [{ dateAnalyse: 'desc' as const }, { id: 'desc' as const }], take: 1 },
      filtration: { select: { lotEntreeId: true } },
    };
    const lot = await db.lot.findUnique({ where: { id: lotId }, include });
    if (!lot) throw new NotFoundException('Lot introuvable');
    let reference = lot;
    while (!reference.analyses.length && reference.filtration) {
      reference = await db.lot.findUniqueOrThrow({ where: { id: reference.filtration.lotEntreeId }, include });
    }
    return { lot, reference, analyse: reference.analyses[0] ?? null };
  }

  /**
   * Statut qualité (dernière analyse, comparée aux critères actuels) et blocage (non-conformité ouverte) du lot.
   * Un lot filtré est aussi bloqué si son lot d'entrée l'est ; les lots filtrés à partir de ce lot sont mis à jour.
   */
  async majLot(tx: Prisma.TransactionClient, lotId: number) {
    const { lot, analyse } = await this.sourceQualite(tx, lotId);
    const statutQualite = analyse
      ? evaluerPourLot(valeursAnalyse(analyse), lot.categorieVisee, await this.criteresParCategorie(tx)).resultat
      : 'NON_ANALYSE';
    const ouvertes = await tx.nonConformite.count({ where: { lotId, statut: { not: 'CLOTUREE' } } });
    const entreeBloquee = lot.filtration
      ? (await tx.lot.findUniqueOrThrow({ where: { id: lot.filtration.lotEntreeId }, select: { bloque: true } })).bloque
      : false;
    const maj = await tx.lot.update({ where: { id: lotId }, data: { statutQualite, bloque: ouvertes > 0 || entreeBloquee } });

    const filtres = await tx.filtration.findMany({ where: { lotEntreeId: lotId }, select: { lotSortieId: true } });
    for (const f of filtres) await this.majLot(tx, f.lotSortieId);
    return maj;
  }

  /** Code suivant pour l'année : NC2026-0001, NC2026-0002… */
  private async prochainCode(tx: Prisma.TransactionClient, date: Date) {
    const prefixe = `NC${date.getFullYear()}-`;
    const dernier = await tx.nonConformite.findFirst({ where: { code: { startsWith: prefixe } }, orderBy: { code: 'desc' }, select: { code: true } });
    const numero = dernier ? Number(dernier.code.slice(prefixe.length)) || 0 : 0;
    return `${prefixe}${String(numero + 1).padStart(4, '0')}`;
  }

  async ajouterAnalyse(lotId: number, dto: AnalyseDto, userId: number) {
    const resultat = await this.prisma.$transaction((tx) => this.enregistrerAnalyse(tx, lotId, dto, userId));
    await this.audit.log({ userId, action: 'CREATE', entite: 'Analyse', entiteId: resultat.analyse.id, donnees: { lotId, ...dto, resultat: resultat.evaluation } });
    if (resultat.nonConformite) {
      await this.audit.log({ userId, action: 'CREATE', entite: 'NonConformite', entiteId: resultat.nonConformite.id, donnees: resultat.nonConformite });
    }
    return resultat;
  }

  // --- Contrôle avant expédition ---------------------------------------------------------------

  /**
   * Contrôle d'un lot avant une vente (avec le cahier des charges du client), une filtration ou une mise en bouteille.
   * Pour le conditionnement, le lot doit être analysé et conforme, en plus de ne pas être bloqué.
   */
  async controleExpedition(lotId: number, clientId?: number, conditionnement = false) {
    const [{ lot, analyse }, cahiers] = await Promise.all([
      this.sourceQualite(this.prisma, lotId),
      clientId ? this.prisma.specification.findMany({ where: { clientId, actif: true }, include: { criteres: true } }) : [],
    ]);
    return controlerExpedition(
      {
        code: lot.code,
        bloque: lot.bloque,
        statutQualite: lot.statutQualite,
        categorieVisee: lot.categorieVisee,
        derniereAnalyse: analyse ? { dateAnalyse: analyse.dateAnalyse, valeurs: valeursAnalyse(analyse) } : null,
      },
      cahiers.map((c) => ({ nom: c.nom, criteres: versCriteres(c.criteres) })),
      { maintenant: new Date(), ageMaxAnalyseJours: this.ageMaxAnalyseJours(), conditionnement },
    );
  }

  private ageMaxAnalyseJours() {
    return Number(this.config.get('ALERTE_AGE_ANALYSE_JOURS', 90));
  }

  // --- Alertes ---------------------------------------------------------------------------------

  /** Alertes qualité sur les lots en stock et compteurs du tableau de bord. */
  async alertes() {
    const stock = await this.prisma.mouvement.groupBy({ by: ['lotId'], _sum: { quantiteKg: true } });
    const quantites = new Map(stock.filter((g) => (g._sum.quantiteKg ?? 0) > 0).map((g) => [g.lotId, g._sum.quantiteKg!]));
    const [lots, ncOuvertes] = await Promise.all([
      this.prisma.lot.findMany({
        where: { id: { in: [...quantites.keys()] } },
        include: { analyses: { orderBy: [{ dateAnalyse: 'desc' }, { id: 'desc' }], take: 1, select: { dateAnalyse: true } } },
        orderBy: { code: 'asc' },
      }),
      this.prisma.nonConformite.count({ where: { statut: { not: 'CLOTUREE' } } }),
    ]);
    const ageMax = this.ageMaxAnalyseJours();
    const maintenant = Date.now();

    const alertes: { niveau: 'ALERTE' | 'INFO'; type: string; lotId: number; lotCode: string; quantiteKg: number; message: string }[] = [];
    const ajouter = (lot: (typeof lots)[number], niveau: 'ALERTE' | 'INFO', type: string, message: string) =>
      alertes.push({ niveau, type, lotId: lot.id, lotCode: lot.code, quantiteKg: quantites.get(lot.id)!, message });

    for (const lot of lots) {
      if (lot.bloque) ajouter(lot, 'ALERTE', 'LOT_BLOQUE', `Lot ${lot.code} bloqué par une non-conformité ouverte.`);
      else if (lot.statutQualite === 'NON_CONFORME') ajouter(lot, 'ALERTE', 'NON_CONFORME', `Lot ${lot.code} : dernière analyse non conforme.`);
      if (lot.statutQualite === 'NON_ANALYSE') ajouter(lot, 'INFO', 'SANS_ANALYSE', `Lot ${lot.code} en stock sans analyse de laboratoire.`);
      if (lot.statutQualite === 'INCOMPLET') {
        ajouter(lot, 'INFO', 'INCOMPLET', `Lot ${lot.code} : la dernière analyse ne mesure pas tous les paramètres de sa catégorie.`);
      }
      const derniere = lot.analyses[0];
      const jours = derniere ? Math.floor((maintenant - derniere.dateAnalyse.getTime()) / 86_400_000) : 0;
      if (jours > ageMax) ajouter(lot, 'INFO', 'ANALYSE_ANCIENNE', `Lot ${lot.code} : dernière analyse il y a ${jours} jours (seuil : ${ageMax} jours).`);
    }

    const compter = (statut: string) => lots.filter((l) => l.statutQualite === statut).length;
    return {
      ageMaxAnalyseJours: ageMax,
      compteurs: {
        lotsEnStock: lots.length,
        conformes: compter('CONFORME'),
        incomplets: compter('INCOMPLET'),
        nonConformes: compter('NON_CONFORME'),
        sansAnalyse: compter('NON_ANALYSE'),
        bloques: lots.filter((l) => l.bloque).length,
        nonConformitesOuvertes: ncOuvertes,
      },
      alertes,
    };
  }

  // --- Non-conformités -------------------------------------------------------------------------

  listeNonConformites(filtres: { statut?: StatutNonConformite; ouvertes?: boolean; lotId?: number }) {
    return this.prisma.nonConformite.findMany({
      where: {
        lotId: filtres.lotId,
        statut: filtres.statut ?? (filtres.ouvertes ? { not: 'CLOTUREE' } : undefined),
      },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: 500,
      include: nonConformiteInclude,
    });
  }

  async creerNonConformite(dto: CreateNonConformiteDto, userId: number) {
    const nc = await this.prisma.$transaction(async (tx) => {
      const lot = await tx.lot.findUnique({ where: { id: dto.lotId }, select: { id: true } });
      if (!lot) throw new NotFoundException('Lot introuvable');
      const nc = await tx.nonConformite.create({
        data: { ...dto, code: await this.prochainCode(tx, new Date()), ouverteParId: userId },
      });
      await this.majLot(tx, dto.lotId);
      return nc;
    });
    await this.audit.log({ userId, action: 'CREATE', entite: 'NonConformite', entiteId: nc.id, donnees: { ...dto, code: nc.code } });
    return this.prisma.nonConformite.findUniqueOrThrow({ where: { id: nc.id }, include: nonConformiteInclude });
  }

  /** Suivi d'une non-conformité. La clôture demande une décision ; un déclassement change la catégorie visée du lot. */
  async majNonConformite(id: number, { nouvelleCategorie, ...dto }: UpdateNonConformiteDto, userId: number) {
    await this.prisma.$transaction(async (tx) => {
      const nc = await tx.nonConformite.findUnique({ where: { id }, include: { analyse: { select: { categorie: true } } } });
      if (!nc) throw new NotFoundException('Non-conformité introuvable');
      if (nc.statut === 'CLOTUREE') throw new BadRequestException('Cette non-conformité est déjà clôturée.');

      const decision = dto.decision ?? nc.decision;
      const cloture = dto.statut === 'CLOTUREE';
      if (cloture && !decision) throw new BadRequestException('Indiquez la décision prise pour clôturer la non-conformité.');

      await tx.nonConformite.update({
        where: { id },
        data: { ...dto, ...(cloture ? { clotureeLe: new Date(), clotureeParId: userId } : {}) },
      });

      if (cloture && decision === 'DECLASSEMENT') {
        const categorie = nouvelleCategorie ?? nc.analyse?.categorie;
        if (!categorie) throw new BadRequestException('Indiquez la nouvelle catégorie du lot pour un déclassement.');
        await tx.lot.update({ where: { id: nc.lotId }, data: { categorieVisee: categorie } });
      }
      await this.majLot(tx, nc.lotId);
    });
    await this.audit.log({ userId, action: 'UPDATE', entite: 'NonConformite', entiteId: id, donnees: { ...dto, nouvelleCategorie } });
    return this.prisma.nonConformite.findUniqueOrThrow({ where: { id }, include: nonConformiteInclude });
  }

  // --- Critères (spécifications) ---------------------------------------------------------------

  /** Catégories réglementaires d'abord (extra vierge, vierge), puis les cahiers des charges clients. */
  async listeSpecifications() {
    const specs = await this.prisma.specification.findMany({
      orderBy: [{ categorie: 'asc' }, { nom: 'asc' }],
      include: { criteres: { orderBy: { parametre: 'asc' } }, client: { select: { id: true, code: true, raisonSociale: true } } },
    });
    return [...specs.filter((s) => s.categorie), ...specs.filter((s) => !s.categorie)];
  }

  async creerSpecification({ criteres, ...dto }: CreateSpecificationDto, userId: number) {
    const spec = await this.prisma.specification.create({ data: { ...dto, criteres: { create: this.criteresData(criteres) } } });
    await this.audit.log({ userId, action: 'CREATE', entite: 'Specification', entiteId: spec.id, donnees: { ...dto, criteres } });
    return spec;
  }

  async majSpecification(id: number, { criteres, ...dto }: UpdateSpecificationDto, userId: number) {
    const spec = await this.prisma.$transaction(async (tx) => {
      const spec = await tx.specification.findUnique({ where: { id } });
      if (!spec) throw new NotFoundException('Critères introuvables');
      if (spec.categorie && dto.actif === false) throw new BadRequestException('Les critères d\'une catégorie réglementaire ne peuvent pas être désactivés.');
      if (criteres) await tx.critereQualite.deleteMany({ where: { specificationId: id } });
      return tx.specification.update({
        where: { id },
        data: { ...dto, ...(criteres ? { criteres: { create: this.criteresData(criteres) } } : {}) },
      });
    });
    await this.audit.log({ userId, action: 'UPDATE', entite: 'Specification', entiteId: id, donnees: { ...dto, criteres } });
    // Les critères réglementaires ont changé : le statut qualité des lots analysés est recalculé.
    if (spec.categorie && criteres) {
      const lots = await this.prisma.lot.findMany({ where: { analyses: { some: {} } }, select: { id: true } });
      for (const lot of lots) await this.prisma.$transaction((tx) => this.majLot(tx, lot.id));
    }
    return spec;
  }

  private criteresData(criteres: CritereDto[]) {
    const parametres = new Set<string>();
    for (const c of criteres) {
      if (parametres.has(c.parametre)) throw new BadRequestException(`Le paramètre ${PARAMETRES[c.parametre].libelle} apparaît deux fois.`);
      parametres.add(c.parametre);
      if (c.min == null && c.max == null) throw new BadRequestException(`${PARAMETRES[c.parametre].libelle} : indiquez un minimum ou un maximum.`);
      if (c.min != null && c.max != null && c.min > c.max) throw new BadRequestException(`${PARAMETRES[c.parametre].libelle} : le minimum dépasse le maximum.`);
    }
    return criteres.map((c) => ({ parametre: c.parametre, min: c.min ?? null, max: c.max ?? null }));
  }
}

export const LIBELLES_CATEGORIE: Record<CategorieHuile, string> = {
  EXTRA_VIERGE: 'extra vierge',
  VIERGE: 'vierge',
  LAMPANTE: 'lampante',
};

import { Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DENSITE_HUILE_KG_L, kgPourUnites } from '../conditionnement/regles.js';
import type { ParametreAnalyse } from '../generated/prisma/enums.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { QualiteService, valeursAnalyse, versCriteres } from '../qualite/qualite.service.js';
import { type ChampAnalyse, type Critere, PARAMETRES, controlerExpedition } from '../qualite/regles.js';
import { StockService } from '../vrac/stock.service.js';
import { joursEntre } from '../vrac/regles.js';
import {
  MIN_HISTORIQUE_ANOMALIE,
  SEUIL_ANOMALIE,
  arrondir,
  ecartTypePrevision,
  joursAvantSeuil,
  margeQualite,
  mediane,
  pente,
  prevoir,
  probabiliteHorsBornes,
  scoreRecommandation,
  scoreRobuste,
  statistiques,
} from './regles.js';

/** Paramètres prévus à la réception d'un lot et suivis pendant le stockage. */
const PARAMETRES_PREVUS: ParametreAnalyse[] = ['ACIDITE', 'PEROXYDE', 'K232', 'K270', 'POLYPHENOLS'];
/** Paramètres qui évoluent pendant le stockage (oxydation, hydrolyse). */
const PARAMETRES_EVOLUTION: ParametreAnalyse[] = ['ACIDITE', 'PEROXYDE', 'K270'];
/** Au moins ce nombre de lots analysés deux fois pour estimer une évolution. */
const MIN_LOTS_EVOLUTION = 3;
/** Horizon de l'alerte « dépassement prévu ». */
const HORIZON_JOURS = 90;

type Analyse = Awaited<ReturnType<IaService['analyses']>>[number];

export interface Anomalie {
  type: 'ANALYSE' | 'RECEPTION' | 'FILTRATION' | 'CONDITIONNEMENT' | 'DATE';
  niveau: 'ALERTE' | 'INFO';
  date: Date;
  lien: { type: 'lot' | 'conditionnement'; id: number; code: string };
  message: string;
}

/**
 * Intelligence artificielle : prévision de la qualité à la réception, évolution des lots en stock,
 * recommandations de lots et de formats pour un client, détection d'anomalies. Lecture seule.
 * Les modèles (voir regles.ts) sont recalculés à chaque appel sur tout l'historique : ils apprennent au fil des saisies.
 */
@Injectable()
export class IaService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly qualite: QualiteService,
    private readonly stock: StockService,
    private readonly config: ConfigService,
  ) {}

  private analyses() {
    return this.prisma.analyse.findMany({
      orderBy: [{ dateAnalyse: 'asc' }, { id: 'asc' }],
      include: { lot: { select: { id: true, code: true, origine: true, huilerieId: true, varieteId: true, dateReception: true } } },
    });
  }

  /** Première analyse de chaque lot reçu d'une huilerie : la qualité livrée, avant tout stockage. */
  private premieresAnalyses(analyses: Analyse[]) {
    const premieres = new Map<number, Analyse>();
    for (const a of analyses) if (a.lot.origine === 'RECEPTION' && !premieres.has(a.lotId)) premieres.set(a.lotId, a);
    return [...premieres.values()];
  }

  private async criteresExtraVierge(): Promise<Critere[]> {
    return (await this.qualite.criteresParCategorie(this.prisma)).EXTRA_VIERGE ?? [];
  }

  private valeurs(analyses: Analyse[], champ: ChampAnalyse): number[] {
    return analyses.map((a) => valeursAnalyse(a)[champ]).filter((v): v is number => v !== null && v !== undefined);
  }

  // --- Prévision à la réception ----------------------------------------------------------------

  /** Qualité attendue d'un lot d'une huilerie (et d'une variété), d'après les lots déjà reçus. */
  async prevision(huilerieId: number, varieteId?: number) {
    const huilerie = await this.prisma.huilerie.findUnique({ where: { id: huilerieId }, select: { id: true, nom: true } });
    if (!huilerie) throw new NotFoundException('Huilerie introuvable');
    const [analyses, criteres] = await Promise.all([this.analyses(), this.criteresExtraVierge()]);
    return { huilerie, ...this.prevoirPour(this.premieresAnalyses(analyses), criteres, huilerieId, varieteId) };
  }

  private prevoirPour(premieres: Analyse[], criteres: Critere[], huilerieId: number, varieteId?: number) {
    const deLHuilerie = premieres.filter((a) => a.lot.huilerieId === huilerieId);
    const groupes = (champ: ChampAnalyse) => [
      ...(varieteId ? [this.valeurs(deLHuilerie.filter((a) => a.lot.varieteId === varieteId), champ)] : []),
      this.valeurs(deLHuilerie, champ),
      this.valeurs(premieres, champ),
    ];
    const parametres = PARAMETRES_PREVUS.map((parametre) => {
      const { champ, libelle, unite } = PARAMETRES[parametre];
      const prevision = prevoir(groupes(champ));
      const critere = criteres.find((c) => c.parametre === parametre) ?? null;
      const risque =
        prevision && critere ? probabiliteHorsBornes(prevision.valeur, ecartTypePrevision(prevision), critere.min, critere.max) : null;
      return { parametre, libelle, unite, prevision, limite: critere && { min: critere.min, max: critere.max }, risque };
    });
    // Risque que l'huile ne soit pas extra vierge : au moins un paramètre hors limite (paramètres supposés indépendants).
    const risques = parametres.map((p) => p.risque).filter((r): r is number => r !== null);
    const risqueNonConforme = risques.length ? arrondir(1 - risques.reduce((s, r) => s * (1 - r), 1), 3) : null;
    const conformes = deLHuilerie.filter((a) => a.resultat === 'CONFORME').length;
    return {
      lotsAnalyses: deLHuilerie.length,
      lotsAnalysesTotal: premieres.length,
      tauxConformite: deLHuilerie.length ? arrondir(conformes / deLHuilerie.length, 3) : null,
      risqueNonConforme,
      parametres,
    };
  }

  /** Classement des huileries : qualité prévue du prochain lot et historique de conformité. */
  async huileries() {
    const [huileries, analyses, criteres] = await Promise.all([
      this.prisma.huilerie.findMany({ where: { actif: true }, select: { id: true, code: true, nom: true }, orderBy: { nom: 'asc' } }),
      this.analyses(),
      this.criteresExtraVierge(),
    ]);
    const premieres = this.premieresAnalyses(analyses);
    return huileries
      .map((h) => ({ huilerie: h, ...this.prevoirPour(premieres, criteres, h.id) }))
      .sort((a, b) => (b.lotsAnalyses ? 1 : 0) - (a.lotsAnalyses ? 1 : 0) || (b.risqueNonConforme ?? 0) - (a.risqueNonConforme ?? 0));
  }

  // --- Évolution pendant le stockage -----------------------------------------------------------

  /**
   * Vitesse d'évolution de chaque paramètre pendant le stockage (médiane des lots analysés plusieurs fois),
   * puis valeur estimée aujourd'hui des lots en stock et date à laquelle ils dépasseraient la limite extra vierge.
   */
  async evolution() {
    const [analyses, criteres, stockParLot] = await Promise.all([this.analyses(), this.criteresExtraVierge(), this.stock.stockParLot(this.prisma)]);
    const parLot = new Map<number, Analyse[]>();
    for (const a of analyses) parLot.set(a.lotId, [...(parLot.get(a.lotId) ?? []), a]);

    const vitesses = PARAMETRES_EVOLUTION.map((parametre) => {
      const { champ, libelle, unite } = PARAMETRES[parametre];
      const pentes: number[] = [];
      for (const liste of parLot.values()) {
        const points = liste
          .map((a) => ({ jours: (a.dateAnalyse.getTime() - liste[0].dateAnalyse.getTime()) / 86_400_000, valeur: valeursAnalyse(a)[champ] }))
          .filter((p): p is { jours: number; valeur: number } => p.valeur != null);
        // Au moins une semaine entre la première et la dernière mesure, sinon on mesure surtout l'imprécision du laboratoire.
        if (points.length < 2 || points[points.length - 1].jours < 7) continue;
        const p = pente(points);
        if (p !== null) pentes.push(p);
      }
      const parJour = pentes.length >= MIN_LOTS_EVOLUTION ? mediane(pentes) : null;
      return { parametre, champ, libelle, unite, lots: pentes.length, parJour, parMois: parJour === null ? null : arrondir(parJour * 30, 3) };
    });

    const maintenant = new Date();
    const lotsEnStock = [...stockParLot].filter(([, kg]) => kg > 0).map(([id]) => id);
    const lots = [];
    for (const lotId of lotsEnStock) {
      const liste = parLot.get(lotId);
      if (!liste?.length) continue;
      const derniere = liste[liste.length - 1];
      const joursDepuis = joursEntre(derniere.dateAnalyse, maintenant);
      const valeurs = valeursAnalyse(derniere);
      const parametres = vitesses
        .filter((v) => v.parJour !== null && valeurs[v.champ] != null)
        .map((v) => {
          const mesure = valeurs[v.champ]!;
          const estimee = arrondir(mesure + Math.max(0, v.parJour!) * joursDepuis, 3);
          const max = criteres.find((c) => c.parametre === v.parametre)?.max ?? null;
          return { parametre: v.parametre, libelle: v.libelle, mesure, estimee, max, joursAvantLimite: max === null ? null : joursAvantSeuil(estimee, v.parJour!, max) };
        });
      const delais = parametres.map((p) => p.joursAvantLimite).filter((j): j is number => j !== null);
      const joursAvantLimite = delais.length ? Math.min(...delais) : null;
      lots.push({
        lot: { id: lotId, code: derniere.lot.code },
        stockKg: stockParLot.get(lotId)!,
        derniereAnalyse: derniere.dateAnalyse,
        joursDepuisAnalyse: joursDepuis,
        parametres,
        joursAvantLimite,
        alerte: joursAvantLimite !== null && joursAvantLimite <= HORIZON_JOURS,
      });
    }
    lots.sort((a, b) => (a.joursAvantLimite ?? Infinity) - (b.joursAvantLimite ?? Infinity) || a.lot.code.localeCompare(b.lot.code));
    return { horizonJours: HORIZON_JOURS, vitesses: vitesses.map(({ champ: _champ, ...v }) => v), lots };
  }

  // --- Recommandations -------------------------------------------------------------------------

  /**
   * Pour une commande d'un client : lots vrac en stock qui peuvent partir (contrôle qualité et cahier des charges),
   * classés par marge de qualité et ancienneté ; formats les plus expédiés vers son pays.
   */
  async recommandations(clientId: number) {
    const client = await this.prisma.client.findUnique({ where: { id: clientId }, select: { id: true, raisonSociale: true, pays: true } });
    if (!client) throw new NotFoundException('Client introuvable');
    const [stockParLot, criteresParCategorie, cahiers, lignes] = await Promise.all([
      this.stock.stockParLot(this.prisma),
      this.qualite.criteresParCategorie(this.prisma),
      this.prisma.specification.findMany({ where: { clientId, actif: true }, include: { criteres: true } }),
      this.prisma.expeditionLigne.findMany({
        where: { expedition: { statut: { in: ['EXPEDIEE', 'LIVREE'] } } },
        select: {
          quantiteUnites: true,
          expedition: { select: { clientId: true, paysDestination: true } },
          lotConditionne: { select: { format: { select: { id: true, code: true, nom: true, contenanceMl: true } } } },
        },
      }),
    ]);
    const criteresClient = cahiers.flatMap((c) => versCriteres(c.criteres));
    // Marge mesurée face aux critères de la catégorie visée du lot et au cahier des charges du client.
    const criteres = (categorie: keyof typeof criteresParCategorie) =>
      [...(criteresParCategorie[categorie] ?? []), ...criteresClient].map((c) => ({ champ: PARAMETRES[c.parametre].champ, min: c.min, max: c.max }));

    const enStock = [...stockParLot].filter(([, kg]) => kg > 0).map(([id]) => id);
    const lots = await this.prisma.lot.findMany({
      where: { id: { in: enStock } },
      select: { id: true, code: true, dateReception: true, variete: { select: { nom: true } }, huilerie: { select: { nom: true } } },
    });
    const maintenant = new Date();
    const ageMax = Number(this.config.get('ALERTE_AGE_ANALYSE_JOURS', 90));
    const candidats = await Promise.all(
      lots.map(async (lot) => {
        const { lot: complet, analyse } = await this.qualite.sourceQualite(this.prisma, lot.id);
        const valeurs = analyse ? valeursAnalyse(analyse) : null;
        const controle = controlerExpedition(
          {
            code: complet.code,
            bloque: complet.bloque,
            statutQualite: complet.statutQualite,
            categorieVisee: complet.categorieVisee,
            derniereAnalyse: analyse && valeurs ? { dateAnalyse: analyse.dateAnalyse, valeurs } : null,
          },
          cahiers.map((c) => ({ nom: c.nom, criteres: versCriteres(c.criteres) })),
          { maintenant, ageMaxAnalyseJours: ageMax, conditionnement: true },
        );
        const marge = valeurs ? margeQualite(valeurs, criteres(complet.categorieVisee)) : null;
        const joursEnStock = joursEntre(lot.dateReception, maintenant);
        const raisons = [
          ...(marge !== null ? [`marge de qualité ${Math.round(marge * 100)} % sur le paramètre le plus proche de sa limite`] : []),
          `en stock depuis ${joursEnStock} jours`,
          ...(cahiers.length && controle.autorise ? [`conforme au cahier des charges ${cahiers.map((c) => c.nom).join(', ')}`] : []),
        ];
        return {
          lot: { id: lot.id, code: lot.code, variete: lot.variete?.nom ?? null, huilerie: lot.huilerie?.nom ?? null },
          stockKg: stockParLot.get(lot.id)!,
          joursEnStock,
          marge,
          autorise: controle.autorise,
          blocages: controle.blocages,
          score: controle.autorise && marge !== null ? scoreRecommandation(marge, joursEnStock) : 0,
          raisons,
        };
      }),
    );
    candidats.sort((a, b) => Number(b.autorise) - Number(a.autorise) || b.score - a.score || a.lot.code.localeCompare(b.lot.code));

    // Formats : d'abord l'historique du client, sinon celui de son pays, sinon tous les exports.
    const formats = (filtre: (l: (typeof lignes)[number]) => boolean) => {
      const parFormat = new Map<number, { format: (typeof lignes)[number]['lotConditionne']['format']; unites: number; litres: number }>();
      for (const l of lignes.filter(filtre)) {
        const f = l.lotConditionne.format;
        const ligne = parFormat.get(f.id) ?? { format: f, unites: 0, litres: 0 };
        ligne.unites += l.quantiteUnites;
        ligne.litres += (l.quantiteUnites * f.contenanceMl) / 1000;
        parFormat.set(f.id, ligne);
      }
      const total = [...parFormat.values()].reduce((s, f) => s + f.litres, 0);
      return [...parFormat.values()]
        .map((f) => ({ ...f, litres: arrondir(f.litres, 1), part: total ? arrondir(f.litres / total, 3) : 0 }))
        .sort((a, b) => b.litres - a.litres);
    };
    const sources = [
      { base: 'CLIENT' as const, formats: formats((l) => l.expedition.clientId === clientId) },
      { base: 'PAYS' as const, formats: formats((l) => l.expedition.paysDestination === client.pays) },
      { base: 'TOUS' as const, formats: formats(() => true) },
    ];
    const choix = sources.find((s) => s.formats.length) ?? { base: 'AUCUN' as const, formats: [] };

    return { client, cahiersDesCharges: cahiers.map((c) => c.nom), lots: candidats, formats: { base: choix.base, liste: choix.formats } };
  }

  // --- Anomalies -------------------------------------------------------------------------------

  /** Valeurs d'analyse inhabituelles, quantités incohérentes et dates impossibles, sur les `jours` derniers jours. */
  async anomalies(jours = 90) {
    const depuis = new Date(Date.now() - jours * 86_400_000);
    const densite = Number(this.config.get('DENSITE_HUILE_KG_L', DENSITE_HUILE_KG_L));
    const [analyses, receptions, filtrations, conditionnements] = await Promise.all([
      this.analyses(),
      this.prisma.lot.findMany({ where: { origine: 'RECEPTION' }, select: { id: true, code: true, huilerieId: true, dateReception: true, quantiteInitialeKg: true, huilerie: { select: { nom: true } } } }),
      this.prisma.filtration.findMany({ select: { code: true, quantiteEntreeKg: true, quantiteSortieKg: true, lotSortie: { select: { id: true, code: true } }, operation: { select: { date: true } } } }),
      this.prisma.lotConditionne.findMany({
        where: { operation: { date: { gte: depuis } } },
        select: { id: true, code: true, nombreUnites: true, quantiteKg: true, format: { select: { contenanceMl: true, nom: true } }, operation: { select: { date: true } } },
      }),
    ]);
    const anomalies: Anomalie[] = [];
    const lien = (lot: { id: number; code: string }) => ({ type: 'lot' as const, id: lot.id, code: lot.code });

    // Analyses : chaque paramètre comparé à toutes les analyses enregistrées.
    for (const parametre of Object.keys(PARAMETRES) as ParametreAnalyse[]) {
      const { champ, libelle, unite } = PARAMETRES[parametre];
      const stats = statistiques(this.valeurs(analyses, champ));
      if (!stats || stats.n < MIN_HISTORIQUE_ANOMALIE) continue;
      for (const a of analyses) {
        const v = valeursAnalyse(a)[champ];
        if (v == null || a.dateAnalyse < depuis) continue;
        const z = scoreRobuste(v, stats);
        if (z === null || Math.abs(z) < SEUIL_ANOMALIE) continue;
        anomalies.push({
          type: 'ANALYSE',
          niveau: Math.abs(z) >= 2 * SEUIL_ANOMALIE ? 'ALERTE' : 'INFO',
          date: a.dateAnalyse,
          lien: lien(a.lot),
          message: `${libelle} à ${v.toLocaleString('fr-FR')}${unite ? ` ${unite}` : ''} : valeur inhabituelle (médiane des analyses : ${stats.mediane.toLocaleString('fr-FR')}${unite ? ` ${unite}` : ''}). Erreur de saisie ou huile à vérifier.`,
        });
      }
    }

    // Dates impossibles : analyse dans le futur ou bien avant la réception du lot.
    for (const a of analyses) {
      if (a.dateAnalyse < depuis) continue;
      const avant = joursEntre(a.dateAnalyse, a.lot.dateReception);
      if (a.dateAnalyse.getTime() > Date.now() + 86_400_000) {
        anomalies.push({ type: 'DATE', niveau: 'ALERTE', date: a.dateAnalyse, lien: lien(a.lot), message: `Analyse datée dans le futur (${a.dateAnalyse.toLocaleDateString('fr-FR')}).` });
      } else if (a.lot.origine === 'RECEPTION' && avant > 30) {
        anomalies.push({ type: 'DATE', niveau: 'INFO', date: a.dateAnalyse, lien: lien(a.lot), message: `Analyse faite ${avant} jours avant la réception du lot : vérifier la date ou le lot.` });
      }
    }

    // Réceptions : quantité très différente des livraisons habituelles de l'huilerie.
    const parHuilerie = new Map<number, number[]>();
    for (const r of receptions) if (r.huilerieId) parHuilerie.set(r.huilerieId, [...(parHuilerie.get(r.huilerieId) ?? []), r.quantiteInitialeKg]);
    for (const r of receptions) {
      if (!r.huilerieId || r.dateReception < depuis) continue;
      const stats = statistiques(parHuilerie.get(r.huilerieId)!);
      if (!stats || stats.n < MIN_HISTORIQUE_ANOMALIE) continue;
      const z = scoreRobuste(r.quantiteInitialeKg, stats);
      if (z === null || Math.abs(z) < SEUIL_ANOMALIE) continue;
      anomalies.push({
        type: 'RECEPTION',
        niveau: 'INFO',
        date: r.dateReception,
        lien: lien(r),
        message: `Réception de ${r.quantiteInitialeKg.toLocaleString('fr-FR')} kg, inhabituelle pour ${r.huilerie?.nom ?? "l'huilerie"} (habituellement ${Math.round(stats.mediane).toLocaleString('fr-FR')} kg).`,
      });
    }

    // Filtrations : perte très différente des autres filtrations.
    const taux = filtrations.map((f) => (f.quantiteEntreeKg ? (f.quantiteEntreeKg - f.quantiteSortieKg) / f.quantiteEntreeKg : 0));
    const statsTaux = statistiques(taux);
    filtrations.forEach((f, i) => {
      if (f.operation.date < depuis || !statsTaux || statsTaux.n < MIN_HISTORIQUE_ANOMALIE) return;
      const z = scoreRobuste(taux[i], statsTaux);
      if (z === null || z < SEUIL_ANOMALIE) return;
      anomalies.push({
        type: 'FILTRATION',
        niveau: 'ALERTE',
        date: f.operation.date,
        lien: lien(f.lotSortie),
        message: `Filtration ${f.code} : perte de ${arrondir(taux[i] * 100, 1).toLocaleString('fr-FR')} %, contre ${arrondir(statsTaux.mediane * 100, 1).toLocaleString('fr-FR')} % habituellement (fuite, filtre colmaté ou erreur de pesée).`,
      });
    });

    // Mise en bouteille : huile sortie de la cuve très différente de ce que contiennent les bouteilles.
    for (const c of conditionnements) {
      const theorique = kgPourUnites(c.nombreUnites, c.format.contenanceMl, densite);
      if (!theorique) continue;
      const ecart = (c.quantiteKg - theorique) / theorique;
      if (Math.abs(ecart) <= 0.02) continue;
      anomalies.push({
        type: 'CONDITIONNEMENT',
        niveau: Math.abs(ecart) > 0.05 ? 'ALERTE' : 'INFO',
        date: c.operation.date,
        lien: { type: 'conditionnement', id: c.id, code: c.code },
        message: `Lot ${c.code} : ${c.quantiteKg.toLocaleString('fr-FR')} kg sortis de la cuve pour ${c.nombreUnites.toLocaleString('fr-FR')} × ${c.format.nom}, soit ${theorique.toLocaleString('fr-FR')} kg attendus (écart ${arrondir(ecart * 100, 1).toLocaleString('fr-FR')} %).`,
      });
    }

    anomalies.sort((a, b) => (a.niveau === b.niveau ? b.date.getTime() - a.date.getTime() : a.niveau === 'ALERTE' ? -1 : 1));
    return {
      jours,
      historique: { analyses: analyses.length, receptions: receptions.length, filtrations: filtrations.length, minimum: MIN_HISTORIQUE_ANOMALIE },
      anomalies,
    };
  }
}

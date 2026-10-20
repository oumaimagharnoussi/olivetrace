// Règles du contrôle qualité, sans accès à la base : elles sont testées dans regles.spec.ts.
import type { CategorieHuile, ParametreAnalyse, StatutQualite } from '../generated/prisma/enums.js';

/** Paramètres mesurés : colonne de la table Analyse, libellé et unité. */
export const PARAMETRES: Record<ParametreAnalyse, { champ: ChampAnalyse; libelle: string; unite: string }> = {
  ACIDITE: { champ: 'acidite', libelle: 'Acidité', unite: '%' },
  PEROXYDE: { champ: 'peroxyde', libelle: 'Indice de peroxyde', unite: 'meq O2/kg' },
  K232: { champ: 'k232', libelle: 'K232', unite: '' },
  K270: { champ: 'k270', libelle: 'K270', unite: '' },
  DELTA_K: { champ: 'deltaK', libelle: 'ΔK', unite: '' },
  POLYPHENOLS: { champ: 'polyphenols', libelle: 'Polyphénols', unite: 'mg/kg' },
  ESTERS_ETHYLIQUES: { champ: 'esterEthyliques', libelle: 'Esters éthyliques', unite: 'mg/kg' },
  MEDIANE_DEFAUT: { champ: 'medianeDefaut', libelle: 'Médiane du défaut', unite: '' },
  MEDIANE_FRUITE: { champ: 'medianeFruite', libelle: 'Médiane du fruité', unite: '' },
};

export type ChampAnalyse =
  | 'acidite'
  | 'peroxyde'
  | 'k232'
  | 'k270'
  | 'deltaK'
  | 'polyphenols'
  | 'esterEthyliques'
  | 'medianeDefaut'
  | 'medianeFruite';

/** Valeurs d'une analyse (null = non mesuré). */
export type ValeursAnalyse = Partial<Record<ChampAnalyse, number | null>>;

export interface Critere {
  parametre: ParametreAnalyse;
  min: number | null;
  max: number | null;
}

export interface Ecart {
  parametre: ParametreAnalyse;
  valeur: number;
  min: number | null;
  max: number | null;
}

export interface Evaluation {
  resultat: Exclude<StatutQualite, 'NON_ANALYSE'>;
  ecarts: Ecart[];
  /** Paramètres demandés par les critères mais absents de l'analyse. */
  nonMesures: ParametreAnalyse[];
}

/** Compare une analyse à des critères (bornes comprises). */
export function evaluer(valeurs: ValeursAnalyse, criteres: Critere[]): Evaluation {
  const ecarts: Ecart[] = [];
  const nonMesures: ParametreAnalyse[] = [];
  for (const c of criteres) {
    const valeur = valeurs[PARAMETRES[c.parametre].champ];
    if (valeur === null || valeur === undefined) {
      nonMesures.push(c.parametre);
      continue;
    }
    if ((c.min !== null && valeur < c.min) || (c.max !== null && valeur > c.max)) {
      ecarts.push({ parametre: c.parametre, valeur, min: c.min, max: c.max });
    }
  }
  const resultat = ecarts.length ? 'NON_CONFORME' : nonMesures.length ? 'INCOMPLET' : 'CONFORME';
  return { resultat, ecarts, nonMesures };
}

/** Ordre des catégories, de la meilleure à la moins bonne. */
export const CATEGORIES: CategorieHuile[] = ['EXTRA_VIERGE', 'VIERGE', 'LAMPANTE'];

/**
 * Catégorie atteinte : la meilleure dont aucun critère mesuré n'est dépassé, sinon lampante.
 * Les paramètres non mesurés ne déclassent pas (le résultat est alors « incomplet »).
 */
export function classer(valeurs: ValeursAnalyse, criteresParCategorie: Partial<Record<CategorieHuile, Critere[]>>): CategorieHuile {
  for (const categorie of CATEGORIES) {
    const criteres = criteresParCategorie[categorie];
    if (criteres && evaluer(valeurs, criteres).ecarts.length === 0) return categorie;
  }
  return 'LAMPANTE';
}

/** Rang d'une catégorie : plus il est petit, meilleure est l'huile. */
export function rang(categorie: CategorieHuile): number {
  return CATEGORIES.indexOf(categorie);
}

/** Résultat d'une analyse pour un lot : catégorie atteinte et conformité à la catégorie visée. */
export function evaluerPourLot(
  valeurs: ValeursAnalyse,
  categorieVisee: CategorieHuile,
  criteresParCategorie: Partial<Record<CategorieHuile, Critere[]>>,
) {
  // Sans aucune valeur mesurée (ex. bulletin saisi avec un simple commentaire), la catégorie reste inconnue.
  const mesure = Object.values(valeurs).some((v) => v !== null && v !== undefined);
  const categorie = mesure ? classer(valeurs, criteresParCategorie) : null;
  const evaluation = evaluer(valeurs, criteresParCategorie[categorieVisee] ?? []);
  // Une huile classée en dessous de la catégorie visée est non conforme, même si aucun critère de cette catégorie
  // n'est défini (ex. lot visé « vierge » mais classé lampante).
  const resultat = categorie && rang(categorie) > rang(categorieVisee) ? 'NON_CONFORME' : evaluation.resultat;
  return { categorie, ...evaluation, resultat };
}

/** Phrase lisible d'un écart : « Acidité 1,2 % (maximum 0,8 %) ». */
export function decrireEcart(e: Ecart): string {
  const { libelle, unite } = PARAMETRES[e.parametre];
  const u = unite ? ` ${unite}` : '';
  const limites = [e.min !== null && `minimum ${nombre(e.min)}${u}`, e.max !== null && `maximum ${nombre(e.max)}${u}`].filter(Boolean);
  return `${libelle} ${nombre(e.valeur)}${u} (${limites.join(', ')})`;
}

export interface LotAExpedier {
  code: string;
  bloque: boolean;
  statutQualite: StatutQualite;
  categorieVisee: CategorieHuile;
  /** Dernière analyse, si le lot en a une. */
  derniereAnalyse: { dateAnalyse: Date; valeurs: ValeursAnalyse } | null;
}

/**
 * Contrôle avant une vente ou un envoi au conditionnement.
 * Les blocages empêchent la sortie ; les avertissements sont affichés pour information.
 */
export function controlerExpedition(
  lot: LotAExpedier,
  cahiersDesCharges: { nom: string; criteres: Critere[] }[],
  options: { maintenant: Date; ageMaxAnalyseJours: number },
) {
  const blocages: string[] = [];
  const avertissements: string[] = [];

  if (lot.bloque) blocages.push(`Le lot ${lot.code} est bloqué par une non-conformité ouverte.`);

  const analyse = lot.derniereAnalyse;
  if (!analyse) {
    avertissements.push(`Le lot ${lot.code} n'a aucune analyse de laboratoire.`);
  } else {
    if (lot.statutQualite === 'NON_CONFORME' && !lot.bloque) {
      avertissements.push(`La dernière analyse du lot ${lot.code} n'est pas conforme à la catégorie visée.`);
    }
    if (lot.statutQualite === 'INCOMPLET') {
      avertissements.push(`La dernière analyse du lot ${lot.code} ne mesure pas tous les paramètres de la catégorie visée.`);
    }
    const jours = Math.floor((options.maintenant.getTime() - analyse.dateAnalyse.getTime()) / 86_400_000);
    if (jours > options.ageMaxAnalyseJours) {
      avertissements.push(`La dernière analyse du lot ${lot.code} date de ${jours} jours (au-delà de ${options.ageMaxAnalyseJours} jours).`);
    }
  }

  for (const cdc of cahiersDesCharges) {
    if (!analyse) {
      blocages.push(`Cahier des charges « ${cdc.nom} » : le lot doit avoir une analyse.`);
      continue;
    }
    const { ecarts, nonMesures } = evaluer(analyse.valeurs, cdc.criteres);
    if (ecarts.length) blocages.push(`Cahier des charges « ${cdc.nom} » non respecté : ${ecarts.map(decrireEcart).join(' ; ')}.`);
    if (nonMesures.length) {
      avertissements.push(
        `Cahier des charges « ${cdc.nom} » : paramètres non mesurés (${nonMesures.map((p) => PARAMETRES[p].libelle).join(', ')}).`,
      );
    }
  }

  return { autorise: blocages.length === 0, blocages, avertissements };
}

function nombre(valeur: number): string {
  return valeur.toLocaleString('fr-FR');
}

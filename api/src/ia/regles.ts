// Modèles statistiques de l'IA, sans accès à la base : ils sont testés dans regles.spec.ts.
//
// Pourquoi des statistiques simples plutôt qu'un modèle « boîte noire » : la plateforme démarre avec peu d'historique
// (une campagne donne quelques dizaines de lots par huilerie). Des moyennes pondérées, des écarts robustes et des
// tendances linéaires restent fiables avec peu de données, et chaque résultat s'explique à l'utilisateur.

export interface Statistiques {
  n: number;
  moyenne: number;
  ecartType: number;
  mediane: number;
  /** Écart absolu médian : mesure de dispersion qui ne se laisse pas tromper par une valeur aberrante. */
  mad: number;
}

export function mediane(valeurs: number[]): number {
  if (!valeurs.length) return NaN;
  const t = [...valeurs].sort((a, b) => a - b);
  const m = Math.floor(t.length / 2);
  return t.length % 2 ? t[m] : (t[m - 1] + t[m]) / 2;
}

export function statistiques(valeurs: number[]): Statistiques | null {
  const n = valeurs.length;
  if (!n) return null;
  const moyenne = valeurs.reduce((s, v) => s + v, 0) / n;
  const variance = n > 1 ? valeurs.reduce((s, v) => s + (v - moyenne) ** 2, 0) / (n - 1) : 0;
  const med = mediane(valeurs);
  return { n, moyenne, ecartType: Math.sqrt(variance), mediane: med, mad: mediane(valeurs.map((v) => Math.abs(v - med))) };
}

/** Fonction de répartition de la loi normale centrée réduite (approximation d'Abramowitz et Stegun, erreur < 1e-7). */
export function repartitionNormale(z: number): number {
  const t = 1 / (1 + 0.2316419 * Math.abs(z));
  const d = 0.3989422804014327 * Math.exp((-z * z) / 2);
  const p = d * t * (0.31938153 + t * (-0.356563782 + t * (1.781477937 + t * (-1.821255978 + t * 1.330274429))));
  return z >= 0 ? 1 - p : p;
}

export type Fiabilite = 'FAIBLE' | 'MOYENNE' | 'BONNE';

export interface Prevision {
  valeur: number;
  /** Intervalle où la valeur tombe 8 fois sur 10. */
  basse: number;
  haute: number;
  /** Nombre d'analyses du groupe particulier le mieux connu (ex. l'huilerie). */
  n: number;
  fiabilite: Fiabilite;
}

/** Écart-type robuste : à partir de 5 valeurs, une analyse aberrante n'élargit pas l'intervalle de prévision. */
function dispersion(s: Statistiques): number {
  return s.n >= 5 && s.mad > 0 ? Math.min(s.ecartType, 1.4826 * s.mad) : s.ecartType;
}

/** Poids de l'historique général face à celui de l'huilerie : avec k analyses, l'huilerie compte pour moitié. */
export const PSEUDO_ANALYSES = 3;

/**
 * Prévision d'un paramètre pour un nouveau lot. Les groupes vont du plus précis au plus général
 * (ex. huilerie + variété, huilerie, toutes les huileries). Chaque groupe est tiré vers le groupe plus général
 * en proportion de son nombre d'analyses : une huilerie avec 2 analyses compte peu, une avec 30 compte presque seule.
 */
export function prevoir(groupes: number[][]): Prevision | null {
  const general = groupes[groupes.length - 1];
  const stats = groupes.map(statistiques);
  if (!stats[stats.length - 1]) return null;
  let valeur = stats[stats.length - 1]!.moyenne;
  let ecartType = dispersion(stats[stats.length - 1]!);
  for (let i = groupes.length - 2; i >= 0; i--) {
    const s = stats[i];
    if (!s) continue;
    valeur = (s.n * s.moyenne + PSEUDO_ANALYSES * valeur) / (s.n + PSEUDO_ANALYSES);
    // Dispersion du groupe, complétée par celle du groupe plus général tant qu'il a peu d'analyses.
    ecartType = Math.sqrt(((s.n - 1) * dispersion(s) ** 2 + PSEUDO_ANALYSES * ecartType ** 2) / (s.n - 1 + PSEUDO_ANALYSES));
  }
  // Le groupe particulier le mieux connu (souvent l'huilerie) dit si la prévision est fiable.
  const n = groupes.length > 1 ? Math.max(0, ...stats.slice(0, -1).map((s) => s?.n ?? 0)) : general.length;
  const marge = 1.2816 * ecartType;
  return {
    valeur: arrondir(valeur),
    basse: arrondir(Math.max(0, valeur - marge)),
    haute: arrondir(valeur + marge),
    n,
    fiabilite: n >= 8 ? 'BONNE' : n >= 3 ? 'MOYENNE' : 'FAIBLE',
  };
}

/** Probabilité qu'une valeur prévue sorte des bornes (min et/ou max), en supposant une loi normale. */
export function probabiliteHorsBornes(valeur: number, ecartType: number, min: number | null, max: number | null): number {
  if (ecartType <= 0) return (max !== null && valeur > max) || (min !== null && valeur < min) ? 1 : 0;
  let p = 0;
  if (max !== null) p += 1 - repartitionNormale((max - valeur) / ecartType);
  if (min !== null) p += repartitionNormale((min - valeur) / ecartType);
  return Math.min(1, Math.round(p * 1000) / 1000);
}

/** Écart-type d'une prévision, retrouvé depuis son intervalle à 80 %. */
export function ecartTypePrevision(p: Prevision): number {
  return (p.haute - p.valeur) / 1.2816;
}

/**
 * Score robuste : nombre d'« écarts-types » entre la valeur et la médiane, mesuré avec l'écart absolu médian.
 * Au-delà de 3,5, la valeur est inhabituelle (seuil d'Iglewicz et Hoaglin). Null si la dispersion est nulle.
 */
export function scoreRobuste(valeur: number, s: Statistiques): number | null {
  const dispersion = s.mad > 0 ? s.mad / 0.6745 : s.ecartType;
  if (!dispersion) return null;
  return (valeur - s.mediane) / dispersion;
}

export const SEUIL_ANOMALIE = 3.5;
/** En dessous, l'historique est trop court pour juger qu'une valeur est inhabituelle. */
export const MIN_HISTORIQUE_ANOMALIE = 8;

/** Pente (unité par jour) de la droite des moindres carrés ; null avec moins de 2 dates distinctes. */
export function pente(points: { jours: number; valeur: number }[]): number | null {
  if (points.length < 2) return null;
  const mx = points.reduce((s, p) => s + p.jours, 0) / points.length;
  const my = points.reduce((s, p) => s + p.valeur, 0) / points.length;
  const sxx = points.reduce((s, p) => s + (p.jours - mx) ** 2, 0);
  if (!sxx) return null;
  return points.reduce((s, p) => s + (p.jours - mx) * (p.valeur - my), 0) / sxx;
}

/** Jours avant qu'une valeur qui évolue de `parJour` atteigne le seuil ; null si elle ne l'atteint jamais. */
export function joursAvantSeuil(valeur: number, parJour: number, seuil: number): number | null {
  if (valeur >= seuil) return 0;
  if (parJour <= 0) return null;
  return Math.ceil((seuil - valeur) / parJour - 1e-9);
}

/**
 * Marge de qualité d'une analyse face à des critères : la plus petite marge relative, de 0 (à la limite) à 1.
 * Négative si un critère n'est pas respecté. Null si aucun critère n'est mesuré.
 */
export function margeQualite(
  valeurs: Record<string, number | null | undefined>,
  criteres: { champ: string; min: number | null; max: number | null }[],
): number | null {
  const marges: number[] = [];
  for (const c of criteres) {
    const v = valeurs[c.champ];
    if (v === null || v === undefined) continue;
    if (c.max !== null && c.max > 0) marges.push((c.max - v) / c.max);
    if (c.min !== null && c.min > 0) marges.push((v - c.min) / c.min);
  }
  return marges.length ? arrondir(Math.min(1, ...marges), 3) : null;
}

/**
 * Score de recommandation d'un lot pour une commande (0 à 100) : 60 points pour la marge de qualité
 * (une huile loin des limites supporte mieux le transport et le stockage chez le client), 40 points pour l'ancienneté
 * (premier entré, premier sorti : 180 jours en stock donnent les 40 points).
 */
export function scoreRecommandation(marge: number, joursEnStock: number): number {
  return Math.round(60 * Math.max(0, Math.min(1, marge)) + 40 * Math.min(1, Math.max(0, joursEnStock) / 180));
}

export function arrondir(v: number, decimales = 2): number {
  const f = 10 ** decimales;
  return Math.round(v * f) / f;
}

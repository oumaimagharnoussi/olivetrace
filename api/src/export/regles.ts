// Règles des expéditions et du dossier export, sans accès à la base : elles sont testées dans regles.spec.ts.
import type { CategorieHuile, StatutExpedition } from '../generated/prisma/enums.js';

/** Pays de l'Union européenne (codes ISO 3166-1 alpha-2), destination prioritaire d'OLIVED. */
export const PAYS_UE = new Set([
  'AT', 'BE', 'BG', 'CY', 'CZ', 'DE', 'DK', 'EE', 'ES', 'FI', 'FR', 'GR', 'HR', 'HU',
  'IE', 'IT', 'LT', 'LU', 'LV', 'MT', 'NL', 'PL', 'PT', 'RO', 'SE', 'SI', 'SK',
]);

export const INCOTERMS = ['EXW', 'FCA', 'FAS', 'FOB', 'CFR', 'CIF', 'CPT', 'CIP', 'DAP', 'DPU', 'DDP'] as const;

/** Code de la nomenclature combinée (NC) de chaque catégorie, depuis 2022. */
export const CODES_NC: Record<CategorieHuile, string> = {
  EXTRA_VIERGE: '1509 20 00',
  VIERGE: '1509 30 00',
  LAMPANTE: '1509 40 00',
};

/** Changements de statut permis, à la main, depuis chaque statut. */
const TRANSITIONS: Record<StatutExpedition, StatutExpedition[]> = {
  PREPAREE: ['EXPEDIEE', 'ANNULEE'],
  EXPEDIEE: ['LIVREE'],
  LIVREE: [],
  ANNULEE: [],
};

export const LIBELLES_STATUT: Record<StatutExpedition, string> = {
  PREPAREE: 'préparée',
  EXPEDIEE: 'expédiée',
  LIVREE: 'livrée',
  ANNULEE: 'annulée',
};

/** Erreur si le changement de statut n'est pas permis (ex. annuler une expédition déjà partie). */
export function controlerTransition(de: StatutExpedition, vers: StatutExpedition): string | null {
  if (de === vers) return null;
  if (TRANSITIONS[de].includes(vers)) return null;
  if (vers === 'ANNULEE') return "Une expédition partie ne peut plus être annulée : enregistrez un retour par un ajustement d'inventaire.";
  return `Une expédition ${LIBELLES_STATUT[de]} ne peut pas passer à « ${LIBELLES_STATUT[vers]} ».`;
}

export interface LigneDemandee {
  lotConditionneId: number;
  quantiteUnites: number;
}

/**
 * Contrôle des lignes d'une expédition : au moins une ligne, un lot une seule fois, assez d'unités en stock.
 * `stock` donne le code du lot et ses unités en stock ; un lot absent est introuvable.
 */
export function controlerLignes(lignes: LigneDemandee[], stock: Map<number, { code: string; stockUnites: number }>): string[] {
  const erreurs: string[] = [];
  if (!lignes.length) erreurs.push('Ajoutez au moins un lot à expédier.');
  const vus = new Set<number>();
  for (const l of lignes) {
    const lot = stock.get(l.lotConditionneId);
    if (!lot) {
      erreurs.push(`Lot conditionné ${l.lotConditionneId} introuvable.`);
      continue;
    }
    if (vus.has(l.lotConditionneId)) erreurs.push(`Le lot ${lot.code} apparaît deux fois.`);
    vus.add(l.lotConditionneId);
    if (l.quantiteUnites < 1) erreurs.push(`Lot ${lot.code} : indiquez au moins une unité.`);
    else if (l.quantiteUnites > lot.stockUnites) {
      erreurs.push(`Stock insuffisant : il reste ${lot.stockUnites.toLocaleString('fr-FR')} unités du lot ${lot.code}.`);
    }
  }
  return erreurs;
}

/** Colisage d'une ligne : volume, poids net d'huile et nombre de cartons. */
export function colisage(quantiteUnites: number, contenanceMl: number, densite: number, unitesParCarton: number | null) {
  const litres = (quantiteUnites * contenanceMl) / 1000;
  return {
    litres,
    poidsNetKg: Math.round(litres * densite * 10) / 10,
    cartons: unitesParCarton ? Math.ceil(quantiteUnites / unitesParCarton) : null,
    cartonIncomplet: unitesParCarton ? quantiteUnites % unitesParCarton !== 0 : false,
  };
}

/** Échappe un texte pour l'insérer dans une page HTML (documents PDF). */
export function html(valeur: unknown): string {
  if (valeur === null || valeur === undefined) return '';
  return String(valeur)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/** Documents du dossier export, dans l'ordre du dossier complet. */
export const DOCUMENTS = {
  colisage: 'Liste de colisage',
  origine: "Certificat d'origine",
  analyses: "Bulletins d'analyse",
  conformite: 'Déclaration de conformité UE',
  fiches: 'Fiches techniques produit',
} as const;

export type TypeDocument = keyof typeof DOCUMENTS;

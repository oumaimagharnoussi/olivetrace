// Règles de la filtration, de la mise en bouteille et du stock de produits finis, sans accès à la base :
// elles sont testées dans regles.spec.ts.
import type { TypeMouvementProduit } from '../generated/prisma/enums.js';
import { formatKg } from '../vrac/regles.js';

/** Masse volumique de l'huile d'olive à 20 °C, en kg par litre. */
export const DENSITE_HUILE_KG_L = 0.916;

/** Au-delà de ce taux de perte, la filtration est signalée (sans être refusée). */
export const TAUX_PERTE_FILTRATION_ALERTE = 0.03;

/** Litres d'huile contenus dans des unités d'un format. */
export function litres(nombreUnites: number, contenanceMl: number): number {
  return (nombreUnites * contenanceMl) / 1000;
}

/** Kilogrammes d'huile pour remplir des unités d'un format, arrondis au kilo. */
export function kgPourUnites(nombreUnites: number, contenanceMl: number, densite = DENSITE_HUILE_KG_L): number {
  return Math.round(litres(nombreUnites, contenanceMl) * densite);
}

/** DLUO par défaut : date de mise en bouteille + n mois (le 31 janvier + 1 mois donne le 28 ou 29 février). */
export function dluoParDefaut(date: Date, mois: number): Date {
  const d = new Date(date);
  const jour = d.getDate();
  d.setDate(1);
  d.setMonth(d.getMonth() + mois);
  const dernierJour = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
  d.setDate(Math.min(jour, dernierJour));
  return d;
}

/** Contrôle des quantités d'une filtration : erreurs (refus) et avertissements, perte calculée. */
export function controlerFiltration(quantiteEntreeKg: number, quantiteSortieKg: number) {
  const erreurs: string[] = [];
  const avertissements: string[] = [];
  if (quantiteSortieKg > quantiteEntreeKg) {
    erreurs.push(`L'huile filtrée (${formatKg(quantiteSortieKg)}) ne peut pas dépasser l'huile mise en filtration (${formatKg(quantiteEntreeKg)}).`);
  }
  const perteKg = quantiteEntreeKg - quantiteSortieKg;
  const tauxPerte = quantiteEntreeKg > 0 ? Math.round((perteKg / quantiteEntreeKg) * 1000) / 10 : 0;
  if (perteKg > 0 && perteKg / quantiteEntreeKg > TAUX_PERTE_FILTRATION_ALERTE) {
    avertissements.push(`Perte de filtration élevée : ${formatKg(perteKg)} (${tauxPerte.toLocaleString('fr-FR')} %).`);
  }
  return { erreurs, avertissements, perteKg, tauxPerte };
}

/**
 * Quantité signée d'un mouvement de produits finis et erreurs éventuelles.
 * Une expédition ou une casse retire des unités ; un ajustement peut ajouter (+) ou retirer (-).
 */
export function mouvementProduit(type: TypeMouvementProduit, quantite: number, stockActuel: number, codeLot: string) {
  const erreurs: string[] = [];
  if (type === 'CONDITIONNEMENT') erreurs.push('Les entrées en stock se font par une mise en bouteille.');
  if (quantite === 0) erreurs.push('La quantité ne peut pas être nulle.');
  if ((type === 'EXPEDITION' || type === 'CASSE') && quantite < 0) erreurs.push('Indiquez le nombre d\'unités sorties, sans signe moins.');
  const delta = type === 'AJUSTEMENT' ? quantite : -Math.abs(quantite);
  if (stockActuel + delta < 0) {
    erreurs.push(`Stock insuffisant : il reste ${stockActuel.toLocaleString('fr-FR')} unités du lot ${codeLot}.`);
  }
  return { delta, erreurs };
}

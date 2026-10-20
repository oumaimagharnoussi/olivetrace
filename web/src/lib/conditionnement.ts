// Types et libellés de la filtration, de la mise en bouteille et du stock de produits finis (voir api/src/conditionnement).
import type { StatutQualite, CategorieHuile } from "./qualite";
import type { Role } from "./roles";
import type { OrigineLot } from "./vrac";

/** Rôles qui enregistrent les filtrations et mises en bouteille (mêmes droits que l'API). */
export const ROLES_PRODUCTION: Role[] = ["DIRECTION", "PRODUCTION"];
/** Rôles qui enregistrent les expéditions, casses et ajustements de produits finis. */
export const ROLES_PRODUITS_FINIS: Role[] = ["DIRECTION", "PRODUCTION", "STOCK", "EXPORT"];

/** Masse volumique de l'huile, pour estimer l'huile à mettre en bouteille (l'API fait le calcul définitif). */
export const DENSITE_HUILE_KG_L = 0.916;

export interface Format {
  id: number;
  code: string;
  nom: string;
  contenanceMl: number;
  materiau: string | null;
  unitesParCarton: number | null;
}

interface MouvementsOperation {
  date: string;
  user: { id: number; nom: string } | null;
  mouvements: { quantiteKg: number; stockage: { id: number; code: string } }[];
}

export interface Filtration {
  id: number;
  code: string;
  quantiteEntreeKg: number;
  quantiteSortieKg: number;
  operateur: string;
  typeFiltre: string | null;
  porositeMicrons: string | null;
  pressionBar: string | null;
  temperatureC: string | null;
  debitLh: number | null;
  dureeMinutes: number | null;
  notes: string | null;
  lotEntree: { id: number; code: string };
  lotSortie: { id: number; code: string; statutQualite: StatutQualite; bloque: boolean };
  operation: MouvementsOperation;
}

export interface LotConditionne {
  id: number;
  code: string;
  formatId: number;
  nombreUnites: number;
  quantiteKg: number;
  litres: number;
  stockUnites: number;
  dluo: string | null;
  paysDestination: string | null;
  destination: string | null;
  operateur: string | null;
  notes: string | null;
  format: Format;
  lotVrac: {
    id: number;
    code: string;
    origine: OrigineLot;
    categorieVisee: CategorieHuile;
    statutQualite: StatutQualite;
    bloque: boolean;
    campagne: string | null;
    variete: { id: number; nom: string } | null;
    huilerie: { id: number; nom: string } | null;
  };
  client: { id: number; code: string; raisonSociale: string } | null;
  operation: MouvementsOperation;
}

export type TypeMouvementProduit = "CONDITIONNEMENT" | "EXPEDITION" | "CASSE" | "AJUSTEMENT";

export const TYPES_MOUVEMENT_PRODUIT: Record<TypeMouvementProduit, string> = {
  CONDITIONNEMENT: "Mise en bouteille",
  EXPEDITION: "Expédition",
  CASSE: "Casse / échantillons",
  AJUSTEMENT: "Ajustement d'inventaire",
};

export interface MouvementProduit {
  id: number;
  type: TypeMouvementProduit;
  date: string;
  quantiteUnites: number;
  reference: string | null;
  notes: string | null;
  lotConditionne: { id: number; code: string; format: { nom: string } };
  client: { id: number; code: string; raisonSociale: string } | null;
  user: { id: number; nom: string } | null;
}

export interface StockProduitsFinis {
  lots: LotConditionne[];
  parFormat: { format: Format; unites: number; litres: number; lots: number }[];
}

export function litres(valeur: number): string {
  return `${valeur.toLocaleString("fr-FR", { maximumFractionDigits: 1 })} L`;
}

export function unites(valeur: number): string {
  return valeur.toLocaleString("fr-FR");
}

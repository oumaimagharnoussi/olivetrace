// Types et libellés du flux vrac (voir api/src/vrac).
import type { CategorieHuile, Ecart, StatutQualite } from "./qualite";
import type { Role } from "./roles";

/** Rôles qui peuvent enregistrer des mouvements de stock (mêmes droits que l'API). */
export const ROLES_STOCK: Role[] = ["DIRECTION", "STOCK"];
export const ROLES_ANALYSE: Role[] = ["DIRECTION", "STOCK", "QUALITE"];
export const ROLES_LIVRAISON: Role[] = ["DIRECTION", "STOCK", "EXPORT"];

export interface Ref {
  id: number;
  code: string;
  nom?: string;
}

export interface Analyse {
  id: number;
  dateAnalyse: string;
  laboratoire: string | null;
  reference: string | null;
  acidite: string | null;
  peroxyde: string | null;
  k232: string | null;
  k270: string | null;
  deltaK: string | null;
  polyphenols: number | null;
  esterEthyliques: string | null;
  medianeDefaut: string | null;
  medianeFruite: string | null;
  commentaire: string | null;
  categorie: CategorieHuile | null;
  resultat: StatutQualite | null;
  ecarts: Ecart[] | null;
}

export interface Lot {
  id: number;
  code: string;
  origine: "RECEPTION" | "ASSEMBLAGE";
  huilerie: Ref | null;
  variete: Ref | null;
  campagne: string | null;
  dateReception: string;
  quantiteInitialeKg: number;
  numeroBon: string | null;
  notes: string | null;
  categorieVisee: CategorieHuile;
  statutQualite: StatutQualite;
  bloque: boolean;
  stockKg: number;
  derniereAnalyse: Analyse | null;
}

export interface Cuve {
  id: number;
  code: string;
  type: string;
  capaciteKg: number;
  emplacement: string | null;
  quantiteKg: number;
  tauxRemplissage: number;
  lot: {
    id: number;
    code: string;
    variete: string | null;
    huilerie: string | null;
    dateReception: string;
    joursEnStock: number;
  } | null;
}

export interface Alerte {
  niveau: "ALERTE" | "INFO";
  type: string;
  lotId: number;
  lotCode: string;
  message: string;
}

export interface Livraison {
  id: number;
  transporteur: string;
  immatriculation: string | null;
  chauffeur: string | null;
  numeroBl: string | null;
  adresseLivraison: string | null;
  dateEnlevement: string | null;
  dateLivraisonPrevue: string | null;
  dateLivraison: string | null;
  statut: StatutLivraison;
  notes: string | null;
}

export interface Mouvement {
  id: number;
  quantiteKg: number;
  lot: Ref;
  stockage: Ref;
}

export interface Operation {
  id: number;
  type: TypeOperation;
  date: string;
  motif: MotifSortie | null;
  notes: string | null;
  user: { id: number; nom: string } | null;
  client: { id: number; code: string; raisonSociale: string } | null;
  livraison: Livraison | null;
  mouvements: Mouvement[];
}

export type TypeOperation = "RECEPTION" | "TRANSFERT" | "ASSEMBLAGE" | "SORTIE";
export type MotifSortie = "VENTE" | "CONDITIONNEMENT" | "PERTE" | "AUTRE";
export type StatutLivraison = "PLANIFIEE" | "EN_COURS" | "LIVREE" | "ANNULEE";

export const TYPES_OPERATION: Record<TypeOperation, string> = {
  RECEPTION: "Réception",
  TRANSFERT: "Transfert",
  ASSEMBLAGE: "Assemblage",
  SORTIE: "Sortie",
};

export const MOTIFS_SORTIE: Record<MotifSortie, string> = {
  VENTE: "Vente en vrac",
  CONDITIONNEMENT: "Envoi au conditionnement",
  PERTE: "Perte / écart",
  AUTRE: "Autre",
};

export const STATUTS_LIVRAISON: Record<StatutLivraison, string> = {
  PLANIFIEE: "Planifiée",
  EN_COURS: "En cours",
  LIVREE: "Livrée",
  ANNULEE: "Annulée",
};

export function kg(valeur: number): string {
  return `${valeur.toLocaleString("fr-FR")} kg`;
}

export function date(valeur: string | null | undefined): string {
  return valeur ? new Date(valeur).toLocaleDateString("fr-FR") : "—";
}

export function nombre(valeur: string | number | null | undefined): string {
  return valeur === null || valeur === undefined ? "—" : Number(valeur).toLocaleString("fr-FR");
}

/** Date du jour (heure locale) au format des champs <input type="date">. */
export function aujourdhui(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** Date d'une opération à envoyer à l'API : rien si c'est aujourd'hui, l'API prend alors l'heure exacte. */
export function dateOperation(valeur: string): string | undefined {
  return valeur === aujourdhui() ? undefined : valeur;
}

/** Campagne oléicole en cours (d'octobre à septembre), ex. 2026/2027. */
export function campagneEnCours(): string {
  const d = new Date();
  const debut = d.getMonth() >= 9 ? d.getFullYear() : d.getFullYear() - 1;
  return `${debut}/${debut + 1}`;
}

// Types et libellés des expéditions export et du dossier PDF (voir api/src/export).
import type { CategorieHuile, StatutQualite } from "./qualite";
import type { Role } from "./roles";

/** Rôles qui créent les expéditions et changent leur statut (mêmes droits que l'API). */
export const ROLES_EXPORT: Role[] = ["DIRECTION", "EXPORT"];

export type StatutExpedition = "PREPAREE" | "EXPEDIEE" | "LIVREE" | "ANNULEE";
export type ModeTransport = "MARITIME" | "ROUTIER" | "AERIEN" | "FERROVIAIRE";

export const STATUTS_EXPEDITION: Record<StatutExpedition, string> = {
  PREPAREE: "Préparée",
  EXPEDIEE: "Expédiée",
  LIVREE: "Livrée",
  ANNULEE: "Annulée",
};

export const COULEURS_STATUT: Record<StatutExpedition, string> = {
  PREPAREE: "bg-stone-100 text-stone-700",
  EXPEDIEE: "bg-amber-100 text-amber-800",
  LIVREE: "bg-olive-100 text-olive-800",
  ANNULEE: "bg-red-50 text-red-700",
};

export const MODES_TRANSPORT: Record<ModeTransport, string> = {
  MARITIME: "Maritime",
  ROUTIER: "Routier",
  AERIEN: "Aérien",
  FERROVIAIRE: "Ferroviaire",
};

export const INCOTERMS = ["EXW", "FCA", "FAS", "FOB", "CFR", "CIF", "CPT", "CIP", "DAP", "DPU", "DDP"];

/** Documents du dossier export : chemin de l'API et libellé. */
export const DOCUMENTS = {
  colisage: "Liste de colisage",
  origine: "Certificat d'origine",
  analyses: "Bulletins d'analyse",
  conformite: "Déclaration de conformité UE",
  fiches: "Fiches techniques produit",
} as const;

export type TypeDocument = keyof typeof DOCUMENTS;

/** Suivi des expéditions d'un pays de destination (hors annulées). */
export interface SuiviDestination {
  pays: string;
  nomPays: string | null;
  ue: boolean;
  preparees: number;
  expediees: number;
  livrees: number;
  litres: number;
  lots: { id: number; code: string }[];
  dernierDepart: string | null;
}

export interface LigneExpedition {
  id: number;
  lotConditionneId: number;
  quantiteUnites: number;
  mouvementId: number | null;
  stockUnites: number;
  litres: number;
  poidsNetKg: number;
  cartons: number | null;
  cartonIncomplet: boolean;
  lotConditionne: {
    id: number;
    code: string;
    dluo: string | null;
    format: { id: number; nom: string; contenanceMl: number; unitesParCarton: number | null };
    lotVrac: { id: number; code: string; categorieVisee: CategorieHuile; statutQualite: StatutQualite; bloque: boolean };
  };
}

export interface Expedition {
  id: number;
  code: string;
  statut: StatutExpedition;
  clientId: number;
  client: { id: number; code: string; raisonSociale: string; pays: string; ville: string | null };
  paysDestination: string;
  adresseLivraison: string | null;
  datePrevue: string;
  dateDepart: string | null;
  dateLivraison: string | null;
  incoterm: string | null;
  lieuIncoterm: string | null;
  modeTransport: ModeTransport;
  transporteur: string | null;
  navire: string | null;
  portChargement: string | null;
  portDechargement: string | null;
  numeroConteneur: string | null;
  numeroPlomb: string | null;
  numeroConnaissement: string | null;
  numeroCommande: string | null;
  numeroFacture: string | null;
  nombrePalettes: number | null;
  poidsBrutKg: number | null;
  notes: string | null;
  user: { id: number; nom: string } | null;
  lignes: LigneExpedition[];
}

export interface FicheExpedition extends Expedition {
  ue: boolean;
  totaux: { unites: number; litres: number; poidsNetKg: number; cartons: number | null };
  controle: { autorise: boolean; blocages: string[]; avertissements: string[] };
  conformiteEditable: boolean;
  blocagesConformite: string[];
}

/** Pays de l'Union européenne, destination prioritaire. */
export const PAYS_UE = new Set([
  "AT", "BE", "BG", "CY", "CZ", "DE", "DK", "EE", "ES", "FI", "FR", "GR", "HR", "HU",
  "IE", "IT", "LT", "LU", "LV", "MT", "NL", "PL", "PT", "RO", "SE", "SI", "SK",
]);

const NOMS_PAYS = new Intl.DisplayNames(["fr"], { type: "region" });

export function nomPays(code: string): string {
  try {
    return NOMS_PAYS.of(code) ?? code;
  } catch {
    return code;
  }
}

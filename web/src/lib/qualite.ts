// Types et libellés du contrôle qualité (voir api/src/qualite).
import type { Role } from "./roles";

/** Rôles qui gèrent les critères et les non-conformités (mêmes droits que l'API). */
export const ROLES_QUALITE: Role[] = ["DIRECTION", "QUALITE"];

export type CategorieHuile = "EXTRA_VIERGE" | "VIERGE" | "LAMPANTE";
export type StatutQualite = "NON_ANALYSE" | "CONFORME" | "INCOMPLET" | "NON_CONFORME";
export type StatutNonConformite = "OUVERTE" | "EN_TRAITEMENT" | "CLOTUREE";
export type DecisionNonConformite =
  | "CONTRE_ANALYSE_CONFORME"
  | "DECLASSEMENT"
  | "ASSEMBLAGE_CORRECTIF"
  | "DEROGATION"
  | "DESTRUCTION"
  | "AUTRE";
export type ParametreAnalyse =
  | "ACIDITE"
  | "PEROXYDE"
  | "K232"
  | "K270"
  | "DELTA_K"
  | "POLYPHENOLS"
  | "ESTERS_ETHYLIQUES"
  | "MEDIANE_DEFAUT"
  | "MEDIANE_FRUITE";

export const CATEGORIES: Record<CategorieHuile, string> = {
  EXTRA_VIERGE: "Extra vierge",
  VIERGE: "Vierge",
  LAMPANTE: "Lampante",
};

export const STATUTS_QUALITE: Record<StatutQualite, string> = {
  NON_ANALYSE: "Non analysé",
  CONFORME: "Conforme",
  INCOMPLET: "Analyse partielle",
  NON_CONFORME: "Non conforme",
};

export const STATUTS_NC: Record<StatutNonConformite, string> = {
  OUVERTE: "Ouverte",
  EN_TRAITEMENT: "En traitement",
  CLOTUREE: "Clôturée",
};

export const DECISIONS_NC: Record<DecisionNonConformite, string> = {
  CONTRE_ANALYSE_CONFORME: "Contre-analyse conforme",
  DECLASSEMENT: "Déclassement",
  ASSEMBLAGE_CORRECTIF: "Assemblage correctif",
  DEROGATION: "Dérogation (acceptée en l'état)",
  DESTRUCTION: "Destruction",
  AUTRE: "Autre",
};

export const PARAMETRES: Record<ParametreAnalyse, { libelle: string; unite: string; step: string }> = {
  ACIDITE: { libelle: "Acidité", unite: "%", step: "0.01" },
  PEROXYDE: { libelle: "Indice de peroxyde", unite: "meq O2/kg", step: "0.1" },
  K232: { libelle: "K232", unite: "", step: "0.01" },
  K270: { libelle: "K270", unite: "", step: "0.01" },
  DELTA_K: { libelle: "ΔK", unite: "", step: "0.001" },
  POLYPHENOLS: { libelle: "Polyphénols", unite: "mg/kg", step: "1" },
  ESTERS_ETHYLIQUES: { libelle: "Esters éthyliques", unite: "mg/kg", step: "0.1" },
  MEDIANE_DEFAUT: { libelle: "Médiane du défaut", unite: "", step: "0.1" },
  MEDIANE_FRUITE: { libelle: "Médiane du fruité", unite: "", step: "0.1" },
};

export interface Ecart {
  parametre: ParametreAnalyse;
  valeur: number;
  min: number | null;
  max: number | null;
}

export interface NonConformite {
  id: number;
  code: string;
  description: string;
  statut: StatutNonConformite;
  decision: DecisionNonConformite | null;
  actionCorrective: string | null;
  createdAt: string;
  clotureeLe: string | null;
  lot?: { id: number; code: string; categorieVisee: CategorieHuile; bloque: boolean };
  analyse?: { id: number; dateAnalyse: string; reference: string | null; categorie: CategorieHuile | null } | null;
  ouvertePar: { nom: string } | null;
  clotureePar: { nom: string } | null;
}

export interface Specification {
  id: number;
  code: string;
  nom: string;
  categorie: CategorieHuile | null;
  actif: boolean;
  client: { id: number; code: string; raisonSociale: string } | null;
  criteres: { parametre: ParametreAnalyse; min: string | null; max: string | null }[];
}

export interface ControleExpedition {
  autorise: boolean;
  blocages: string[];
  avertissements: string[];
}

function nombre(valeur: number | string): string {
  return Number(valeur).toLocaleString("fr-FR");
}

/** Limites d'un critère : « ≤ 0,8 % », « ≥ 250 mg/kg », « 0,1 à 3,5 ». */
export function limites(min: number | string | null, max: number | string | null, unite = ""): string {
  const u = unite ? ` ${unite}` : "";
  if (min !== null && max !== null) return `${nombre(min)} à ${nombre(max)}${u}`;
  if (max !== null) return `≤ ${nombre(max)}${u}`;
  if (min !== null) return `≥ ${nombre(min)}${u}`;
  return "—";
}

/** « Acidité 1,2 % (≤ 0,8 %) » */
export function decrireEcart(e: Ecart): string {
  const { libelle, unite } = PARAMETRES[e.parametre];
  return `${libelle} ${nombre(e.valeur)}${unite ? ` ${unite}` : ""} (${limites(e.min, e.max, unite)})`;
}

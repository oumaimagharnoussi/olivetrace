// Types et libellés de l'intelligence artificielle (voir api/src/ia).

export type Fiabilite = "FAIBLE" | "MOYENNE" | "BONNE";

export const FIABILITES: Record<Fiabilite, { libelle: string; classe: string }> = {
  FAIBLE: { libelle: "Fiabilité faible", classe: "bg-stone-100 text-stone-600" },
  MOYENNE: { libelle: "Fiabilité moyenne", classe: "bg-amber-50 text-amber-800" },
  BONNE: { libelle: "Fiabilité bonne", classe: "bg-olive-100 text-olive-800" },
};

export interface ParametrePrevu {
  parametre: string;
  libelle: string;
  unite: string;
  prevision: { valeur: number; basse: number; haute: number; n: number; fiabilite: Fiabilite } | null;
  limite: { min: number | null; max: number | null } | null;
  risque: number | null;
}

export interface PrevisionHuilerie {
  huilerie: { id: number; nom: string; code?: string };
  lotsAnalyses: number;
  lotsAnalysesTotal: number;
  tauxConformite: number | null;
  risqueNonConforme: number | null;
  parametres: ParametrePrevu[];
}

export interface Evolution {
  horizonJours: number;
  vitesses: { parametre: string; libelle: string; unite: string; lots: number; parJour: number | null; parMois: number | null }[];
  lots: {
    lot: { id: number; code: string };
    stockKg: number;
    derniereAnalyse: string;
    joursDepuisAnalyse: number;
    parametres: { parametre: string; libelle: string; mesure: number; estimee: number; max: number | null; joursAvantLimite: number | null }[];
    joursAvantLimite: number | null;
    alerte: boolean;
  }[];
}

export interface Recommandations {
  client: { id: number; raisonSociale: string; pays: string };
  cahiersDesCharges: string[];
  lots: {
    lot: { id: number; code: string; variete: string | null; huilerie: string | null };
    stockKg: number;
    joursEnStock: number;
    marge: number | null;
    autorise: boolean;
    blocages: string[];
    score: number;
    raisons: string[];
  }[];
  formats: {
    base: "CLIENT" | "PAYS" | "TOUS" | "AUCUN";
    liste: { format: { id: number; code: string; nom: string; contenanceMl: number }; unites: number; litres: number; part: number }[];
  };
}

export interface Anomalies {
  jours: number;
  historique: { analyses: number; receptions: number; filtrations: number; minimum: number };
  anomalies: {
    type: "ANALYSE" | "RECEPTION" | "FILTRATION" | "CONDITIONNEMENT" | "DATE";
    niveau: "ALERTE" | "INFO";
    date: string;
    lien: { type: "lot" | "conditionnement"; id: number; code: string };
    message: string;
  }[];
}

export const TYPES_ANOMALIE: Record<Anomalies["anomalies"][number]["type"], string> = {
  ANALYSE: "Analyse",
  RECEPTION: "Réception",
  FILTRATION: "Filtration",
  CONDITIONNEMENT: "Mise en bouteille",
  DATE: "Date",
};

export function pourcent(valeur: number | null | undefined, decimales = 0): string {
  return valeur == null ? "–" : `${(valeur * 100).toLocaleString("fr-FR", { maximumFractionDigits: decimales })} %`;
}

/** Valeur d'un paramètre, arrondie selon son ordre de grandeur. */
export function valeur(v: number, unite = ""): string {
  const decimales = Math.abs(v) >= 100 ? 0 : Math.abs(v) >= 10 ? 1 : Math.abs(v) >= 1 ? 2 : 3;
  return `${v.toLocaleString("fr-FR", { maximumFractionDigits: decimales })}${unite ? ` ${unite}` : ""}`;
}

/** Couleur d'un risque : vert sous 10 %, ambre jusqu'à 30 %, rouge au-delà. */
export function classeRisque(risque: number | null): string {
  if (risque == null) return "text-stone-500";
  return risque >= 0.3 ? "text-red-700" : risque >= 0.1 ? "text-amber-700" : "text-olive-800";
}

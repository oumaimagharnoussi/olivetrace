// Types du tableau de bord et des rapports (voir api/src/tableau-de-bord).
import type { Alerte } from "./vrac";
import type { Role } from "./roles";
import type { StatutExpedition } from "./export";

/** Rôles qui voient les rapports (mêmes droits que l'API). */
export const ROLES_RAPPORTS: Role[] = ["DIRECTION"];

export interface EtatTableauDeBord {
  indicateurs: {
    lotsActifs: number;
    lotsConditionnesEnStock: number;
    stockVracKg: number;
    capaciteKg: number;
    tauxRemplissage: number;
    cuvesVides: number;
    cuves: number;
    produitsFinisUnites: number;
    produitsFinisLitres: number;
    nonConformitesOuvertes: number;
    lotsBloques: number;
    expeditionsEnCours: number;
  };
  cuves: {
    id: number;
    code: string;
    type: string;
    capaciteKg: number;
    quantiteKg: number;
    tauxRemplissage: number;
    lot: { id: number; code: string; variete: string | null; joursEnStock: number } | null;
  }[];
  produitsFinis: { format: { id: number; code: string; nom: string }; unites: number; litres: number; lots: number }[];
  qualite: { lotsEnStock: number; conformes: number; incomplets: number; nonConformes: number; sansAnalyse: number; bloques: number };
  alertes: Alerte[];
  nonConformites: { id: number; code: string; statut: string; description: string; createdAt: string; lot: { id: number; code: string } }[];
  expeditions: {
    id: number;
    code: string;
    statut: StatutExpedition;
    paysDestination: string;
    datePrevue: string;
    dateDepart: string | null;
    client: { id: number; code: string; raisonSociale: string };
    unites: number;
    litres: number;
  }[];
  expeditionsParPays: { cle: string; expeditions: number; unites: number; litres: number }[];
}

export interface PointMensuel {
  mois: string;
  valeur: number;
}

export interface Rapports {
  du: string;
  au: string;
  volumes: {
    recuKg: number;
    lotsRecus: number;
    venduVracKg: number;
    filtreKg: number;
    conditionneKg: number;
    conditionneUnites: number;
    exporteLitres: number;
    exporteUnites: number;
    expeditions: number;
    pertesKg: number;
  };
  receptionsParHuilerie: { cle: string; kg: number; lots: number }[];
  receptionsParVariete: { cle: string; kg: number; lots: number }[];
  receptionsParMois: PointMensuel[];
  ventesVracParClient: { cle: string; kg: number }[];
  conditionnementParFormat: { cle: string; unites: number; litres: number; kg: number }[];
  conditionnementParMois: PointMensuel[];
  exportsParPays: { cle: string; expeditions: number; unites: number; litres: number }[];
  exportsParClient: { cle: string; expeditions: number; litres: number }[];
  exportsParMois: PointMensuel[];
}

const MOIS = new Intl.DateTimeFormat("fr-FR", { month: "short", year: "2-digit", timeZone: "UTC" });

/** « 2026-10 » devient « oct. 26 ». */
export function libelleMois(mois: string): string {
  return MOIS.format(new Date(`${mois}-01T00:00:00Z`));
}

export function litresTexte(valeur: number): string {
  return `${valeur.toLocaleString("fr-FR", { maximumFractionDigits: 1 })} L`;
}

export function entier(valeur: number): string {
  return valeur.toLocaleString("fr-FR");
}

/** Télécharge un tableau en CSV (séparateur « ; » et BOM pour qu'Excel l'ouvre correctement en français). */
export function telechargerCsv(nomFichier: string, entetes: string[], lignes: (string | number)[][]) {
  const cellule = (v: string | number) => {
    const t = typeof v === "number" ? v.toLocaleString("fr-FR", { useGrouping: false }) : v;
    return /[;"\n]/.test(t) ? `"${t.replace(/"/g, '""')}"` : t;
  };
  const contenu = [entetes, ...lignes].map((l) => l.map(cellule).join(";")).join("\r\n");
  const url = URL.createObjectURL(new Blob(["﻿" + contenu], { type: "text/csv;charset=utf-8" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = nomFichier;
  a.click();
  URL.revokeObjectURL(url);
}

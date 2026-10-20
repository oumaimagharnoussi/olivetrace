"use client";

import Link from "next/link";
import { useState } from "react";
import { TableauNonConformites } from "@/components/qualite/NonConformites";
import { Carte, Erreur } from "@/components/vrac/ui";
import { type NonConformite } from "@/lib/qualite";
import { useApi } from "@/lib/useApi";
import { kg } from "@/lib/vrac";

interface AlertesQualite {
  ageMaxAnalyseJours: number;
  compteurs: {
    lotsEnStock: number;
    conformes: number;
    incomplets: number;
    nonConformes: number;
    sansAnalyse: number;
    bloques: number;
    nonConformitesOuvertes: number;
  };
  alertes: { niveau: "ALERTE" | "INFO"; type: string; lotId: number; lotCode: string; quantiteKg: number; message: string }[];
}

export default function QualitePage() {
  const [toutes, setToutes] = useState(false);
  const alertes = useApi<AlertesQualite>("/qualite/alertes");
  const ncs = useApi<NonConformite[]>(`/qualite/non-conformites${toutes ? "" : "?ouvertes=true"}`);
  const c = alertes.data?.compteurs;

  const tuiles: [string, number | undefined, string][] = [
    ["Lots en stock", c?.lotsEnStock, "text-stone-900"],
    ["Conformes", c?.conformes, "text-olive-800"],
    ["Analyse partielle", c?.incomplets, "text-amber-700"],
    ["Non conformes", c?.nonConformes, "text-red-700"],
    ["Sans analyse", c?.sansAnalyse, "text-stone-600"],
    ["Lots bloqués", c?.bloques, "text-red-700"],
    ["Non-conformités ouvertes", c?.nonConformitesOuvertes, "text-red-700"],
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold text-stone-900">Contrôle qualité</h1>
        <Link href="/qualite/criteres" className="btn-secondary">
          Critères de qualité
        </Link>
      </div>

      <Erreur message={alertes.erreur ?? ncs.erreur} />

      <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-7">
        {tuiles.map(([label, valeur, couleur]) => (
          <div key={label} className="rounded-lg border border-stone-200 bg-white p-4">
            <div className="text-xs text-stone-500">{label}</div>
            <div className={`mt-1 text-2xl font-semibold ${couleur}`}>{valeur ?? "…"}</div>
          </div>
        ))}
      </div>

      <Carte titre={`Alertes${alertes.data ? ` (${alertes.data.alertes.length})` : ""}`}>
        {alertes.data?.alertes.length === 0 ? (
          <p className="text-sm text-stone-500">Aucune alerte qualité sur les lots en stock.</p>
        ) : (
          <ul className="space-y-2 text-sm">
            {alertes.data?.alertes.map((a, i) => (
              <li key={i} className="flex flex-wrap items-baseline gap-2">
                <span
                  className={`rounded px-1.5 py-0.5 text-xs font-medium ${a.niveau === "ALERTE" ? "bg-red-100 text-red-800" : "bg-stone-100 text-stone-600"}`}
                >
                  {a.niveau === "ALERTE" ? "Alerte" : "Info"}
                </span>
                <Link href={`/lots/${a.lotId}`} className="text-olive-700 hover:underline">
                  {a.message}
                </Link>
                <span className="text-stone-500">({kg(a.quantiteKg)} en stock)</span>
              </li>
            ))}
          </ul>
        )}
      </Carte>

      <Carte
        titre="Non-conformités"
        actions={
          <label className="flex items-center gap-2 text-sm text-stone-600">
            <input type="checkbox" checked={toutes} onChange={(e) => setToutes(e.target.checked)} />
            Afficher les non-conformités clôturées
          </label>
        }
      >
        <TableauNonConformites
          nonConformites={ncs.data ?? []}
          onModifie={() => {
            ncs.recharger();
            alertes.recharger();
          }}
        />
        <p className="mt-3 text-sm text-stone-500">
          Une analyse non conforme ouvre automatiquement une non-conformité. Pour en déclarer une autre (odeur, contamination…), ouvrez la fiche du lot.
        </p>
      </Carte>
    </div>
  );
}

"use client";

import Link from "next/link";
import { Carte, Erreur } from "@/components/vrac/ui";
import { TYPE_STOCKAGE } from "@/lib/ressources";
import { useApi } from "@/lib/useApi";
import { type Alerte, type Cuve, date, kg } from "@/lib/vrac";

export default function StockPage() {
  const cuves = useApi<Cuve[]>("/stock");
  const alertes = useApi<{ dureeMaxJours: number; alertes: Alerte[] }>("/stock/alertes");

  const total = cuves.data?.reduce((s, c) => s + c.quantiteKg, 0) ?? 0;
  const capacite = cuves.data?.reduce((s, c) => s + c.capaciteKg, 0) ?? 0;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-stone-900">Stock en cuves</h1>
        {cuves.data && (
          <p className="text-stone-500">
            {kg(total)} en stock pour {kg(capacite)} de capacité ({cuves.data.filter((c) => !c.lot).length} cuve(s) vide(s)).
          </p>
        )}
      </div>
      <Erreur message={cuves.erreur ?? alertes.erreur} />

      {alertes.data && alertes.data.alertes.length > 0 && (
        <Carte titre={`Alertes (${alertes.data.alertes.length})`}>
          <ul className="space-y-2 text-sm">
            {alertes.data.alertes.map((a, i) => (
              <li key={i} className="flex items-start gap-2">
                <span
                  className={`mt-0.5 rounded-full px-2 py-0.5 text-xs ${
                    a.niveau === "ALERTE" ? "bg-red-100 text-red-700" : "bg-amber-100 text-amber-800"
                  }`}
                >
                  {a.niveau === "ALERTE" ? "Alerte" : "À faire"}
                </span>
                <Link href={a.lien ?? `/lots/${a.lotId}`} className="text-stone-800 hover:underline">
                  {a.message}
                </Link>
              </li>
            ))}
          </ul>
        </Carte>
      )}

      {!cuves.data ? (
        <p className="text-stone-500">Chargement…</p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {cuves.data.map((c) => (
            <div key={c.id} className="rounded-lg border border-stone-200 bg-white p-4">
              <div className="flex items-baseline justify-between">
                <span className="text-lg font-semibold text-stone-900">{c.code}</span>
                <span className="text-xs text-stone-500">{TYPE_STOCKAGE[c.type] ?? c.type}</span>
              </div>
              <div className="mt-3 h-3 overflow-hidden rounded-full bg-stone-100">
                <div className="h-full rounded-full bg-olive-600" style={{ width: `${Math.min(c.tauxRemplissage, 100)}%` }} />
              </div>
              <div className="mt-1 flex justify-between text-xs text-stone-500">
                <span>{kg(c.quantiteKg)}</span>
                <span>
                  {c.tauxRemplissage.toLocaleString("fr-FR")} % de {kg(c.capaciteKg)}
                </span>
              </div>
              {c.lot ? (
                <div className="mt-3 space-y-0.5 text-sm">
                  <Link href={`/lots/${c.lot.id}`} className="font-medium text-olive-700 hover:underline">
                    {c.lot.code}
                  </Link>
                  <div className="text-stone-600">
                    {c.lot.variete ?? "Assemblage"} · {c.lot.huilerie ?? "plusieurs huileries"}
                  </div>
                  <div className="text-stone-500">
                    Reçu le {date(c.lot.dateReception)} ({c.lot.joursEnStock} j)
                  </div>
                </div>
              ) : (
                <div className="mt-3 text-sm text-stone-400">Vide</div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

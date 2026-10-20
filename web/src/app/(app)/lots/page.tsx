"use client";

import Link from "next/link";
import { useState } from "react";
import { FormulaireReception } from "@/components/vrac/FormulaireReception";
import { Carte, Erreur, Tableau, td } from "@/components/vrac/ui";
import { useAuth } from "@/lib/auth";
import { useApi } from "@/lib/useApi";
import { type Lot, ROLES_STOCK, date, kg, nombre } from "@/lib/vrac";

export default function LotsPage() {
  const { can } = useAuth();
  const [enStock, setEnStock] = useState(true);
  const [reception, setReception] = useState(false);
  const lots = useApi<Lot[]>(`/lots${enStock ? "?enStock=true" : ""}`);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold text-stone-900">Lots</h1>
        {can(ROLES_STOCK) && !reception && (
          <button onClick={() => setReception(true)} className="btn-primary">
            Nouvelle réception
          </button>
        )}
      </div>

      {reception && (
        <FormulaireReception
          onAnnuler={() => setReception(false)}
          onEnregistre={() => {
            setReception(false);
            lots.recharger();
          }}
        />
      )}

      <Erreur message={lots.erreur} />

      <Carte
        titre={lots.data ? `${lots.data.length} lot${lots.data.length > 1 ? "s" : ""}` : "Lots"}
        actions={
          <label className="flex items-center gap-2 text-sm text-stone-600">
            <input type="checkbox" checked={!enStock} onChange={(e) => setEnStock(!e.target.checked)} />
            Afficher les lots épuisés
          </label>
        }
      >
        <Tableau
          entetes={["Lot", "Origine", "Huilerie", "Variété", "Campagne", "Reçu le", "Reçu", "En stock", "Acidité"]}
          vide={lots.data?.length === 0}
        >
          {lots.data?.map((l) => (
            <tr key={l.id}>
              <td className={td}>
                <Link href={`/lots/${l.id}`} className="font-medium text-olive-700 hover:underline">
                  {l.code}
                </Link>
              </td>
              <td className={td}>{l.origine === "ASSEMBLAGE" ? "Assemblage" : "Réception"}</td>
              <td className={td}>{l.huilerie?.nom ?? "—"}</td>
              <td className={td}>{l.variete?.nom ?? "—"}</td>
              <td className={td}>{l.campagne ?? "—"}</td>
              <td className={td}>{date(l.dateReception)}</td>
              <td className={td}>{kg(l.quantiteInitialeKg)}</td>
              <td className={td}>{l.stockKg > 0 ? kg(l.stockKg) : <span className="text-stone-400">Épuisé</span>}</td>
              <td className={td}>{l.derniereAnalyse?.acidite != null ? `${nombre(l.derniereAnalyse.acidite)} %` : "—"}</td>
            </tr>
          ))}
        </Tableau>
      </Carte>
    </div>
  );
}

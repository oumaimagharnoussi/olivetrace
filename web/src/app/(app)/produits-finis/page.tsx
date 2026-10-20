"use client";

import Link from "next/link";
import { useState } from "react";
import { FormulaireMouvementProduit } from "@/components/conditionnement/Formulaires";
import { TableauMouvements } from "@/components/conditionnement/TableauMouvements";
import { Carte, Erreur, Succes, Tableau, td } from "@/components/vrac/ui";
import { useAuth } from "@/lib/auth";
import {
  type MouvementProduit,
  ROLES_PRODUITS_FINIS,
  type StockProduitsFinis,
  litres,
  unites,
} from "@/lib/conditionnement";
import { useApi } from "@/lib/useApi";
import { date } from "@/lib/vrac";

export default function ProduitsFinisPage() {
  const { can } = useAuth();
  const [saisie, setSaisie] = useState(false);
  const [succes, setSucces] = useState<string | null>(null);
  const stock = useApi<StockProduitsFinis>("/produits-finis");
  const mouvements = useApi<MouvementProduit[]>("/produits-finis/mouvements");

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold text-stone-900">Produits finis</h1>
        {can(ROLES_PRODUITS_FINIS) && !saisie && (
          <button
            className="btn-primary"
            onClick={() => {
              setSaisie(true);
              setSucces(null);
            }}
          >
            Expédition, casse ou ajustement
          </button>
        )}
      </div>

      <Succes message={succes} />
      <Erreur message={stock.erreur ?? mouvements.erreur} />

      {saisie && stock.data && (
        <Carte titre="Mouvement de produits finis">
          <FormulaireMouvementProduit
            lots={stock.data.lots}
            onAnnuler={() => setSaisie(false)}
            onFin={(message) => {
              setSaisie(false);
              setSucces(message);
              stock.recharger();
              mouvements.recharger();
            }}
          />
        </Carte>
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {stock.data?.parFormat.map((f) => (
          <div key={f.format.id} className="rounded-lg border border-stone-200 bg-white p-5">
            <div className="text-sm text-stone-500">{f.format.nom}</div>
            <div className="mt-1 text-3xl font-semibold text-olive-800">{unites(f.unites)}</div>
            <div className="text-sm text-stone-500">
              {litres(f.litres)} · {f.lots} lot{f.lots > 1 ? "s" : ""}
              {f.format.unitesParCarton ? ` · ${unites(Math.floor(f.unites / f.format.unitesParCarton))} cartons` : ""}
            </div>
          </div>
        ))}
        {stock.data?.parFormat.length === 0 && <p className="text-stone-500">Aucun produit fini en stock.</p>}
      </div>

      <Carte titre="Lots en stock">
        <Tableau entetes={["N° de lot", "Format", "Lot vrac", "Mis en bouteille le", "DLUO", "Destination", "En stock", "Volume"]} vide={stock.data?.lots.length === 0}>
          {stock.data?.lots.map((l) => (
            <tr key={l.id}>
              <td className={td}>
                <Link href={`/conditionnement/${l.id}`} className="font-medium text-olive-700 hover:underline">
                  {l.code}
                </Link>
              </td>
              <td className={td}>{l.format.nom}</td>
              <td className={td}>
                <Link href={`/lots/${l.lotVrac.id}`} className="text-olive-700 hover:underline">
                  {l.lotVrac.code}
                </Link>
              </td>
              <td className={td}>{date(l.operation.date)}</td>
              <td className={td}>{date(l.dluo)}</td>
              <td className={td}>{[l.client?.raisonSociale, l.paysDestination, l.destination].filter(Boolean).join(" · ") || "—"}</td>
              <td className={td}>{unites(l.stockUnites)}</td>
              <td className={td}>{litres((l.stockUnites * l.format.contenanceMl) / 1000)}</td>
            </tr>
          ))}
        </Tableau>
      </Carte>

      <Carte titre="Journal des mouvements">
        <TableauMouvements mouvements={mouvements.data} />
      </Carte>
    </div>
  );
}

"use client";

import Link from "next/link";
import { useState } from "react";
import { FormulaireConditionnement } from "@/components/conditionnement/Formulaires";
import { Carte, Erreur, Succes, Tableau, td } from "@/components/vrac/ui";
import { useAuth } from "@/lib/auth";
import { type LotConditionne, ROLES_PRODUCTION, litres, unites } from "@/lib/conditionnement";
import { useApi } from "@/lib/useApi";
import { type Cuve, date, kg } from "@/lib/vrac";

export default function ConditionnementPage() {
  const { can } = useAuth();
  const [saisie, setSaisie] = useState(false);
  const [succes, setSucces] = useState<string | null>(null);
  const cuves = useApi<Cuve[]>("/stock");
  const lots = useApi<LotConditionne[]>("/conditionnements");

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-stone-900">Mise en bouteille</h1>
          <p className="text-stone-500">Chaque mise en bouteille crée un lot conditionné, avec le numéro de lot imprimé sur l&apos;étiquette.</p>
        </div>
        {can(ROLES_PRODUCTION) && !saisie && (
          <button
            className="btn-primary"
            onClick={() => {
              setSaisie(true);
              setSucces(null);
            }}
          >
            Nouvelle mise en bouteille
          </button>
        )}
      </div>

      <Succes message={succes} />
      <Erreur message={cuves.erreur ?? lots.erreur} />

      {saisie && cuves.data && (
        <Carte titre="Nouvelle mise en bouteille">
          <FormulaireConditionnement
            cuves={cuves.data}
            onAnnuler={() => setSaisie(false)}
            onFin={(message) => {
              setSaisie(false);
              setSucces(message);
              cuves.recharger();
              lots.recharger();
            }}
          />
        </Carte>
      )}

      <Carte titre="Lots conditionnés">
        <Tableau
          entetes={["Date", "N° de lot", "Lot vrac", "Format", "Unités", "Volume", "Huile", "DLUO", "Destination", "En stock"]}
          vide={lots.data?.length === 0}
        >
          {lots.data?.map((l) => (
            <tr key={l.id}>
              <td className={td}>{date(l.operation.date)}</td>
              <td className={td}>
                <Link href={`/conditionnement/${l.id}`} className="font-medium text-olive-700 hover:underline">
                  {l.code}
                </Link>
              </td>
              <td className={td}>
                <Link href={`/lots/${l.lotVrac.id}`} className="text-olive-700 hover:underline">
                  {l.lotVrac.code}
                </Link>
              </td>
              <td className={td}>{l.format.nom}</td>
              <td className={td}>{unites(l.nombreUnites)}</td>
              <td className={td}>{litres(l.litres)}</td>
              <td className={td}>{kg(l.quantiteKg)}</td>
              <td className={td}>{date(l.dluo)}</td>
              <td className={td}>{[l.client?.raisonSociale, l.paysDestination, l.destination].filter(Boolean).join(" · ") || "—"}</td>
              <td className={td}>{unites(l.stockUnites)}</td>
            </tr>
          ))}
        </Tableau>
      </Carte>
    </div>
  );
}

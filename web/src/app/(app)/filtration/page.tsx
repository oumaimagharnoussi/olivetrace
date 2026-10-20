"use client";

import Link from "next/link";
import { useState } from "react";
import { FormulaireFiltration } from "@/components/conditionnement/Formulaires";
import { BadgeQualite } from "@/components/qualite/Badges";
import { Carte, Erreur, Succes, Tableau, td } from "@/components/vrac/ui";
import { useAuth } from "@/lib/auth";
import { type Filtration, ROLES_PRODUCTION } from "@/lib/conditionnement";
import { useApi } from "@/lib/useApi";
import { type Cuve, date, kg, nombre } from "@/lib/vrac";

export default function FiltrationPage() {
  const { can } = useAuth();
  const [saisie, setSaisie] = useState(false);
  const [succes, setSucces] = useState<string | null>(null);
  const cuves = useApi<Cuve[]>("/stock");
  const filtrations = useApi<Filtration[]>("/filtrations");

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-stone-900">Filtration</h1>
          <p className="text-stone-500">Seul un lot analysé, conforme et non bloqué peut être filtré. L&apos;huile filtrée forme un nouveau lot.</p>
        </div>
        {can(ROLES_PRODUCTION) && !saisie && (
          <button
            className="btn-primary"
            onClick={() => {
              setSaisie(true);
              setSucces(null);
            }}
          >
            Nouvelle filtration
          </button>
        )}
      </div>

      <Succes message={succes} />
      <Erreur message={cuves.erreur ?? filtrations.erreur} />

      {saisie && cuves.data && (
        <Carte titre="Nouvelle filtration">
          <FormulaireFiltration
            cuves={cuves.data}
            onAnnuler={() => setSaisie(false)}
            onFin={(message) => {
              setSaisie(false);
              setSucces(message);
              cuves.recharger();
              filtrations.recharger();
            }}
          />
        </Carte>
      )}

      <Carte titre="Filtrations">
        <Tableau
          entetes={["Date", "N°", "Lot filtré", "Cuves", "Entrée", "Sortie", "Perte", "Paramètres", "Opérateur", "Lot obtenu"]}
          vide={filtrations.data?.length === 0}
        >
          {filtrations.data?.map((f) => {
            const perte = f.quantiteEntreeKg - f.quantiteSortieKg;
            const depart = f.operation.mouvements.find((m) => m.quantiteKg < 0)?.stockage.code;
            const arrivee = f.operation.mouvements.find((m) => m.quantiteKg > 0)?.stockage.code;
            const parametres = [
              f.typeFiltre,
              f.porositeMicrons && `${nombre(f.porositeMicrons)} µm`,
              f.pressionBar && `${nombre(f.pressionBar)} bar`,
              f.temperatureC && `${nombre(f.temperatureC)} °C`,
              f.debitLh && `${nombre(f.debitLh)} L/h`,
              f.dureeMinutes && `${f.dureeMinutes} min`,
            ].filter(Boolean);
            return (
              <tr key={f.id}>
                <td className={td}>{date(f.operation.date)}</td>
                <td className={`${td} whitespace-nowrap`}>{f.code}</td>
                <td className={`${td} whitespace-nowrap`}>
                  <Link href={`/lots/${f.lotEntree.id}`} className="text-olive-700 hover:underline">
                    {f.lotEntree.code}
                  </Link>
                </td>
                <td className={`${td} whitespace-nowrap`}>
                  {depart} → {arrivee}
                </td>
                <td className={`${td} whitespace-nowrap`}>{kg(f.quantiteEntreeKg)}</td>
                <td className={`${td} whitespace-nowrap`}>{kg(f.quantiteSortieKg)}</td>
                <td className={`${td} whitespace-nowrap`}>
                  {kg(perte)} ({((perte / f.quantiteEntreeKg) * 100).toLocaleString("fr-FR", { maximumFractionDigits: 1 })} %)
                </td>
                <td className={td}>{parametres.join(" · ") || "—"}</td>
                <td className={td}>{f.operateur}</td>
                <td className={td}>
                  <div className="flex flex-wrap items-center gap-2">
                    <Link href={`/lots/${f.lotSortie.id}`} className="text-olive-700 hover:underline">
                      {f.lotSortie.code}
                    </Link>
                    <BadgeQualite statut={f.lotSortie.statutQualite} bloque={f.lotSortie.bloque} />
                  </div>
                </td>
              </tr>
            );
          })}
        </Tableau>
      </Carte>
    </div>
  );
}

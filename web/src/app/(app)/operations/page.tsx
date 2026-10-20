"use client";

import Link from "next/link";
import { useState } from "react";
import { FormulaireAssemblage, FormulaireSortie, FormulaireTransfert } from "@/components/vrac/FormulairesOperations";
import { Carte, Erreur, Succes, Tableau, td } from "@/components/vrac/ui";
import { useAuth } from "@/lib/auth";
import { useApi } from "@/lib/useApi";
import { type Cuve, MOTIFS_SORTIE, type Operation, ROLES_STOCK, TYPES_OPERATION, date, kg } from "@/lib/vrac";

const ONGLETS = { transfert: "Transfert", assemblage: "Assemblage", sortie: "Sortie de stock" } as const;
type Onglet = keyof typeof ONGLETS;

export default function OperationsPage() {
  const { can } = useAuth();
  const [onglet, setOnglet] = useState<Onglet | null>(null);
  const [succes, setSucces] = useState<string | null>(null);
  const cuves = useApi<Cuve[]>("/stock");
  const operations = useApi<Operation[]>("/operations");

  const fin = (message: string) => {
    setOnglet(null);
    setSucces(message);
    cuves.recharger();
    operations.recharger();
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold text-stone-900">Opérations de stock</h1>
        {can(ROLES_STOCK) && (
          <div className="flex flex-wrap gap-2">
            {(Object.keys(ONGLETS) as Onglet[]).map((o) => (
              <button
                key={o}
                onClick={() => {
                  setOnglet(o);
                  setSucces(null);
                }}
                className={onglet === o ? "btn-primary" : "btn-secondary"}
              >
                {ONGLETS[o]}
              </button>
            ))}
          </div>
        )}
      </div>

      <Succes message={succes} />
      <Erreur message={cuves.erreur ?? operations.erreur} />

      {onglet && cuves.data && (
        <Carte titre={ONGLETS[onglet]}>
          {onglet === "transfert" && <FormulaireTransfert cuves={cuves.data} onAnnuler={() => setOnglet(null)} onFin={fin} />}
          {onglet === "assemblage" && <FormulaireAssemblage cuves={cuves.data} onAnnuler={() => setOnglet(null)} onFin={fin} />}
          {onglet === "sortie" && <FormulaireSortie cuves={cuves.data} onAnnuler={() => setOnglet(null)} onFin={fin} />}
        </Carte>
      )}

      <Carte titre="Journal des opérations">
        <Tableau entetes={["Date", "Opération", "Mouvements", "Détail", "Par"]} vide={operations.data?.length === 0}>
          {operations.data?.map((o) => (
            <tr key={o.id}>
              <td className={td}>{date(o.date)}</td>
              <td className={td}>{TYPES_OPERATION[o.type]}</td>
              <td className={td}>
                <ul>
                  {o.mouvements.map((m) => (
                    <li key={m.id} className="whitespace-nowrap">
                      <Link href={`/lots/${m.lot.id}`} className="text-olive-700 hover:underline">
                        {m.lot.code}
                      </Link>{" "}
                      · {m.stockage.code} : {m.quantiteKg > 0 ? "+" : ""}
                      {kg(m.quantiteKg)}
                    </li>
                  ))}
                </ul>
              </td>
              <td className={td}>
                {[o.motif && MOTIFS_SORTIE[o.motif], o.client?.raisonSociale, o.livraison && `Transport : ${o.livraison.transporteur}`, o.notes]
                  .filter(Boolean)
                  .join(" · ") || "—"}
              </td>
              <td className={td}>{o.user?.nom ?? "—"}</td>
            </tr>
          ))}
        </Tableau>
      </Carte>
    </div>
  );
}

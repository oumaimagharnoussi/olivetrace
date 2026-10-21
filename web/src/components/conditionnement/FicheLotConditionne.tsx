"use client";

import Link from "next/link";
import { useState } from "react";
import { useAuth } from "@/lib/auth";
import { type LotConditionne, type MouvementProduit, ROLES_PRODUITS_FINIS, litres, unites } from "@/lib/conditionnement";
import { CATEGORIES } from "@/lib/qualite";
import { useApi } from "@/lib/useApi";
import { ORIGINES_LOT, type OrigineLot, date, kg } from "@/lib/vrac";
import { ExpeditionsDuLot } from "../export/ExpeditionsDuLot";
import { BadgeQualite } from "../qualite/Badges";
import { Carte, Erreur, Succes, Tableau, td } from "../vrac/ui";
import { FormulaireMouvementProduit } from "./Formulaires";
import { CartePasseport } from "./Passeport";
import { TableauMouvements } from "./TableauMouvements";

interface FicheData extends LotConditionne {
  mouvements: MouvementProduit[];
  ascendance: {
    id: number;
    code: string;
    origine: OrigineLot;
    huilerie: string | null;
    variete: string | null;
    campagne: string | null;
    niveau: number;
  }[];
}

export function FicheLotConditionne({ id }: { id: number }) {
  const { can } = useAuth();
  const { data: lot, erreur, recharger } = useApi<FicheData>(`/conditionnements/${id}`);
  const [saisie, setSaisie] = useState(false);
  const [succes, setSucces] = useState<string | null>(null);

  if (erreur) return <Erreur message={erreur} />;
  if (!lot) return <p className="text-stone-500">Chargement…</p>;

  const cuve = lot.operation.mouvements[0]?.stockage.code;
  const infos: [string, React.ReactNode][] = [
    ["Format", lot.format.nom],
    ["Unités conditionnées", `${unites(lot.nombreUnites)} (${litres(lot.litres)})`],
    ["En stock", `${unites(lot.stockUnites)} unités`],
    ["Huile utilisée", `${kg(lot.quantiteKg)}${cuve ? ` de la cuve ${cuve}` : ""}`],
    ["Mis en bouteille le", date(lot.operation.date)],
    ["DLUO", date(lot.dluo)],
    ["Lot vrac", <Link key="v" href={`/lots/${lot.lotVrac.id}`} className="text-olive-700 hover:underline">{lot.lotVrac.code}</Link>],
    ["Catégorie", CATEGORIES[lot.lotVrac.categorieVisee]],
    ["Qualité du lot vrac", <BadgeQualite key="q" statut={lot.lotVrac.statutQualite} bloque={lot.lotVrac.bloque} />],
    ["Client", lot.client?.raisonSociale ?? "—"],
    ["Destination", [lot.paysDestination, lot.destination].filter(Boolean).join(" · ") || "—"],
    ["Opérateur", lot.operateur ?? lot.operation.user?.nom ?? "—"],
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <Link href="/conditionnement" className="text-sm text-olive-700 hover:underline">
            ← Mise en bouteille
          </Link>
          <h1 className="text-2xl font-semibold text-stone-900">Lot conditionné {lot.code}</h1>
          {lot.notes && <p className="text-stone-500">{lot.notes}</p>}
        </div>
        {can(ROLES_PRODUITS_FINIS) && !saisie && lot.stockUnites > 0 && (
          <button
            className="btn-secondary"
            onClick={() => {
              setSaisie(true);
              setSucces(null);
            }}
          >
            Expédition, casse ou ajustement
          </button>
        )}
      </div>

      {lot.lotVrac.bloque && (
        <p className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          Le lot vrac {lot.lotVrac.code} est bloqué par une non-conformité : les expéditions de ce lot sont refusées jusqu&apos;à sa clôture.
        </p>
      )}
      <Succes message={succes} />

      {saisie && (
        <Carte titre="Mouvement de produits finis">
          <FormulaireMouvementProduit
            lots={[lot]}
            lotId={lot.id}
            onAnnuler={() => setSaisie(false)}
            onFin={(message) => {
              setSaisie(false);
              setSucces(message);
              recharger();
            }}
          />
        </Carte>
      )}

      <Carte>
        <dl className="grid gap-x-6 gap-y-3 text-sm sm:grid-cols-3">
          {infos.map(([label, valeur]) => (
            <div key={label}>
              <dt className="text-stone-500">{label}</dt>
              <dd className="text-stone-900">{valeur}</dd>
            </div>
          ))}
        </dl>
      </Carte>

      <CartePasseport lotId={lot.id} />

      <ExpeditionsDuLot lotConditionneId={lot.id} />

      <Carte titre="Traçabilité : lots vrac d'origine">
        <Tableau entetes={["Lot", "Étape", "Huilerie", "Variété", "Campagne"]} vide={lot.ascendance.length === 0}>
          {lot.ascendance.map((a) => (
            <tr key={a.id}>
              <td className={td}>
                <span style={{ paddingLeft: `${a.niveau * 1.25}rem` }}>
                  <Link href={`/lots/${a.id}`} className="text-olive-700 hover:underline">
                    {a.code}
                  </Link>
                </span>
              </td>
              <td className={td}>{ORIGINES_LOT[a.origine]}</td>
              <td className={td}>{a.huilerie ?? "—"}</td>
              <td className={td}>{a.variete ?? "—"}</td>
              <td className={td}>{a.campagne ?? "—"}</td>
            </tr>
          ))}
        </Tableau>
      </Carte>

      <Carte titre="Mouvements de stock">
        <TableauMouvements mouvements={lot.mouvements} sansLot />
      </Carte>
    </div>
  );
}

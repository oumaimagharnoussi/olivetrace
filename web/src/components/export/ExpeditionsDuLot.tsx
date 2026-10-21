"use client";

import Link from "next/link";
import { unites } from "@/lib/conditionnement";
import { COULEURS_STATUT, type Expedition, PAYS_UE, STATUTS_EXPEDITION, nomPays } from "@/lib/export";
import { useApi } from "@/lib/useApi";
import { date } from "@/lib/vrac";
import { Carte, Erreur, Tableau, td } from "../vrac/ui";

/** Expéditions d'un lot conditionné : destination, départ, unités et statut. */
export function ExpeditionsDuLot({ lotConditionneId }: { lotConditionneId: number }) {
  const { data, erreur } = useApi<Expedition[]>(`/expeditions?lotConditionneId=${lotConditionneId}`);
  return (
    <Carte titre="Expéditions du lot">
      <Erreur message={erreur} />
      <Tableau entetes={["N°", "Client", "Destination", "Départ", "Unités du lot", "Statut"]} vide={data?.length === 0}>
        {data?.map((e) => (
          <tr key={e.id}>
            <td className={td}>
              <Link href={`/expeditions/${e.id}`} className="font-medium text-olive-700 hover:underline">
                {e.code}
              </Link>
            </td>
            <td className={td}>{e.client.raisonSociale}</td>
            <td className={td}>
              {nomPays(e.paysDestination)}
              {PAYS_UE.has(e.paysDestination) && <span className="ml-1 text-xs text-olive-700">UE</span>}
            </td>
            <td className={td}>{e.dateDepart ? date(e.dateDepart) : `prévu le ${date(e.datePrevue)}`}</td>
            <td className={td}>{unites(e.lignes.filter((l) => l.lotConditionne.id === lotConditionneId).reduce((s, l) => s + l.quantiteUnites, 0))}</td>
            <td className={td}>
              <span className={`rounded-full px-2 py-0.5 text-xs ${COULEURS_STATUT[e.statut]}`}>{STATUTS_EXPEDITION[e.statut]}</span>
            </td>
          </tr>
        ))}
      </Tableau>
    </Carte>
  );
}

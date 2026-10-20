import Link from "next/link";
import { type MouvementProduit, TYPES_MOUVEMENT_PRODUIT, unites } from "@/lib/conditionnement";
import { date } from "@/lib/vrac";
import { Tableau, td } from "../vrac/ui";

/** Journal des mouvements de produits finis (de tous les lots, ou d'un seul avec `sansLot`). */
export function TableauMouvements({ mouvements, sansLot }: { mouvements: MouvementProduit[] | null | undefined; sansLot?: boolean }) {
  return (
    <Tableau entetes={["Date", "Mouvement", ...(sansLot ? [] : ["Lot"]), "Unités", "Client", "Référence", "Notes", "Par"]} vide={mouvements?.length === 0}>
      {mouvements?.map((m) => (
        <tr key={m.id}>
          <td className={td}>{date(m.date)}</td>
          <td className={td}>{TYPES_MOUVEMENT_PRODUIT[m.type]}</td>
          {!sansLot && (
            <td className={td}>
              <Link href={`/conditionnement/${m.lotConditionne.id}`} className="text-olive-700 hover:underline">
                {m.lotConditionne.code}
              </Link>{" "}
              <span className="text-stone-500">{m.lotConditionne.format.nom}</span>
            </td>
          )}
          <td className={td}>
            {m.quantiteUnites > 0 ? "+" : ""}
            {unites(m.quantiteUnites)}
          </td>
          <td className={td}>{m.client?.raisonSociale ?? "—"}</td>
          <td className={td}>{m.reference ?? "—"}</td>
          <td className={td}>{m.notes ?? "—"}</td>
          <td className={td}>{m.user?.nom ?? "—"}</td>
        </tr>
      ))}
    </Tableau>
  );
}

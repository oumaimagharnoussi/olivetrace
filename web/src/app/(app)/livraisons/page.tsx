"use client";

import Link from "next/link";
import { useState } from "react";
import { Carte, Erreur, Tableau, td } from "@/components/vrac/ui";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { useApi } from "@/lib/useApi";
import { type Livraison, type Mouvement, ROLES_LIVRAISON, STATUTS_LIVRAISON, type StatutLivraison, date, kg } from "@/lib/vrac";

interface LivraisonDetail extends Livraison {
  operation: {
    date: string;
    client: { raisonSociale: string; pays: string; ville: string | null } | null;
    mouvements: Mouvement[];
  };
}

const COULEURS: Record<StatutLivraison, string> = {
  PLANIFIEE: "bg-stone-100 text-stone-700",
  EN_COURS: "bg-amber-100 text-amber-800",
  LIVREE: "bg-olive-100 text-olive-800",
  ANNULEE: "bg-red-50 text-red-700",
};

// Étape suivante proposée pour chaque statut.
const SUIVANT: Partial<Record<StatutLivraison, { statut: StatutLivraison; libelle: string }>> = {
  PLANIFIEE: { statut: "EN_COURS", libelle: "Marquer enlevée" },
  EN_COURS: { statut: "LIVREE", libelle: "Marquer livrée" },
};

export default function LivraisonsPage() {
  const { can } = useAuth();
  const [filtre, setFiltre] = useState<StatutLivraison | "">("");
  const livraisons = useApi<LivraisonDetail[]>(`/livraisons${filtre ? `?statut=${filtre}` : ""}`);
  const [erreur, setErreur] = useState<string | null>(null);
  const peutModifier = can(ROLES_LIVRAISON);

  async function changerStatut(id: number, statut: StatutLivraison) {
    setErreur(null);
    try {
      await api(`/livraisons/${id}`, { method: "PATCH", body: { statut } });
      livraisons.recharger();
    } catch (e) {
      setErreur((e as Error).message);
    }
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold text-stone-900">Livraisons vrac</h1>
      <p className="text-stone-500">
        Les livraisons sont créées avec une sortie de stock de type vente (menu Opérations).
      </p>
      <Erreur message={livraisons.erreur ?? erreur} />

      <Carte
        titre="Transports sous-traités"
        actions={
          <select className="input max-w-[12rem]" value={filtre} onChange={(e) => setFiltre(e.target.value as StatutLivraison | "")}>
            <option value="">Tous les statuts</option>
            {Object.entries(STATUTS_LIVRAISON).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        }
      >
        <Tableau
          entetes={["Sortie", "Client", "Lot", "Quantité", "Transporteur", "Enlèvement", "Livraison", "Statut", ...(peutModifier ? [""] : [])]}
          vide={livraisons.data?.length === 0}
        >
          {livraisons.data?.map((l) => {
            const suivant = SUIVANT[l.statut];
            return (
              <tr key={l.id}>
                <td className={td}>{date(l.operation.date)}</td>
                <td className={td}>
                  {l.operation.client?.raisonSociale ?? "—"}
                  {l.operation.client && <div className="text-xs text-stone-500">{[l.operation.client.ville, l.operation.client.pays].filter(Boolean).join(", ")}</div>}
                </td>
                <td className={td}>
                  {l.operation.mouvements.map((m) => (
                    <Link key={m.id} href={`/lots/${m.lot.id}`} className="block text-olive-700 hover:underline">
                      {m.lot.code}
                    </Link>
                  ))}
                </td>
                <td className={td}>{kg(-l.operation.mouvements.reduce((s, m) => s + m.quantiteKg, 0))}</td>
                <td className={td}>
                  {l.transporteur}
                  <div className="text-xs text-stone-500">{[l.immatriculation, l.chauffeur, l.numeroBl && `BL ${l.numeroBl}`].filter(Boolean).join(" · ")}</div>
                </td>
                <td className={td}>{date(l.dateEnlevement)}</td>
                <td className={td}>
                  {l.dateLivraison ? date(l.dateLivraison) : l.dateLivraisonPrevue ? `prévue le ${date(l.dateLivraisonPrevue)}` : "—"}
                </td>
                <td className={td}>
                  <span className={`rounded-full px-2 py-0.5 text-xs ${COULEURS[l.statut]}`}>{STATUTS_LIVRAISON[l.statut]}</span>
                </td>
                {peutModifier && (
                  <td className={`${td} space-x-3 whitespace-nowrap text-right`}>
                    {suivant && (
                      <button onClick={() => changerStatut(l.id, suivant.statut)} className="text-olive-700 hover:underline">
                        {suivant.libelle}
                      </button>
                    )}
                    {suivant && (
                      <button onClick={() => changerStatut(l.id, "ANNULEE")} className="text-stone-500 hover:underline">
                        Annuler
                      </button>
                    )}
                  </td>
                )}
              </tr>
            );
          })}
        </Tableau>
      </Carte>
    </div>
  );
}

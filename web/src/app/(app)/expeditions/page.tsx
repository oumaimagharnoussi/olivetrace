"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { FormulaireExpedition } from "@/components/export/FormulaireExpedition";
import { Carte, Erreur, Tableau, td } from "@/components/vrac/ui";
import { useAuth } from "@/lib/auth";
import { unites } from "@/lib/conditionnement";
import { COULEURS_STATUT, type Expedition, PAYS_UE, ROLES_EXPORT, STATUTS_EXPEDITION, type StatutExpedition, nomPays } from "@/lib/export";
import { useApi } from "@/lib/useApi";
import { date } from "@/lib/vrac";

export default function ExpeditionsPage() {
  const { can } = useAuth();
  const router = useRouter();
  const [filtre, setFiltre] = useState<StatutExpedition | "">("");
  const [saisie, setSaisie] = useState(false);
  const expeditions = useApi<Expedition[]>(`/expeditions${filtre ? `?statut=${filtre}` : ""}`);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold text-stone-900">Expéditions export</h1>
        {can(ROLES_EXPORT) && !saisie && (
          <button className="btn-primary" onClick={() => setSaisie(true)}>
            Nouvelle expédition
          </button>
        )}
      </div>
      <p className="text-stone-500">
        Une expédition regroupe des lots conditionnés pour un client. Le stock de produits finis ne sort qu&apos;au départ ; le dossier export
        (colisage, certificat d&apos;origine, analyses, conformité UE, fiches techniques) se télécharge en PDF depuis sa fiche.
      </p>
      <Erreur message={expeditions.erreur} />

      {saisie && (
        <Carte titre="Nouvelle expédition">
          <FormulaireExpedition onAnnuler={() => setSaisie(false)} onFin={(id) => router.push(`/expeditions/${id}`)} />
        </Carte>
      )}

      <Carte
        titre="Expéditions"
        actions={
          <select className="input max-w-[12rem]" value={filtre} onChange={(e) => setFiltre(e.target.value as StatutExpedition | "")}>
            <option value="">Tous les statuts</option>
            {Object.entries(STATUTS_EXPEDITION).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        }
      >
        <Tableau entetes={["N°", "Client", "Destination", "Départ", "Lots", "Unités", "Transport", "Statut"]} vide={expeditions.data?.length === 0}>
          {expeditions.data?.map((e) => (
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
              <td className={td}>{e.lignes.map((l) => l.lotConditionne.code).join(", ")}</td>
              <td className={td}>{unites(e.lignes.reduce((s, l) => s + l.quantiteUnites, 0))}</td>
              <td className={td}>{[e.incoterm && `${e.incoterm} ${e.lieuIncoterm ?? ""}`, e.numeroConteneur].filter(Boolean).join(" · ") || "—"}</td>
              <td className={td}>
                <span className={`rounded-full px-2 py-0.5 text-xs ${COULEURS_STATUT[e.statut]}`}>{STATUTS_EXPEDITION[e.statut]}</span>
              </td>
            </tr>
          ))}
        </Tableau>
      </Carte>
    </div>
  );
}

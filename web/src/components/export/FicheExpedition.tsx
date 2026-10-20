"use client";

import Link from "next/link";
import { useState } from "react";
import { api, telecharger } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { litres, unites } from "@/lib/conditionnement";
import {
  COULEURS_STATUT,
  DOCUMENTS,
  type FicheExpedition as Fiche,
  MODES_TRANSPORT,
  ROLES_EXPORT,
  STATUTS_EXPEDITION,
  type StatutExpedition,
  type TypeDocument,
  nomPays,
} from "@/lib/export";
import { useApi } from "@/lib/useApi";
import { aujourdhui, date } from "@/lib/vrac";
import { BadgeQualite } from "../qualite/Badges";
import { BlocControle } from "../qualite/Controle";
import { Carte, Erreur, Succes, Tableau, td } from "../vrac/ui";
import { FormulaireExpedition } from "./FormulaireExpedition";

// Étape suivante proposée pour chaque statut.
const SUIVANT: Partial<Record<StatutExpedition, { statut: StatutExpedition; libelle: string; question: string }>> = {
  PREPAREE: {
    statut: "EXPEDIEE",
    libelle: "Valider le départ",
    question: "Les unités vont sortir du stock de produits finis. Confirmer le départ de la marchandise ?",
  },
  EXPEDIEE: { statut: "LIVREE", libelle: "Marquer livrée", question: "Confirmer la livraison au client ?" },
};

function kgNet(valeur: number) {
  return `${valeur.toLocaleString("fr-FR", { maximumFractionDigits: 1 })} kg`;
}

export function FicheExpedition({ id }: { id: number }) {
  const { can } = useAuth();
  const { data: e, erreur, recharger } = useApi<Fiche>(`/expeditions/${id}`);
  const [modification, setModification] = useState(false);
  const [succes, setSucces] = useState<string | null>(null);
  const [erreurAction, setErreurAction] = useState<string | null>(null);
  const [enCours, setEnCours] = useState<string | null>(null);
  const [dateStatut, setDateStatut] = useState(aujourdhui());
  const peutModifier = can(ROLES_EXPORT);

  if (erreur) return <Erreur message={erreur} />;
  if (!e) return <p className="text-stone-500">Chargement…</p>;

  async function action(cle: string, fn: () => Promise<void>) {
    setEnCours(cle);
    setErreurAction(null);
    setSucces(null);
    try {
      await fn();
    } catch (err) {
      setErreurAction((err as Error).message);
    } finally {
      setEnCours(null);
    }
  }

  const changerStatut = (statut: StatutExpedition, question: string) => {
    if (!window.confirm(question)) return;
    action(statut, async () => {
      await api(`/expeditions/${id}/statut`, { method: "POST", body: { statut, date: statut === "ANNULEE" ? undefined : dateStatut } });
      setSucces(`Expédition ${e.code} : ${STATUTS_EXPEDITION[statut].toLowerCase()}.`);
      recharger();
    });
  };

  const telechargerDocument = (type: TypeDocument | "dossier") =>
    action(type, async () => {
      const nom = type === "dossier" ? "dossier-export" : type === "origine" ? "certificat-origine" : type;
      await telecharger(`/expeditions/${id}/documents/${type}`, `${nom}-${e.code}.pdf`);
    });

  const suivant = SUIVANT[e.statut];
  const infos: [string, React.ReactNode][] = [
    ["Client", e.client.raisonSociale],
    ["Destination", `${nomPays(e.paysDestination)}${e.ue ? " (Union européenne)" : ""}`],
    ["Adresse de livraison", e.adresseLivraison ?? "—"],
    ["Départ", e.dateDepart ? date(e.dateDepart) : `prévu le ${date(e.datePrevue)}`],
    ["Livraison", date(e.dateLivraison)],
    ["Incoterm", [e.incoterm, e.lieuIncoterm].filter(Boolean).join(" ") || "—"],
    ["Transport", [MODES_TRANSPORT[e.modeTransport], e.transporteur, e.navire].filter(Boolean).join(" · ")],
    ["Chargement / déchargement", [e.portChargement, e.portDechargement].filter(Boolean).join(" → ") || "—"],
    ["Conteneur / plomb", [e.numeroConteneur, e.numeroPlomb].filter(Boolean).join(" / ") || "—"],
    ["Connaissement", e.numeroConnaissement ?? "—"],
    ["Commande / facture", [e.numeroCommande, e.numeroFacture].filter(Boolean).join(" / ") || "—"],
    ["Palettes / poids brut", [e.nombrePalettes && `${e.nombrePalettes} palettes`, e.poidsBrutKg && kgNet(e.poidsBrutKg)].filter(Boolean).join(" · ") || "—"],
    ["Créée par", e.user?.nom ?? "—"],
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <Link href="/expeditions" className="text-sm text-olive-700 hover:underline">
            ← Expéditions
          </Link>
          <h1 className="mt-1 flex items-center gap-3 text-2xl font-semibold text-stone-900">
            Expédition {e.code}
            <span className={`rounded-full px-2 py-0.5 text-sm font-normal ${COULEURS_STATUT[e.statut]}`}>{STATUTS_EXPEDITION[e.statut]}</span>
          </h1>
        </div>
        {peutModifier && !modification && e.statut !== "ANNULEE" && (
          <div className="flex flex-wrap items-center gap-2">
            {suivant && (
              <>
                <input className="input w-40" type="date" value={dateStatut} onChange={(x) => setDateStatut(x.target.value)} aria-label="Date" />
                <button
                  className="btn-primary"
                  disabled={!!enCours || (suivant.statut === "EXPEDIEE" && !e.controle.autorise)}
                  onClick={() => changerStatut(suivant.statut, suivant.question)}
                >
                  {suivant.libelle}
                </button>
              </>
            )}
            {e.statut !== "LIVREE" && (
              <button className="btn-secondary" onClick={() => setModification(true)}>
                Modifier
              </button>
            )}
            {e.statut === "PREPAREE" && (
              <button className="btn-secondary" disabled={!!enCours} onClick={() => changerStatut("ANNULEE", "Annuler cette expédition ?")}>
                Annuler l&apos;expédition
              </button>
            )}
          </div>
        )}
      </div>

      <Succes message={succes} />
      <Erreur message={erreurAction} />

      {modification && (
        <Carte titre="Modifier l'expédition">
          <FormulaireExpedition
            expedition={e}
            onAnnuler={() => setModification(false)}
            onFin={(_, message) => {
              setModification(false);
              setSucces(message);
              recharger();
            }}
          />
        </Carte>
      )}

      {e.statut === "PREPAREE" && <BlocControle controle={e.controle} refus="départ impossible" />}

      {e.statut !== "ANNULEE" && (
        <Carte titre="Dossier export (PDF)">
          <div className="flex flex-wrap gap-2">
            <button className="btn-primary" disabled={!!enCours || !e.conformiteEditable} onClick={() => telechargerDocument("dossier")}>
              {enCours === "dossier" ? "Génération…" : "Dossier complet"}
            </button>
            {(Object.keys(DOCUMENTS) as TypeDocument[]).map((type) => (
              <button
                key={type}
                className="btn-secondary"
                disabled={!!enCours || (type === "conformite" && !e.conformiteEditable)}
                onClick={() => telechargerDocument(type)}
              >
                {enCours === type ? "Génération…" : DOCUMENTS[type]}
              </button>
            ))}
          </div>
          {!e.conformiteEditable && (
            <div className="mt-3 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-800">
              <div className="font-medium">Déclaration de conformité et dossier complet indisponibles :</div>
              <ul className="list-disc pl-5">
                {e.blocagesConformite.map((m) => (
                  <li key={m}>{m}</li>
                ))}
              </ul>
            </div>
          )}
          <p className="mt-3 text-xs text-stone-500">
            Les documents sont générés avec les données du jour (analyses, origine, colisage). L&apos;empreinte de chaque PDF est gardée dans le journal
            d&apos;audit.
          </p>
        </Carte>
      )}

      <Carte titre="Lots expédiés">
        <Tableau entetes={["N° de lot", "Format", "Lot vrac", "Qualité", "Unités", "Cartons", "Volume", "Poids net", "DLUO", "Stock"]}>
          {e.lignes.map((l) => (
            <tr key={l.id}>
              <td className={td}>
                <Link href={`/conditionnement/${l.lotConditionne.id}`} className="font-medium text-olive-700 hover:underline">
                  {l.lotConditionne.code}
                </Link>
              </td>
              <td className={td}>{l.lotConditionne.format.nom}</td>
              <td className={td}>
                <Link href={`/lots/${l.lotConditionne.lotVrac.id}`} className="text-olive-700 hover:underline">
                  {l.lotConditionne.lotVrac.code}
                </Link>
              </td>
              <td className={td}>
                <BadgeQualite statut={l.lotConditionne.lotVrac.statutQualite} bloque={l.lotConditionne.lotVrac.bloque} />
              </td>
              <td className={td}>{unites(l.quantiteUnites)}</td>
              <td className={td}>
                {l.cartons === null ? "—" : unites(l.cartons)}
                {l.cartonIncomplet && <span className="block text-xs text-amber-700">dernier carton incomplet</span>}
              </td>
              <td className={td}>{litres(l.litres)}</td>
              <td className={td}>{kgNet(l.poidsNetKg)}</td>
              <td className={td}>{date(l.lotConditionne.dluo)}</td>
              <td className={td}>{l.mouvementId ? "sorti" : `${unites(l.stockUnites)} en stock`}</td>
            </tr>
          ))}
          <tr className="font-medium">
            <td className={td} colSpan={4}>
              Total
            </td>
            <td className={td}>{unites(e.totaux.unites)}</td>
            <td className={td}>{e.totaux.cartons === null ? "—" : unites(e.totaux.cartons)}</td>
            <td className={td}>{litres(e.totaux.litres)}</td>
            <td className={td}>{kgNet(e.totaux.poidsNetKg)}</td>
            <td className={td} colSpan={2}></td>
          </tr>
        </Tableau>
      </Carte>

      <Carte titre="Informations">
        <dl className="grid gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
          {infos.map(([k, v]) => (
            <div key={k} className="flex justify-between gap-4 border-b border-stone-100 py-1">
              <dt className="text-stone-500">{k}</dt>
              <dd className="text-right text-stone-900">{v}</dd>
            </div>
          ))}
        </dl>
        {e.notes && <p className="mt-3 text-sm text-stone-700">{e.notes}</p>}
      </Carte>
    </div>
  );
}

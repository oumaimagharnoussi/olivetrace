"use client";

import Link from "next/link";
import { useState } from "react";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import {
  CATEGORIES,
  type CategorieHuile,
  DECISIONS_NC,
  type DecisionNonConformite,
  type NonConformite,
  ROLES_QUALITE,
  STATUTS_NC,
  type StatutNonConformite,
} from "@/lib/qualite";
import { date } from "@/lib/vrac";
import { Champ, Erreur, Tableau, td } from "../vrac/ui";
import { BadgeNc } from "./Badges";

/** Tableau des non-conformités, avec le traitement en ligne pour les rôles qualité. */
export function TableauNonConformites({
  nonConformites,
  avecLot = true,
  onModifie,
}: {
  nonConformites: NonConformite[];
  avecLot?: boolean;
  onModifie: () => void;
}) {
  const { can } = useAuth();
  const [enCours, setEnCours] = useState<number | null>(null);

  const entetes = [
    "N°",
    ...(avecLot ? ["Lot"] : []),
    "Ouverte le",
    "Description",
    "Statut",
    "Décision",
    "Action corrective",
    "",
  ];

  return (
    <Tableau entetes={entetes} vide={nonConformites.length === 0}>
      {nonConformites.map((nc) => (
        <LigneNc
          key={nc.id}
          nc={nc}
          avecLot={avecLot}
          colonnes={entetes.length}
          ouverte={enCours === nc.id}
          peutTraiter={can(ROLES_QUALITE) && nc.statut !== "CLOTUREE"}
          onOuvrir={() => setEnCours(enCours === nc.id ? null : nc.id)}
          onFin={(modifie) => {
            setEnCours(null);
            if (modifie) onModifie();
          }}
        />
      ))}
    </Tableau>
  );
}

function LigneNc({
  nc,
  avecLot,
  colonnes,
  ouverte,
  peutTraiter,
  onOuvrir,
  onFin,
}: {
  nc: NonConformite;
  avecLot: boolean;
  colonnes: number;
  ouverte: boolean;
  peutTraiter: boolean;
  onOuvrir: () => void;
  onFin: (modifie: boolean) => void;
}) {
  return (
    <>
      <tr>
        <td className={`${td} whitespace-nowrap font-medium`}>{nc.code}</td>
        {avecLot && (
          <td className={td}>
            {nc.lot && (
              <Link href={`/lots/${nc.lot.id}`} className="text-olive-700 hover:underline">
                {nc.lot.code}
              </Link>
            )}
          </td>
        )}
        <td className={`${td} whitespace-nowrap`}>
          {date(nc.createdAt)}
          {nc.ouvertePar && <div className="text-xs text-stone-500">{nc.ouvertePar.nom}</div>}
        </td>
        <td className={td}>{nc.description}</td>
        <td className={td}>
          <BadgeNc statut={nc.statut} />
          {nc.clotureeLe && (
            <div className="text-xs text-stone-500">
              le {date(nc.clotureeLe)}
              {nc.clotureePar && ` par ${nc.clotureePar.nom}`}
            </div>
          )}
        </td>
        <td className={td}>{nc.decision ? DECISIONS_NC[nc.decision] : "—"}</td>
        <td className={td}>{nc.actionCorrective ?? "—"}</td>
        <td className={td}>
          {peutTraiter && (
            <button className="text-sm text-olive-700 hover:underline" onClick={onOuvrir}>
              {ouverte ? "Fermer" : "Traiter"}
            </button>
          )}
        </td>
      </tr>
      {ouverte && (
        <tr>
          <td colSpan={colonnes} className="border-t border-stone-100 bg-stone-50 p-4">
            <FormulaireTraitement nc={nc} onFin={onFin} />
          </td>
        </tr>
      )}
    </>
  );
}

function FormulaireTraitement({ nc, onFin }: { nc: NonConformite; onFin: (modifie: boolean) => void }) {
  const [v, setV] = useState({
    statut: (nc.statut === "OUVERTE" ? "EN_TRAITEMENT" : "CLOTUREE") as StatutNonConformite,
    decision: (nc.decision ?? "") as DecisionNonConformite | "",
    nouvelleCategorie: (nc.analyse?.categorie ?? "") as CategorieHuile | "",
    actionCorrective: nc.actionCorrective ?? "",
  });
  const [erreur, setErreur] = useState<string | null>(null);
  const [envoi, setEnvoi] = useState(false);
  const cloture = v.statut === "CLOTUREE";

  async function soumettre(e: React.FormEvent) {
    e.preventDefault();
    setEnvoi(true);
    setErreur(null);
    try {
      await api(`/qualite/non-conformites/${nc.id}`, {
        method: "PATCH",
        body: {
          statut: v.statut,
          decision: v.decision || undefined,
          nouvelleCategorie: v.decision === "DECLASSEMENT" && v.nouvelleCategorie ? v.nouvelleCategorie : undefined,
          actionCorrective: v.actionCorrective || undefined,
        },
      });
      onFin(true);
    } catch (e) {
      setErreur((e as Error).message);
    } finally {
      setEnvoi(false);
    }
  }

  return (
    <form onSubmit={soumettre} className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-3">
        <Champ label="Statut" requis>
          <select className="input" value={v.statut} onChange={(e) => setV({ ...v, statut: e.target.value as StatutNonConformite })}>
            {(["OUVERTE", "EN_TRAITEMENT", "CLOTUREE"] as const).map((s) => (
              <option key={s} value={s}>
                {STATUTS_NC[s]}
              </option>
            ))}
          </select>
        </Champ>
        <Champ label="Décision" requis={cloture}>
          <select
            className="input"
            required={cloture}
            value={v.decision}
            onChange={(e) => setV({ ...v, decision: e.target.value as DecisionNonConformite })}
          >
            <option value="">Choisir…</option>
            {Object.entries(DECISIONS_NC).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </Champ>
        {v.decision === "DECLASSEMENT" && (
          <Champ label="Nouvelle catégorie du lot" requis={cloture}>
            <select
              className="input"
              required={cloture}
              value={v.nouvelleCategorie}
              onChange={(e) => setV({ ...v, nouvelleCategorie: e.target.value as CategorieHuile })}
            >
              <option value="">Choisir…</option>
              {Object.entries(CATEGORIES).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </Champ>
        )}
        <Champ label="Action corrective" large>
          <input className="input" value={v.actionCorrective} onChange={(e) => setV({ ...v, actionCorrective: e.target.value })} />
        </Champ>
      </div>
      <p className="text-sm text-stone-500">
        Le lot reste bloqué (pas de vente ni d&apos;envoi au conditionnement) tant que la non-conformité n&apos;est pas clôturée.
        {v.decision === "DECLASSEMENT" && " Le déclassement change la catégorie visée du lot."}
      </p>
      <Erreur message={erreur} />
      <div className="flex gap-3">
        <button type="submit" disabled={envoi} className="btn-primary">
          {envoi ? "Enregistrement…" : cloture ? "Clôturer" : "Enregistrer"}
        </button>
        <button type="button" onClick={() => onFin(false)} className="btn-secondary">
          Annuler
        </button>
      </div>
    </form>
  );
}

/** Déclaration d'une non-conformité constatée hors analyse (odeur, contamination…). Elle bloque le lot. */
export function FormulaireNonConformite({ lotId, onFin }: { lotId: number; onFin: (enregistre: boolean) => void }) {
  const [description, setDescription] = useState("");
  const [erreur, setErreur] = useState<string | null>(null);
  const [envoi, setEnvoi] = useState(false);

  async function soumettre(e: React.FormEvent) {
    e.preventDefault();
    setEnvoi(true);
    setErreur(null);
    try {
      await api("/qualite/non-conformites", { method: "POST", body: { lotId, description } });
      onFin(true);
    } catch (e) {
      setErreur((e as Error).message);
    } finally {
      setEnvoi(false);
    }
  }

  return (
    <form onSubmit={soumettre} className="mb-5 space-y-4 rounded-md border border-stone-200 bg-stone-50 p-4">
      <Champ label="Description" requis>
        <textarea className="input" rows={2} required value={description} onChange={(e) => setDescription(e.target.value)} />
      </Champ>
      <p className="text-sm text-stone-500">Le lot sera bloqué jusqu&apos;à la clôture de la non-conformité.</p>
      <Erreur message={erreur} />
      <div className="flex gap-3">
        <button type="submit" disabled={envoi} className="btn-primary">
          {envoi ? "Enregistrement…" : "Déclarer la non-conformité"}
        </button>
        <button type="button" onClick={() => onFin(false)} className="btn-secondary">
          Annuler
        </button>
      </div>
    </form>
  );
}

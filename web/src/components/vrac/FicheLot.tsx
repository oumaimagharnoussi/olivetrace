"use client";

import Link from "next/link";
import { useState } from "react";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { useApi } from "@/lib/useApi";
import {
  type Analyse,
  type Livraison,
  type Lot,
  type MotifSortie,
  MOTIFS_SORTIE,
  ROLES_ANALYSE,
  STATUTS_LIVRAISON,
  TYPES_OPERATION,
  type TypeOperation,
  aujourdhui,
  date,
  kg,
  nombre,
} from "@/lib/vrac";
import { ChampsAnalyse, analyseVersApi, analyseVide } from "./ChampsAnalyse";
import { Carte, Erreur, Tableau, td } from "./ui";

interface FicheLotData extends Omit<Lot, "derniereAnalyse"> {
  analyses: Analyse[];
  cuves: { stockageId: number; code: string; quantiteKg: number }[];
  origines: { quantiteKg: number; parent: { id: number; code: string } }[];
  enfants: { quantiteKg: number; lot: { id: number; code: string; dateReception: string } }[];
  mouvements: {
    id: number;
    quantiteKg: number;
    stockage: { id: number; code: string };
    operation: {
      id: number;
      type: TypeOperation;
      date: string;
      motif: MotifSortie | null;
      notes: string | null;
      client: { id: number; raisonSociale: string } | null;
      livraison: Livraison | null;
    };
  }[];
}

export function FicheLot({ id }: { id: number }) {
  const { can } = useAuth();
  const { data: lot, erreur, recharger } = useApi<FicheLotData>(`/lots/${id}`);
  const [saisieAnalyse, setSaisieAnalyse] = useState(false);

  if (erreur) return <Erreur message={erreur} />;
  if (!lot) return <p className="text-stone-500">Chargement…</p>;

  const infos: [string, React.ReactNode][] = [
    ["Origine", lot.origine === "ASSEMBLAGE" ? "Assemblage" : "Réception"],
    ["Huilerie", lot.huilerie?.nom ?? "—"],
    ["Variété", lot.variete?.nom ?? (lot.origine === "ASSEMBLAGE" ? "Plusieurs variétés" : "—")],
    ["Campagne", lot.campagne ?? "—"],
    [lot.origine === "ASSEMBLAGE" ? "Assemblé le" : "Reçu le", date(lot.dateReception)],
    ["Quantité initiale", kg(lot.quantiteInitialeKg)],
    ["En stock", lot.stockKg > 0 ? kg(lot.stockKg) : "Épuisé"],
    ["Cuves", lot.cuves.length ? lot.cuves.map((c) => `${c.code} (${kg(c.quantiteKg)})`).join(", ") : "—"],
    ["N° de bon", lot.numeroBon ?? "—"],
  ];

  return (
    <div className="space-y-6">
      <div>
        <Link href="/lots" className="text-sm text-olive-700 hover:underline">
          ← Lots
        </Link>
        <h1 className="text-2xl font-semibold text-stone-900">Lot {lot.code}</h1>
        {lot.notes && <p className="text-stone-500">{lot.notes}</p>}
      </div>

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

      {(lot.origines.length > 0 || lot.enfants.length > 0) && (
        <Carte titre="Généalogie">
          <div className="grid gap-4 text-sm sm:grid-cols-2">
            {lot.origines.length > 0 && (
              <div>
                <div className="mb-1 text-stone-500">Lots d&apos;origine</div>
                <ul className="space-y-1">
                  {lot.origines.map((o) => (
                    <li key={o.parent.id}>
                      <Link href={`/lots/${o.parent.id}`} className="text-olive-700 hover:underline">
                        {o.parent.code}
                      </Link>{" "}
                      : {kg(o.quantiteKg)}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {lot.enfants.length > 0 && (
              <div>
                <div className="mb-1 text-stone-500">Utilisé dans les assemblages</div>
                <ul className="space-y-1">
                  {lot.enfants.map((e) => (
                    <li key={e.lot.id}>
                      <Link href={`/lots/${e.lot.id}`} className="text-olive-700 hover:underline">
                        {e.lot.code}
                      </Link>{" "}
                      : {kg(e.quantiteKg)} le {date(e.lot.dateReception)}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </Carte>
      )}

      <Carte
        titre="Analyses de laboratoire"
        actions={
          can(ROLES_ANALYSE) &&
          !saisieAnalyse && (
            <button className="btn-secondary" onClick={() => setSaisieAnalyse(true)}>
              Ajouter une analyse
            </button>
          )
        }
      >
        {saisieAnalyse && (
          <FormulaireAnalyse
            lotId={lot.id}
            onFin={(enregistre) => {
              setSaisieAnalyse(false);
              if (enregistre) recharger();
            }}
          />
        )}
        <Tableau
          entetes={["Date", "Laboratoire", "Bulletin", "Acidité %", "Peroxyde", "K232", "K270", "ΔK", "Polyphénols", "Commentaire"]}
          vide={lot.analyses.length === 0}
        >
          {lot.analyses.map((a) => (
            <tr key={a.id}>
              <td className={td}>{date(a.dateAnalyse)}</td>
              <td className={td}>{a.laboratoire ?? "—"}</td>
              <td className={td}>{a.reference ?? "—"}</td>
              <td className={td}>{nombre(a.acidite)}</td>
              <td className={td}>{nombre(a.peroxyde)}</td>
              <td className={td}>{nombre(a.k232)}</td>
              <td className={td}>{nombre(a.k270)}</td>
              <td className={td}>{nombre(a.deltaK)}</td>
              <td className={td}>{nombre(a.polyphenols)}</td>
              <td className={td}>{a.commentaire ?? "—"}</td>
            </tr>
          ))}
        </Tableau>
      </Carte>

      <Carte titre="Mouvements">
        <Tableau entetes={["Date", "Opération", "Cuve", "Quantité", "Détail"]} vide={lot.mouvements.length === 0}>
          {lot.mouvements.map((m) => (
            <tr key={m.id}>
              <td className={td}>{date(m.operation.date)}</td>
              <td className={td}>{TYPES_OPERATION[m.operation.type]}</td>
              <td className={td}>{m.stockage.code}</td>
              <td className={`${td} ${m.quantiteKg < 0 ? "text-red-700" : "text-olive-800"}`}>
                {m.quantiteKg > 0 ? "+" : ""}
                {kg(m.quantiteKg)}
              </td>
              <td className={td}>
                {[
                  m.operation.motif && MOTIFS_SORTIE[m.operation.motif],
                  m.operation.client?.raisonSociale,
                  m.operation.livraison &&
                    `${m.operation.livraison.transporteur} (${STATUTS_LIVRAISON[m.operation.livraison.statut].toLowerCase()})`,
                  m.operation.notes,
                ]
                  .filter(Boolean)
                  .join(" · ") || "—"}
              </td>
            </tr>
          ))}
        </Tableau>
      </Carte>
    </div>
  );
}

function FormulaireAnalyse({ lotId, onFin }: { lotId: number; onFin: (enregistre: boolean) => void }) {
  const [valeurs, setValeurs] = useState(() => analyseVide(aujourdhui()));
  const [erreur, setErreur] = useState<string | null>(null);
  const [envoi, setEnvoi] = useState(false);

  async function soumettre(e: React.FormEvent) {
    e.preventDefault();
    setEnvoi(true);
    setErreur(null);
    try {
      await api(`/lots/${lotId}/analyses`, { method: "POST", body: analyseVersApi(valeurs) });
      onFin(true);
    } catch (e) {
      setErreur((e as Error).message);
    } finally {
      setEnvoi(false);
    }
  }

  return (
    <form onSubmit={soumettre} className="mb-5 space-y-4 rounded-md border border-stone-200 bg-stone-50 p-4">
      <ChampsAnalyse valeurs={valeurs} onChange={setValeurs} />
      <Erreur message={erreur} />
      <div className="flex gap-3">
        <button type="submit" disabled={envoi} className="btn-primary">
          {envoi ? "Enregistrement…" : "Enregistrer l'analyse"}
        </button>
        <button type="button" onClick={() => onFin(false)} className="btn-secondary">
          Annuler
        </button>
      </div>
    </form>
  );
}

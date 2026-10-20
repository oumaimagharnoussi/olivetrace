"use client";

import Link from "next/link";
import { useState } from "react";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { CATEGORIES, type NonConformite, ROLES_QUALITE, decrireEcart } from "@/lib/qualite";
import { useApi } from "@/lib/useApi";
import {
  type Analyse,
  type Livraison,
  type Lot,
  type OrigineLot,
  type MotifSortie,
  MOTIFS_SORTIE,
  ORIGINES_LOT,
  ROLES_ANALYSE,
  STATUTS_LIVRAISON,
  TYPES_OPERATION,
  type TypeOperation,
  aujourdhui,
  date,
  kg,
  nombre,
} from "@/lib/vrac";
import { BadgeCategorie, BadgeQualite } from "../qualite/Badges";
import { FormulaireNonConformite, TableauNonConformites } from "../qualite/NonConformites";
import { ChampsAnalyse, analyseVersApi, analyseVide } from "./ChampsAnalyse";
import { Carte, Erreur, Tableau, td } from "./ui";

interface FicheLotData extends Omit<Lot, "derniereAnalyse"> {
  analyses: Analyse[];
  nonConformites: NonConformite[];
  cuves: { stockageId: number; code: string; quantiteKg: number }[];
  origines: { quantiteKg: number; parent: { id: number; code: string } }[];
  enfants: { quantiteKg: number; lot: { id: number; code: string; origine: OrigineLot; dateReception: string } }[];
  filtration: { id: number; code: string; operateur: string; lotEntree: { id: number; code: string } } | null;
  lotsConditionnes: { id: number; code: string; nombreUnites: number; quantiteKg: number; format: { nom: string } }[];
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
  const [saisieNc, setSaisieNc] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  if (erreur) return <Erreur message={erreur} />;
  if (!lot) return <p className="text-stone-500">Chargement…</p>;

  const infos: [string, React.ReactNode][] = [
    ["Origine", ORIGINES_LOT[lot.origine]],
    ["Huilerie", lot.huilerie?.nom ?? "—"],
    ["Variété", lot.variete?.nom ?? (lot.origine === "ASSEMBLAGE" ? "Plusieurs variétés" : "—")],
    ["Campagne", lot.campagne ?? "—"],
    [{ RECEPTION: "Reçu le", ASSEMBLAGE: "Assemblé le", FILTRATION: "Filtré le" }[lot.origine], date(lot.dateReception)],
    ["Quantité initiale", kg(lot.quantiteInitialeKg)],
    ["En stock", lot.stockKg > 0 ? kg(lot.stockKg) : "Épuisé"],
    ["Cuves", lot.cuves.length ? lot.cuves.map((c) => `${c.code} (${kg(c.quantiteKg)})`).join(", ") : "—"],
    ["N° de bon", lot.numeroBon ?? "—"],
    ["Catégorie visée", CATEGORIES[lot.categorieVisee]],
    ["Qualité", <BadgeQualite key="q" statut={lot.statutQualite} bloque={lot.bloque} />],
  ];
  // Un lot filtré sans analyse reprend la qualité du lot qu'il a filtré.
  const qualiteHeritee = lot.filtration && lot.analyses.length === 0;
  const ncOuvertes = lot.nonConformites.filter((nc) => nc.statut !== "CLOTUREE");

  return (
    <div className="space-y-6">
      <div>
        <Link href="/lots" className="text-sm text-olive-700 hover:underline">
          ← Lots
        </Link>
        <h1 className="text-2xl font-semibold text-stone-900">Lot {lot.code}</h1>
        {lot.notes && <p className="text-stone-500">{lot.notes}</p>}
      </div>

      {lot.bloque && (
        <p className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          Lot bloqué par {ncOuvertes.length > 1 ? `${ncOuvertes.length} non-conformités ouvertes` : `la non-conformité ${ncOuvertes[0]?.code ?? ""}`} :
          vente et envoi au conditionnement impossibles jusqu&apos;à sa clôture.
        </p>
      )}
      {lot.bloque && ncOuvertes.length === 0 && lot.filtration && (
        <p className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          Lot bloqué parce que le lot filtré{" "}
          <Link href={`/lots/${lot.filtration.lotEntree.id}`} className="underline">
            {lot.filtration.lotEntree.code}
          </Link>{" "}
          a une non-conformité ouverte.
        </p>
      )}
      {qualiteHeritee && (
        <p className="rounded-md bg-stone-100 px-4 py-3 text-sm text-stone-700">
          Lot filtré ({lot.filtration!.code}, opérateur {lot.filtration!.operateur}) : sans analyse propre, il reprend la qualité du lot{" "}
          <Link href={`/lots/${lot.filtration!.lotEntree.id}`} className="text-olive-700 hover:underline">
            {lot.filtration!.lotEntree.code}
          </Link>
          .
        </p>
      )}
      {message && <p className="rounded-md bg-amber-50 px-4 py-3 text-sm text-amber-900">{message}</p>}

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
                <div className="mb-1 text-stone-500">Utilisé dans les assemblages et filtrations</div>
                <ul className="space-y-1">
                  {lot.enfants.map((e) => (
                    <li key={e.lot.id}>
                      <Link href={`/lots/${e.lot.id}`} className="text-olive-700 hover:underline">
                        {e.lot.code}
                      </Link>{" "}
                      : {kg(e.quantiteKg)} le {date(e.lot.dateReception)} ({ORIGINES_LOT[e.lot.origine].toLowerCase()})
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </Carte>
      )}

      {lot.lotsConditionnes.length > 0 && (
        <Carte titre="Mises en bouteille">
          <ul className="space-y-1 text-sm">
            {lot.lotsConditionnes.map((c) => (
              <li key={c.id}>
                <Link href={`/conditionnement/${c.id}`} className="text-olive-700 hover:underline">
                  {c.code}
                </Link>{" "}
                : {nombre(c.nombreUnites)} × {c.format.nom} ({kg(c.quantiteKg)})
              </li>
            ))}
          </ul>
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
            onFin={(resultat) => {
              setSaisieAnalyse(false);
              if (resultat) {
                setMessage(resultat.nonConformite ? `Analyse non conforme : non-conformité ${resultat.nonConformite.code} ouverte, le lot est bloqué.` : null);
                recharger();
              }
            }}
          />
        )}
        <Tableau
          entetes={[
            "Date",
            "Laboratoire",
            "Bulletin",
            "Acidité %",
            "Peroxyde",
            "K232",
            "K270",
            "ΔK",
            "Polyphénols",
            "Esters éth.",
            "Défaut / fruité",
            "Catégorie",
            "Résultat",
            "Commentaire",
          ]}
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
              <td className={td}>{nombre(a.esterEthyliques)}</td>
              <td className={td}>
                {a.medianeDefaut === null && a.medianeFruite === null ? "—" : `${nombre(a.medianeDefaut)} / ${nombre(a.medianeFruite)}`}
              </td>
              <td className={td}>
                <BadgeCategorie categorie={a.categorie} />
              </td>
              <td className={td}>
                {a.resultat ? <BadgeQualite statut={a.resultat} /> : "—"}
                {a.ecarts?.map((e) => (
                  <div key={e.parametre} className="whitespace-nowrap text-xs text-red-700">
                    {decrireEcart(e)}
                  </div>
                ))}
              </td>
              <td className={td}>{a.commentaire ?? "—"}</td>
            </tr>
          ))}
        </Tableau>
      </Carte>

      <Carte
        titre="Non-conformités"
        actions={
          can(ROLES_QUALITE) &&
          !saisieNc && (
            <button className="btn-secondary" onClick={() => setSaisieNc(true)}>
              Déclarer une non-conformité
            </button>
          )
        }
      >
        {saisieNc && (
          <FormulaireNonConformite
            lotId={lot.id}
            onFin={(enregistre) => {
              setSaisieNc(false);
              if (enregistre) recharger();
            }}
          />
        )}
        <TableauNonConformites nonConformites={lot.nonConformites} avecLot={false} onModifie={recharger} />
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

type ResultatAnalyse = { nonConformite: { code: string } | null };

function FormulaireAnalyse({ lotId, onFin }: { lotId: number; onFin: (resultat: ResultatAnalyse | null) => void }) {
  const [valeurs, setValeurs] = useState(() => analyseVide(aujourdhui()));
  const [erreur, setErreur] = useState<string | null>(null);
  const [envoi, setEnvoi] = useState(false);

  async function soumettre(e: React.FormEvent) {
    e.preventDefault();
    setEnvoi(true);
    setErreur(null);
    try {
      onFin(await api<ResultatAnalyse>(`/lots/${lotId}/analyses`, { method: "POST", body: analyseVersApi(valeurs) }));
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
        <button type="button" onClick={() => onFin(null)} className="btn-secondary">
          Annuler
        </button>
      </div>
    </form>
  );
}

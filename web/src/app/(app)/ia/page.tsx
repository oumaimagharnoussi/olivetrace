"use client";

import Link from "next/link";
import { useState } from "react";
import { Carte, Champ, Erreur, Tableau, td } from "@/components/vrac/ui";
import {
  type Anomalies,
  type Evolution,
  FIABILITES,
  type PrevisionHuilerie,
  type Recommandations,
  TYPES_ANOMALIE,
  classeRisque,
  pourcent,
  valeur,
} from "@/lib/ia";
import { nomPays } from "@/lib/export";
import { useApi } from "@/lib/useApi";
import { type Ref, date, kg } from "@/lib/vrac";

const ONGLETS = {
  huileries: "Prévision par huilerie",
  evolution: "Évolution en stock",
  recommandations: "Recommandations",
  anomalies: "Anomalies",
} as const;

type Onglet = keyof typeof ONGLETS;

export default function IaPage() {
  const [onglet, setOnglet] = useState<Onglet>("huileries");
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-stone-900">Intelligence artificielle</h1>
        <p className="text-stone-500">
          Aides à la décision calculées sur l&apos;historique de la plateforme. Elles s&apos;affinent à chaque réception et à chaque analyse saisies.
        </p>
      </div>
      <div className="flex flex-wrap gap-1 border-b border-stone-200">
        {(Object.keys(ONGLETS) as Onglet[]).map((o) => (
          <button
            key={o}
            onClick={() => setOnglet(o)}
            className={`-mb-px border-b-2 px-4 py-2 text-sm ${onglet === o ? "border-olive-700 font-medium text-olive-800" : "border-transparent text-stone-600 hover:text-stone-900"}`}
          >
            {ONGLETS[o]}
          </button>
        ))}
      </div>
      {onglet === "huileries" && <OngletHuileries />}
      {onglet === "evolution" && <OngletEvolution />}
      {onglet === "recommandations" && <OngletRecommandations />}
      {onglet === "anomalies" && <OngletAnomalies />}
    </div>
  );
}

function Explication({ children }: { children: React.ReactNode }) {
  return <p className="text-sm text-stone-500">{children}</p>;
}

function OngletHuileries() {
  const { data, erreur } = useApi<PrevisionHuilerie[]>("/ia/huileries");
  if (erreur) return <Erreur message={erreur} />;
  if (!data) return <p className="text-stone-500">Chargement…</p>;
  const colonnes = data[0]?.parametres.map((p) => `${p.libelle}${p.unite ? ` (${p.unite})` : ""}`) ?? [];
  return (
    <div className="space-y-3">
      <Explication>
        Qualité attendue du prochain lot de chaque huilerie, d&apos;après la première analyse de ses lots déjà reçus. Une huilerie avec peu de lots est
        rapprochée de la moyenne de toutes les huileries. Le risque est la probabilité que le lot ne soit pas extra vierge.
      </Explication>
      <Carte>
        <Tableau entetes={["Huilerie", "Lots analysés", "Conformes", "Risque non extra vierge", ...colonnes]} vide={data.length === 0}>
          {data.map((h) => (
            <tr key={h.huilerie.id}>
              <td className={`${td} font-medium`}>{h.huilerie.nom}</td>
              <td className={`${td} text-right tabular-nums`}>{h.lotsAnalyses}</td>
              <td className={`${td} text-right tabular-nums`}>{pourcent(h.tauxConformite)}</td>
              <td className={`${td} text-right font-medium tabular-nums ${classeRisque(h.risqueNonConforme)}`}>
                {h.lotsAnalyses ? pourcent(h.risqueNonConforme) : "–"}
              </td>
              {h.parametres.map((p) => (
                <td
                  key={p.parametre}
                  className={`${td} whitespace-nowrap text-right tabular-nums`}
                  title={p.prevision ? `8 fois sur 10 entre ${valeur(p.prevision.basse)} et ${valeur(p.prevision.haute)}` : undefined}
                >
                  {h.lotsAnalyses && p.prevision ? valeur(p.prevision.valeur) : "–"}
                </td>
              ))}
            </tr>
          ))}
        </Tableau>
      </Carte>
      {data.some((h) => h.lotsAnalyses > 0 && h.lotsAnalyses < 3) && (
        <p className="text-xs text-stone-500">Moins de 3 lots analysés : {FIABILITES.FAIBLE.libelle.toLowerCase()}, à prendre comme un ordre de grandeur.</p>
      )}
    </div>
  );
}

function OngletEvolution() {
  const { data, erreur } = useApi<Evolution>("/ia/evolution");
  if (erreur) return <Erreur message={erreur} />;
  if (!data) return <p className="text-stone-500">Chargement…</p>;
  const connues = data.vitesses.filter((v) => v.parMois !== null);
  return (
    <div className="space-y-4">
      <Explication>
        L&apos;huile vieillit en cuve : l&apos;acidité, l&apos;indice de peroxyde et le K270 montent lentement. La vitesse est apprise sur les lots analysés
        plusieurs fois (au moins une semaine d&apos;écart) ; elle sert à estimer la valeur actuelle des lots en stock et le délai avant la limite extra
        vierge.
      </Explication>
      <div className="grid gap-4 sm:grid-cols-3">
        {data.vitesses.map((v) => (
          <div key={v.parametre} className="rounded-lg border border-stone-200 bg-white p-4">
            <div className="text-sm text-stone-500">{v.libelle}</div>
            <div className="mt-1 text-xl font-semibold tabular-nums text-olive-800">
              {v.parMois === null ? "pas assez de données" : `${v.parMois >= 0 ? "+" : ""}${valeur(v.parMois, v.unite)} / mois`}
            </div>
            <div className="text-xs text-stone-500">appris sur {v.lots} lot(s), il en faut au moins 3</div>
          </div>
        ))}
      </div>
      {connues.length === 0 ? (
        <p className="text-sm text-stone-500">Les estimations apparaîtront quand au moins 3 lots auront été analysés deux fois.</p>
      ) : (
        <Carte titre={`Lots en stock (${data.lots.length})`}>
          <Tableau entetes={["Lot", "Stock", "Dernière analyse", "Valeur estimée aujourd'hui", "Limite extra vierge atteinte"]} vide={data.lots.length === 0}>
            {data.lots.map((l) => (
              <tr key={l.lot.id} className={l.alerte ? "bg-red-50/50" : undefined}>
                <td className={td}>
                  <Link href={`/lots/${l.lot.id}`} className="font-medium text-olive-700 hover:underline">
                    {l.lot.code}
                  </Link>
                </td>
                <td className={`${td} whitespace-nowrap`}>{kg(l.stockKg)}</td>
                <td className={`${td} whitespace-nowrap`}>
                  {date(l.derniereAnalyse)} <span className="text-stone-500">({l.joursDepuisAnalyse} j)</span>
                </td>
                <td className={td}>
                  {l.parametres.map((p) => (
                    <div key={p.parametre} className="whitespace-nowrap">
                      {p.libelle} {valeur(p.mesure)} → <strong>{valeur(p.estimee)}</strong>
                      {p.max !== null && <span className="text-stone-500"> (max. {valeur(p.max)})</span>}
                    </div>
                  ))}
                </td>
                <td className={`${td} whitespace-nowrap ${l.alerte ? "font-medium text-red-700" : ""}`}>
                  {l.joursAvantLimite === null ? "non prévue" : l.joursAvantLimite === 0 ? "déjà dépassée" : `dans ${l.joursAvantLimite} jours environ`}
                </td>
              </tr>
            ))}
          </Tableau>
        </Carte>
      )}
    </div>
  );
}

function OngletRecommandations() {
  const clients = useApi<(Ref & { pays: string; raisonSociale: string })[]>("/clients");
  const [clientId, setClientId] = useState("");
  const { data, erreur } = useApi<Recommandations>(clientId ? `/ia/recommandations?clientId=${clientId}` : null);
  const base = {
    CLIENT: "d'après les expéditions déjà faites pour ce client",
    PAYS: "d'après les expéditions vers ce pays",
    TOUS: "d'après toutes les expéditions export",
    AUCUN: "",
  };
  return (
    <div className="space-y-4">
      <Explication>
        Pour une commande, les lots en cuve qui peuvent partir (analysés, conformes, non bloqués, dans le cahier des charges du client) sont classés par
        score : 60 points pour la marge de qualité, 40 pour l&apos;ancienneté (premier entré, premier sorti). Les formats sont ceux qui partent le plus vers
        ce client ou son pays.
      </Explication>
      <div className="max-w-sm">
        <Champ label="Client">
          <select className="input" value={clientId} onChange={(e) => setClientId(e.target.value)}>
            <option value="">Choisir…</option>
            {clients.data?.map((c) => (
              <option key={c.id} value={c.id}>
                {c.raisonSociale} ({nomPays(c.pays)})
              </option>
            ))}
          </select>
        </Champ>
      </div>
      <Erreur message={erreur} />
      {clientId && data && data.client.id === Number(clientId) && (
        <div className="grid gap-6 xl:grid-cols-3">
          <div className="xl:col-span-2">
            <Carte
              titre="Lots recommandés"
              actions={
                <span className="text-xs text-stone-500">
                  {data.cahiersDesCharges.length ? `Cahier des charges : ${data.cahiersDesCharges.join(", ")}` : "Pas de cahier des charges pour ce client"}
                </span>
              }
            >
              <Tableau entetes={["Score", "Lot", "Stock", "Pourquoi"]} vide={data.lots.length === 0}>
                {data.lots.map((l) => (
                  <tr key={l.lot.id} className={l.autorise ? undefined : "text-stone-400"}>
                    <td className={`${td} text-right text-lg font-semibold tabular-nums ${l.autorise ? "text-olive-800" : "text-stone-400"}`}>
                      {l.autorise ? l.score : "–"}
                    </td>
                    <td className={td}>
                      <Link href={`/lots/${l.lot.id}`} className="font-medium text-olive-700 hover:underline">
                        {l.lot.code}
                      </Link>
                      <div className="text-xs text-stone-500">{[l.lot.variete, l.lot.huilerie].filter(Boolean).join(", ")}</div>
                    </td>
                    <td className={`${td} whitespace-nowrap`}>{kg(l.stockKg)}</td>
                    <td className={`${td} text-sm`}>
                      {l.autorise ? (
                        l.raisons.join(", ")
                      ) : (
                        <span className="text-red-700">{l.blocages.join(" ")}</span>
                      )}
                    </td>
                  </tr>
                ))}
              </Tableau>
            </Carte>
          </div>
          <Carte titre="Formats conseillés">
            {data.formats.liste.length === 0 ? (
              <p className="text-sm text-stone-500">Aucune expédition export pour l&apos;instant : pas encore d&apos;historique de formats.</p>
            ) : (
              <>
                <p className="mb-3 text-xs text-stone-500">{base[data.formats.base]}</p>
                <ul className="space-y-2 text-sm">
                  {data.formats.liste.map((f) => (
                    <li key={f.format.id} className="flex items-baseline justify-between gap-3">
                      <span>{f.format.nom}</span>
                      <span className="whitespace-nowrap tabular-nums text-stone-600">
                        {pourcent(f.part)} des volumes, {valeur(f.litres)} L
                      </span>
                    </li>
                  ))}
                </ul>
              </>
            )}
          </Carte>
        </div>
      )}
    </div>
  );
}

function OngletAnomalies() {
  const [jours, setJours] = useState(90);
  const { data, erreur } = useApi<Anomalies>(`/ia/anomalies?jours=${jours}`);
  return (
    <div className="space-y-4">
      <Explication>
        Valeurs d&apos;analyse très éloignées de l&apos;historique, réceptions de taille inhabituelle pour l&apos;huilerie, pertes de filtration anormales,
        huile sortie de cuve qui ne correspond pas aux bouteilles remplies, dates incohérentes. Une anomalie n&apos;est pas forcément une erreur : elle
        mérite une vérification.
      </Explication>
      <div className="flex flex-wrap items-end gap-3">
        <Champ label="Période">
          <select className="input" value={jours} onChange={(e) => setJours(Number(e.target.value))}>
            <option value={30}>30 derniers jours</option>
            <option value={90}>90 derniers jours</option>
            <option value={365}>12 derniers mois</option>
            <option value={3650}>Tout l&apos;historique</option>
          </select>
        </Champ>
        {data && (
          <p className="pb-2 text-xs text-stone-500">
            Historique : {data.historique.analyses} analyses, {data.historique.receptions} réceptions, {data.historique.filtrations} filtrations. Les valeurs
            inhabituelles demandent au moins {data.historique.minimum} mesures comparables.
          </p>
        )}
      </div>
      <Erreur message={erreur} />
      {!data ? (
        !erreur && <p className="text-stone-500">Chargement…</p>
      ) : (
        <Carte titre={`Anomalies (${data.anomalies.length})`}>
          {data.anomalies.length === 0 ? (
            <p className="text-sm text-stone-500">Aucune anomalie sur la période.</p>
          ) : (
            <ul className="space-y-3 text-sm">
              {data.anomalies.map((a, i) => (
                <li key={i} className="flex flex-wrap items-start gap-2">
                  <span className={`mt-0.5 rounded-full px-2 py-0.5 text-xs ${a.niveau === "ALERTE" ? "bg-red-100 text-red-700" : "bg-amber-100 text-amber-800"}`}>
                    {TYPES_ANOMALIE[a.type]}
                  </span>
                  <span className="text-stone-500">{date(a.date)}</span>
                  <Link href={`/${a.lien.type === "lot" ? "lots" : "conditionnement"}/${a.lien.id}`} className="font-medium text-olive-700 hover:underline">
                    {a.lien.code}
                  </Link>
                  <span className="min-w-0 flex-1 text-stone-800">{a.message}</span>
                </li>
              ))}
            </ul>
          )}
        </Carte>
      )}
    </div>
  );
}

"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { BarresHorizontales, Indicateur, Jauge } from "@/components/tableau-de-bord/graphiques";
import { Carte, Erreur, Tableau, td } from "@/components/vrac/ui";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { COULEURS_STATUT, STATUTS_EXPEDITION, nomPays } from "@/lib/export";
import type { Anomalies, Evolution } from "@/lib/ia";
import { STATUTS_NC } from "@/lib/qualite";
import { TYPE_STOCKAGE } from "@/lib/ressources";
import { type EtatTableauDeBord, ROLES_RAPPORTS, entier, litresTexte } from "@/lib/tableau-de-bord";
import { useApi } from "@/lib/useApi";
import { date, kg } from "@/lib/vrac";

/** Rafraîchissement automatique du tableau de bord. */
const RAFRAICHISSEMENT_MS = 60_000;

export default function TableauDeBordPage() {
  const { user, can } = useAuth();
  const { data, erreur, recharger, chargeLe: majA } = useApi<EtatTableauDeBord>("/tableau-de-bord");
  const anomalies = useApi<Anomalies>("/ia/anomalies?jours=30");
  const evolution = useApi<Evolution>("/ia/evolution");
  const [inscriptions, setInscriptions] = useState(0);
  const estAdmin = user?.role === "ADMIN";

  useEffect(() => {
    const id = setInterval(recharger, RAFRAICHISSEMENT_MS);
    return () => clearInterval(id);
  }, [recharger]);

  useEffect(() => {
    if (!estAdmin) return;
    api<{ actif: boolean; role: string | null }[]>("/users")
      .then((users) => setInscriptions(users.filter((u) => !u.actif && u.role === null).length))
      .catch(() => {});
  }, [estAdmin]);

  const i = data?.indicateurs;
  const nbAnomalies = anomalies.data?.anomalies.length ?? 0;
  const nbDepassements = evolution.data?.lots.filter((l) => l.alerte && (l.joursAvantLimite ?? 0) > 0).length ?? 0;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-stone-900">Tableau de bord</h1>
          <p className="text-stone-500">
            Bonjour {user?.nom}.{" "}
            {majA && <>Situation à {majA.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}, mise à jour chaque minute.</>}
          </p>
        </div>
        <div className="flex gap-2">
          <button onClick={recharger} className="btn-secondary">
            Actualiser
          </button>
          {can(ROLES_RAPPORTS) && (
            <Link href="/rapports" className="btn-primary">
              Rapports
            </Link>
          )}
        </div>
      </div>

      {inscriptions > 0 && (
        <Link href="/utilisateurs" className="block rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 hover:border-amber-400">
          {inscriptions} inscription{inscriptions > 1 ? "s" : ""} en attente de validation : attribuez un rôle pour activer le compte.
        </Link>
      )}
      {(nbAnomalies > 0 || nbDepassements > 0) && (
        <Link href="/ia" className="block rounded-lg border border-olive-200 bg-olive-50 px-4 py-3 text-sm text-olive-900 hover:border-olive-600">
          Intelligence artificielle :{" "}
          {[
            nbAnomalies > 0 && `${nbAnomalies} anomalie(s) détectée(s) sur 30 jours`,
            nbDepassements > 0 && `${nbDepassements} lot(s) risquent de dépasser la limite extra vierge d'ici ${evolution.data!.horizonJours} jours`,
          ]
            .filter(Boolean)
            .join(", ")}
          . Voir le détail.
        </Link>
      )}
      <Erreur message={erreur} />

      {!data || !i ? (
        !erreur && <p className="text-stone-500">Chargement…</p>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
            <Indicateur libelle="Lots vrac actifs" valeur={entier(i.lotsActifs)} detail={`${i.cuves - i.cuvesVides} cuve(s) occupée(s) sur ${i.cuves}`} href="/lots" />
            <Indicateur libelle="Stock en cuves" valeur={kg(i.stockVracKg)} detail={`${i.tauxRemplissage.toLocaleString("fr-FR")} % de ${kg(i.capaciteKg)}`} href="/stock" />
            <Indicateur
              libelle="Produits finis"
              valeur={entier(i.produitsFinisUnites)}
              detail={`unités, soit ${litresTexte(i.produitsFinisLitres)} (${i.lotsConditionnesEnStock} lot(s))`}
              href="/produits-finis"
            />
            <Indicateur
              libelle="Non-conformités ouvertes"
              valeur={entier(i.nonConformitesOuvertes)}
              detail={`${i.lotsBloques} lot(s) bloqué(s)`}
              href="/qualite"
              alerte={i.nonConformitesOuvertes > 0}
            />
            <Indicateur libelle="Expéditions en cours" valeur={entier(i.expeditionsEnCours)} detail="préparées ou parties" href="/expeditions" />
          </div>

          <div className="grid gap-6 xl:grid-cols-2">
            <Carte titre="Stock par cuve et citerne" actions={<Link href="/stock" className="text-sm text-olive-700 hover:underline">Détail</Link>}>
              {data.cuves.length === 0 ? (
                <p className="text-sm text-stone-500">Aucune cuve active.</p>
              ) : (
                <ul className="space-y-3">
                  {data.cuves.map((c) => (
                    <li key={c.id} className="text-sm">
                      <div className="mb-1 flex flex-wrap items-baseline justify-between gap-2">
                        <span>
                          <span className="font-medium text-stone-900">{c.code}</span>{" "}
                          <span className="text-xs text-stone-500">{TYPE_STOCKAGE[c.type] ?? c.type}</span>
                          {c.lot && (
                            <>
                              {" · "}
                              <Link href={`/lots/${c.lot.id}`} className="text-olive-700 hover:underline">
                                {c.lot.code}
                              </Link>
                              <span className="text-stone-500">
                                {c.lot.variete ? ` ${c.lot.variete}` : ""}, {c.lot.joursEnStock} j
                              </span>
                            </>
                          )}
                        </span>
                        <span className="tabular-nums text-stone-600">
                          {kg(c.quantiteKg)} / {kg(c.capaciteKg)} ({c.tauxRemplissage.toLocaleString("fr-FR")} %)
                        </span>
                      </div>
                      <Jauge taux={c.tauxRemplissage} />
                    </li>
                  ))}
                </ul>
              )}
            </Carte>

            <div className="space-y-6">
              <Carte titre="Produits finis par format" actions={<Link href="/produits-finis" className="text-sm text-olive-700 hover:underline">Détail</Link>}>
                <BarresHorizontales
                  lignes={data.produitsFinis.map((f) => ({ libelle: f.format.nom, valeur: f.unites, detail: litresTexte(f.litres) }))}
                  format={(v) => `${entier(v)} u.`}
                  vide="Aucun produit fini en stock."
                />
              </Carte>

              <Carte titre="Qualité des lots en stock" actions={<Link href="/qualite" className="text-sm text-olive-700 hover:underline">Détail</Link>}>
                <div className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
                  {[
                    ["Conformes", data.qualite.conformes, false],
                    ["Non conformes", data.qualite.nonConformes, data.qualite.nonConformes > 0],
                    ["Incomplets", data.qualite.incomplets, false],
                    ["Sans analyse", data.qualite.sansAnalyse, false],
                  ].map(([libelle, n, rouge]) => (
                    <div key={libelle as string} className="rounded-md bg-stone-50 px-3 py-2">
                      <div className="text-stone-500">{libelle}</div>
                      <div className={`text-xl font-semibold tabular-nums ${rouge ? "text-red-700" : "text-stone-900"}`}>{n as number}</div>
                    </div>
                  ))}
                </div>
              </Carte>
            </div>
          </div>

          <div className="grid gap-6 xl:grid-cols-2">
            <Carte titre={`Alertes (${data.alertes.length})`}>
              {data.alertes.length === 0 ? (
                <p className="text-sm text-stone-500">Aucune alerte.</p>
              ) : (
                <ul className="space-y-2 text-sm">
                  {data.alertes.map((a, n) => (
                    <li key={n} className="flex items-start gap-2">
                      <span className={`mt-0.5 rounded-full px-2 py-0.5 text-xs ${a.niveau === "ALERTE" ? "bg-red-100 text-red-700" : "bg-amber-100 text-amber-800"}`}>
                        {a.niveau === "ALERTE" ? "Alerte" : "À faire"}
                      </span>
                      <Link href={a.lien ?? `/lots/${a.lotId}`} className="text-stone-800 hover:underline">
                        {a.message}
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </Carte>

            <Carte titre={`Non-conformités ouvertes (${data.nonConformites.length})`} actions={<Link href="/qualite" className="text-sm text-olive-700 hover:underline">Traiter</Link>}>
              <Tableau entetes={["N°", "Lot", "Statut", "Ouverte le", "Description"]} vide={data.nonConformites.length === 0}>
                {data.nonConformites.map((nc) => (
                  <tr key={nc.id}>
                    <td className={`${td} whitespace-nowrap font-medium`}>{nc.code}</td>
                    <td className={td}>
                      <Link href={`/lots/${nc.lot.id}`} className="text-olive-700 hover:underline">
                        {nc.lot.code}
                      </Link>
                    </td>
                    <td className={`${td} whitespace-nowrap`}>{STATUTS_NC[nc.statut as keyof typeof STATUTS_NC] ?? nc.statut}</td>
                    <td className={`${td} whitespace-nowrap`}>{date(nc.createdAt)}</td>
                    <td className={`${td} text-stone-600`}>{nc.description}</td>
                  </tr>
                ))}
              </Tableau>
            </Carte>
          </div>

          <div className="grid gap-6 xl:grid-cols-3">
            <div className="xl:col-span-2">
              <Carte titre="Expéditions en cours" actions={<Link href="/expeditions" className="text-sm text-olive-700 hover:underline">Toutes</Link>}>
                <Tableau entetes={["N°", "Client", "Destination", "Statut", "Départ", "Unités", "Volume"]} vide={data.expeditions.length === 0}>
                  {data.expeditions.map((e) => (
                    <tr key={e.id}>
                      <td className={td}>
                        <Link href={`/expeditions/${e.id}`} className="font-medium text-olive-700 hover:underline">
                          {e.code}
                        </Link>
                      </td>
                      <td className={td}>{e.client.raisonSociale}</td>
                      <td className={td}>{nomPays(e.paysDestination)}</td>
                      <td className={td}>
                        <span className={`rounded-full px-2 py-0.5 text-xs ${COULEURS_STATUT[e.statut]}`}>{STATUTS_EXPEDITION[e.statut]}</span>
                      </td>
                      <td className={`${td} whitespace-nowrap`}>{e.dateDepart ? date(e.dateDepart) : `prévu ${date(e.datePrevue)}`}</td>
                      <td className={`${td} text-right tabular-nums`}>{entier(e.unites)}</td>
                      <td className={`${td} whitespace-nowrap text-right tabular-nums`}>{litresTexte(e.litres)}</td>
                    </tr>
                  ))}
                </Tableau>
              </Carte>
            </div>
            <Carte titre="En cours par destination">
              <BarresHorizontales
                lignes={data.expeditionsParPays.map((p) => ({ libelle: nomPays(p.cle), valeur: p.litres, detail: `${p.expeditions} exp.` }))}
                format={litresTexte}
                vide="Aucune expédition en cours."
              />
            </Carte>
          </div>
        </>
      )}
    </div>
  );
}

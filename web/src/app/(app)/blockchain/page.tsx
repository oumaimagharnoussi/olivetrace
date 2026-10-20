"use client";

import { useState } from "react";
import { Carte, Champ, Erreur, Succes, Tableau, td } from "@/components/vrac/ui";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import {
  type EtatBlockchain,
  type EvenementAudit,
  type Preuve,
  ROLES_BLOCKCHAIN,
  STATUTS_ANCRAGE,
  type Verification,
  court,
} from "@/lib/blockchain";
import { useApi } from "@/lib/useApi";

const dateHeure = (v: string | null) => (v ? new Date(v).toLocaleString("fr-FR", { dateStyle: "short", timeStyle: "short" }) : "–");

export default function BlockchainPage() {
  const { can } = useAuth();
  const autorise = can(ROLES_BLOCKCHAIN);
  const etat = useApi<EtatBlockchain>(autorise ? "/blockchain" : null);
  const journal = useApi<EvenementAudit[]>(autorise ? "/audit?limit=30" : null);
  const [message, setMessage] = useState<string | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  const [envoi, setEnvoi] = useState(false);
  const [verification, setVerification] = useState<Verification | null>(null);
  const [preuve, setPreuve] = useState<Preuve | null>(null);
  const [auditId, setAuditId] = useState("");

  if (!autorise) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-semibold text-stone-900">Blockchain</h1>
        <p className="text-stone-500">Cette page est réservée à la direction et aux administrateurs.</p>
      </div>
    );
  }

  async function action<T>(fn: () => Promise<T>, apres: (r: T) => void) {
    setEnvoi(true);
    setErreur(null);
    setMessage(null);
    try {
      apres(await fn());
    } catch (e) {
      setErreur((e as Error).message);
    } finally {
      setEnvoi(false);
    }
  }

  const ancrer = () =>
    action(
      () => api<{ ancrage: { id: number; nombreEvenements: number } | null }>("/blockchain/ancrer", { method: "POST" }),
      (r) => {
        setMessage(r.ancrage ? `Ancrage ${r.ancrage.id} créé avec ${r.ancrage.nombreEvenements} événement(s).` : "Aucun nouvel événement à sceller.");
        etat.recharger();
        journal.recharger();
      },
    );
  const verifier = () => action(() => api<Verification>("/blockchain/verification"), setVerification);
  const voirPreuve = (id: string) => {
    setAuditId(id);
    action(() => api<Preuve>(`/blockchain/preuves/${id}`), setPreuve);
  };

  const e = etat.data;
  const portefeuille = e?.portefeuille && "adresse" in e.portefeuille ? e.portefeuille : null;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-stone-900">Blockchain</h1>
          <p className="max-w-3xl text-stone-500">
            Chaque événement du journal d&apos;audit (réception, transfert, analyse, mise en bouteille, expédition…) reçoit une empreinte. Les empreintes sont
            regroupées et seule l&apos;empreinte du groupe est inscrite sur la blockchain : les données restent confidentielles, mais toute modification
            après coup devient détectable.
          </p>
        </div>
        <div className="flex gap-2">
          <button onClick={verifier} disabled={envoi} className="btn-secondary">
            Vérifier l&apos;intégrité
          </button>
          <button onClick={ancrer} disabled={envoi} className="btn-primary">
            {envoi ? "En cours…" : "Ancrer maintenant"}
          </button>
        </div>
      </div>

      <Erreur message={etat.erreur ?? erreur} />
      <Succes message={message} />

      {e && (
        <div className="grid gap-4 sm:grid-cols-3">
          <div className="rounded-lg border border-stone-200 bg-white p-5">
            <div className="text-sm text-stone-500">Réseau</div>
            {portefeuille ? (
              <>
                <div className="mt-1 text-xl font-semibold text-olive-800">{portefeuille.reseau}</div>
                <div className="mt-1 break-all font-mono text-xs text-stone-500">{portefeuille.adresse}</div>
                <div className="text-xs text-stone-500">Solde : {Number(portefeuille.solde).toLocaleString("fr-FR", { maximumFractionDigits: 4 })} POL</div>
              </>
            ) : e.portefeuille && "erreur" in e.portefeuille ? (
              <div className="mt-1 text-sm text-red-700">Blockchain injoignable : {e.portefeuille.erreur}</div>
            ) : (
              <>
                <div className="mt-1 text-xl font-semibold text-stone-800">Non configuré</div>
                <div className="mt-1 text-xs text-stone-500">
                  Les événements sont scellés dans la base. Pour la preuve publique, renseigner BLOCKCHAIN_RPC_URL et BLOCKCHAIN_CLE_PRIVEE dans api/.env.
                </div>
              </>
            )}
          </div>
          <div className="rounded-lg border border-stone-200 bg-white p-5">
            <div className="text-sm text-stone-500">Événements scellés</div>
            <div className="mt-1 text-3xl font-semibold tabular-nums text-olive-800">{e.evenements.scelles.toLocaleString("fr-FR")}</div>
            <div className="text-xs text-stone-500">{e.evenements.nonScelles.toLocaleString("fr-FR")} en attente du prochain ancrage</div>
          </div>
          <div className="rounded-lg border border-stone-200 bg-white p-5">
            <div className="text-sm text-stone-500">Ancrage automatique</div>
            <div className="mt-1 text-xl font-semibold text-olive-800">{e.intervalleMinutes > 0 ? `toutes les ${e.intervalleMinutes} min` : "désactivé"}</div>
            <div className="text-xs text-stone-500">{e.ancrages.length ? `dernier : ${dateHeure(e.ancrages[0].createdAt)}` : "aucun ancrage pour l'instant"}</div>
          </div>
        </div>
      )}

      {verification && (
        <Carte titre={verification.ok ? "Intégrité vérifiée" : "Problèmes d'intégrité détectés"}>
          <p className={`text-sm ${verification.ok ? "text-olive-800" : "text-red-700"}`}>
            {verification.ok
              ? `Les ${verification.evenementsVerifies} événement(s) scellé(s) n'ont pas été modifiés depuis leur ancrage (vérifié le ${dateHeure(verification.verifieLe)}).`
              : "Des données du journal ont été modifiées ou supprimées après leur scellement :"}
          </p>
          {!verification.ok && (
            <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-red-700">
              {verification.ancrages.flatMap((a) => a.problemes.map((p, i) => <li key={`${a.id}-${i}`}>Ancrage {a.id} : {p}</li>))}
            </ul>
          )}
        </Carte>
      )}

      {e && (
        <Carte titre="Ancrages">
          <Tableau entetes={["N°", "Date", "Événements", "Statut", "Empreinte ancrée", "Transaction", "Bloc"]} vide={e.ancrages.length === 0}>
            {e.ancrages.map((a) => (
              <tr key={a.id}>
                <td className={`${td} font-medium`}>{a.id}</td>
                <td className={`${td} whitespace-nowrap`}>{dateHeure(a.createdAt)}</td>
                <td className={`${td} whitespace-nowrap tabular-nums`}>
                  {a.nombreEvenements} <span className="text-xs text-stone-500">(n° {a.premierAuditId} à {a.dernierAuditId})</span>
                </td>
                <td className={td}>
                  <span className={`whitespace-nowrap rounded-full px-2 py-0.5 text-xs ${STATUTS_ANCRAGE[a.statut].classe}`} title={a.erreur ?? undefined}>
                    {STATUTS_ANCRAGE[a.statut].libelle}
                  </span>
                </td>
                <td className={`${td} font-mono text-xs`} title={a.empreinte}>
                  {court(a.empreinte)}
                </td>
                <td className={`${td} font-mono text-xs`}>
                  {a.lien ? (
                    <a href={a.lien} target="_blank" rel="noreferrer" className="text-olive-700 hover:underline">
                      {court(a.txHash)}
                    </a>
                  ) : (
                    <span title={a.txHash ?? undefined}>{court(a.txHash)}</span>
                  )}
                </td>
                <td className={`${td} whitespace-nowrap text-xs`}>{a.blocNumero ? `${a.blocNumero.toLocaleString("fr-FR")}, ${dateHeure(a.blocDate)}` : "–"}</td>
              </tr>
            ))}
          </Tableau>
        </Carte>
      )}

      <div className="grid gap-6 xl:grid-cols-2">
        <Carte titre="Derniers événements du journal">
          <Erreur message={journal.erreur} />
          <Tableau entetes={["N°", "Date", "Événement", "Par", "Scellé", ""]} vide={!journal.data?.length}>
            {journal.data?.map((ev) => (
              <tr key={ev.id}>
                <td className={`${td} tabular-nums`}>{ev.id}</td>
                <td className={`${td} whitespace-nowrap`}>{dateHeure(ev.createdAt)}</td>
                <td className={td}>
                  {ev.action} {ev.entite} {ev.entiteId}
                </td>
                <td className={td}>{ev.user?.nom ?? "–"}</td>
                <td className={`${td} whitespace-nowrap text-xs`}>{ev.ancrage ? `ancrage ${ev.ancrage.id}` : "en attente"}</td>
                <td className={td}>
                  <button onClick={() => voirPreuve(ev.id)} className="text-sm text-olive-700 hover:underline">
                    Preuve
                  </button>
                </td>
              </tr>
            ))}
          </Tableau>
        </Carte>

        <Carte titre="Preuve d'un événement">
          <form
            onSubmit={(ev) => {
              ev.preventDefault();
              if (auditId) voirPreuve(auditId);
            }}
            className="mb-4 flex items-end gap-2"
          >
            <Champ label="N° d'événement">
              <input className="input max-w-[10rem]" inputMode="numeric" value={auditId} onChange={(ev) => setAuditId(ev.target.value.replace(/\D/g, ""))} />
            </Champ>
            <button className="btn-secondary">Afficher</button>
          </form>
          {preuve && (
            <div className="space-y-3 text-sm">
              <p className={preuve.intact ? "text-olive-800" : "text-red-700"}>
                {!preuve.ancrage
                  ? "Cet événement n'est pas encore scellé : il le sera au prochain ancrage."
                  : preuve.intact
                    ? `Événement ${preuve.evenement.id} intact : son empreinte mène bien à la racine de l'ancrage ${preuve.ancrage.id}.`
                    : `Événement ${preuve.evenement.id} modifié après son scellement : son empreinte ne mène plus à la racine de l'ancrage ${preuve.ancrage.id}.`}
              </p>
              <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1">
                <dt className="text-stone-500">Événement</dt>
                <dd>
                  {preuve.evenement.action} {preuve.evenement.entite} {preuve.evenement.entiteId}, {dateHeure(preuve.evenement.createdAt)}
                </dd>
                <dt className="text-stone-500">Empreinte</dt>
                <dd className="break-all font-mono text-xs">{preuve.empreinte}</dd>
                {preuve.ancrage && (
                  <>
                    <dt className="text-stone-500">Chemin de Merkle</dt>
                    <dd className="font-mono text-xs">
                      {preuve.chemin.length === 0
                        ? "seul événement de l'ancrage"
                        : preuve.chemin.map((c, i) => (
                            <div key={i} title={c.empreinte}>
                              {c.cote === "GAUCHE" ? "← " : "→ "}
                              {court(c.empreinte, 16)}
                            </div>
                          ))}
                    </dd>
                    <dt className="text-stone-500">Racine</dt>
                    <dd className="break-all font-mono text-xs">{preuve.ancrage.racineMerkle}</dd>
                    <dt className="text-stone-500">Ancrage</dt>
                    <dd>
                      {STATUTS_ANCRAGE[preuve.ancrage.statut].libelle}
                      {preuve.ancrage.lien && (
                        <>
                          {" · "}
                          <a href={preuve.ancrage.lien} target="_blank" rel="noreferrer" className="text-olive-700 hover:underline">
                            voir la transaction
                          </a>
                        </>
                      )}
                    </dd>
                  </>
                )}
                <dt className="text-stone-500">Données</dt>
                <dd>
                  <pre className="max-h-48 overflow-auto rounded bg-stone-50 p-2 text-xs">{JSON.stringify(preuve.evenement.donnees, null, 2)}</pre>
                </dd>
              </dl>
            </div>
          )}
        </Carte>
      </div>
    </div>
  );
}

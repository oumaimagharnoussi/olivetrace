"use client";

import Link from "next/link";
import { useState } from "react";
import { BadgeCategorie } from "@/components/qualite/Badges";
import { Carte, Champ, Erreur, Tableau, td } from "@/components/vrac/ui";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { PARAMETRES, type ParametreAnalyse, ROLES_QUALITE, type Specification, limites } from "@/lib/qualite";
import { useApi } from "@/lib/useApi";

type LigneCritere = { parametre: ParametreAnalyse; min: string; max: string };

export default function CriteresPage() {
  const { can } = useAuth();
  const specs = useApi<Specification[]>("/qualite/specifications");
  const [edition, setEdition] = useState<number | "nouveau" | null>(null);
  const modifiable = can(ROLES_QUALITE);

  const fin = (enregistre: boolean) => {
    setEdition(null);
    if (enregistre) specs.recharger();
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <Link href="/qualite" className="text-sm text-olive-700 hover:underline">
            ← Contrôle qualité
          </Link>
          <h1 className="text-2xl font-semibold text-stone-900">Critères de qualité</h1>
          <p className="text-sm text-stone-500">
            Chaque analyse est comparée aux catégories réglementaires (règlement UE 2022/2104). Les cahiers des charges clients sont contrôlés avant chaque vente.
          </p>
        </div>
        {modifiable && edition === null && (
          <button className="btn-primary" onClick={() => setEdition("nouveau")}>
            Nouveau cahier des charges client
          </button>
        )}
      </div>

      <Erreur message={specs.erreur} />
      {edition === "nouveau" && <FormulaireSpecification onFin={fin} />}

      {specs.data?.map((s) =>
        edition === s.id ? (
          <FormulaireSpecification key={s.id} specification={s} onFin={fin} />
        ) : (
          <Carte
            key={s.id}
            titre={s.nom}
            actions={
              <div className="flex items-center gap-3 text-sm">
                {s.categorie ? <BadgeCategorie categorie={s.categorie} /> : <span className="text-stone-600">Client : {s.client?.raisonSociale}</span>}
                {!s.actif && <span className="text-stone-400">Désactivé</span>}
                {modifiable && edition === null && (
                  <button className="text-olive-700 hover:underline" onClick={() => setEdition(s.id)}>
                    Modifier
                  </button>
                )}
              </div>
            }
          >
            <Tableau entetes={["Paramètre", "Limite"]} vide={s.criteres.length === 0}>
              {s.criteres.map((c) => (
                <tr key={c.parametre}>
                  <td className={td}>{PARAMETRES[c.parametre].libelle}</td>
                  <td className={td}>{limites(c.min, c.max, PARAMETRES[c.parametre].unite)}</td>
                </tr>
              ))}
            </Tableau>
          </Carte>
        ),
      )}
    </div>
  );
}

function FormulaireSpecification({ specification, onFin }: { specification?: Specification; onFin: (enregistre: boolean) => void }) {
  const clients = useApi<{ id: number; code: string; raisonSociale: string }[]>(specification ? null : "/clients");
  const [v, setV] = useState({ code: "", nom: specification?.nom ?? "", clientId: "", actif: specification?.actif ?? true });
  const [lignes, setLignes] = useState<LigneCritere[]>(
    specification?.criteres.map((c) => ({ parametre: c.parametre, min: c.min ?? "", max: c.max ?? "" })) ?? [
      { parametre: "ACIDITE", min: "", max: "" },
    ],
  );
  const [erreur, setErreur] = useState<string | null>(null);
  const [envoi, setEnvoi] = useState(false);
  const reglementaire = !!specification?.categorie;
  const utilises = new Set(lignes.map((l) => l.parametre));

  async function soumettre(e: React.FormEvent) {
    e.preventDefault();
    setEnvoi(true);
    setErreur(null);
    const criteres = lignes.map((l) => ({
      parametre: l.parametre,
      min: l.min === "" ? null : Number(l.min),
      max: l.max === "" ? null : Number(l.max),
    }));
    try {
      if (specification) {
        await api(`/qualite/specifications/${specification.id}`, {
          method: "PATCH",
          body: { nom: v.nom, ...(reglementaire ? {} : { actif: v.actif }), criteres },
        });
      } else {
        await api("/qualite/specifications", { method: "POST", body: { code: v.code, nom: v.nom, clientId: Number(v.clientId), criteres } });
      }
      onFin(true);
    } catch (e) {
      setErreur((e as Error).message);
    } finally {
      setEnvoi(false);
    }
  }

  const majLigne = (i: number, champ: keyof LigneCritere, valeur: string) =>
    setLignes((ls) => ls.map((l, j) => (j === i ? { ...l, [champ]: valeur } : l)));

  return (
    <form onSubmit={soumettre} className="space-y-4 rounded-lg border border-stone-200 bg-white p-5">
      <h2 className="font-medium text-stone-900">{specification ? `Modifier : ${specification.nom}` : "Nouveau cahier des charges client"}</h2>
      <div className="grid gap-4 sm:grid-cols-3">
        {!specification && (
          <>
            <Champ label="Client" requis>
              <select className="input" required value={v.clientId} onChange={(e) => setV({ ...v, clientId: e.target.value })}>
                <option value="">Choisir…</option>
                {clients.data?.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.raisonSociale} ({c.code})
                  </option>
                ))}
              </select>
            </Champ>
            <Champ label="Code" requis>
              <input className="input" required maxLength={32} placeholder="ex. CDC-OLIO" value={v.code} onChange={(e) => setV({ ...v, code: e.target.value })} />
            </Champ>
          </>
        )}
        <Champ label="Nom" requis>
          <input className="input" required maxLength={160} value={v.nom} onChange={(e) => setV({ ...v, nom: e.target.value })} />
        </Champ>
        {specification && !reglementaire && (
          <label className="flex items-center gap-2 self-end pb-2 text-sm text-stone-700">
            <input type="checkbox" checked={v.actif} onChange={(e) => setV({ ...v, actif: e.target.checked })} />
            Actif (contrôlé avant chaque vente au client)
          </label>
        )}
      </div>

      <div className="space-y-2">
        <div className="text-sm text-stone-700">
          Critères <span className="text-stone-500">(minimum et/ou maximum, bornes comprises)</span>
        </div>
        {lignes.map((l, i) => (
          <div key={i} className="flex flex-wrap items-center gap-2">
            <select className="input max-w-xs" value={l.parametre} onChange={(e) => majLigne(i, "parametre", e.target.value)}>
              {Object.entries(PARAMETRES).map(([p, info]) => (
                <option key={p} value={p} disabled={utilises.has(p as ParametreAnalyse) && l.parametre !== p}>
                  {info.libelle}
                  {info.unite && ` (${info.unite})`}
                </option>
              ))}
            </select>
            <input className="input max-w-[8rem]" type="number" step="any" placeholder="Minimum" value={l.min} onChange={(e) => majLigne(i, "min", e.target.value)} />
            <input className="input max-w-[8rem]" type="number" step="any" placeholder="Maximum" value={l.max} onChange={(e) => majLigne(i, "max", e.target.value)} />
            {lignes.length > 1 && (
              <button type="button" className="text-sm text-stone-500 hover:underline" onClick={() => setLignes((ls) => ls.filter((_, j) => j !== i))}>
                Retirer
              </button>
            )}
          </div>
        ))}
        {lignes.length < Object.keys(PARAMETRES).length && (
          <button
            type="button"
            className="text-sm text-olive-700 hover:underline"
            onClick={() => {
              const libre = (Object.keys(PARAMETRES) as ParametreAnalyse[]).find((p) => !utilises.has(p))!;
              setLignes((ls) => [...ls, { parametre: libre, min: "", max: "" }]);
            }}
          >
            + Ajouter un critère
          </button>
        )}
      </div>
      {reglementaire && (
        <p className="text-sm text-stone-500">Modifier ces critères recalcule le statut qualité de tous les lots analysés.</p>
      )}

      <Erreur message={erreur} />
      <div className="flex gap-3">
        <button type="submit" disabled={envoi} className="btn-primary">
          {envoi ? "Enregistrement…" : "Enregistrer"}
        </button>
        <button type="button" onClick={() => onFin(false)} className="btn-secondary">
          Annuler
        </button>
      </div>
    </form>
  );
}

"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { ROLE_LABELS, type Role } from "@/lib/roles";
import { TYPE_STOCKAGE, type Champ, type Ressource } from "@/lib/ressources";

type Item = Record<string, unknown> & { id: number; actif: boolean };
type Valeurs = Record<string, string>;

/** Liste, création, modification et désactivation d'une ressource de l'API. */
export function CrudPage({ ressource }: { ressource: Ressource }) {
  const { can } = useAuth();
  const peutEcrire = can(ressource.rolesEcriture);
  const [items, setItems] = useState<Item[]>([]);
  const [inactifs, setInactifs] = useState(false);
  const [chargement, setChargement] = useState(true);
  const [erreur, setErreur] = useState<string | null>(null);
  const [edition, setEdition] = useState<Item | "nouveau" | null>(null);

  // Incrémenté pour recharger la liste après une modification.
  const [version, setVersion] = useState(0);
  const recharger = () => setVersion((v) => v + 1);

  useEffect(() => {
    let annule = false;
    api<Item[]>(`${ressource.endpoint}?inclureInactifs=true`)
      .then((data) => {
        if (annule) return;
        setItems(data);
        setErreur(null);
      })
      .catch((e: Error) => !annule && setErreur(e.message))
      .finally(() => !annule && setChargement(false));
    return () => {
      annule = true;
    };
  }, [ressource.endpoint, version]);

  async function basculerActif(item: Item) {
    try {
      await api(`${ressource.endpoint}/${item.id}`, { method: "PATCH", body: { actif: !item.actif } });
      recharger();
    } catch (e) {
      setErreur((e as Error).message);
    }
  }

  const visibles = items.filter((i) => inactifs || i.actif);
  const colonnes = ressource.champs.filter((c) => c.colonne);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold text-stone-900">{ressource.titre}</h1>
        {peutEcrire && edition === null && (
          <button onClick={() => setEdition("nouveau")} className="btn-primary">
            {ressource.ajouter}
          </button>
        )}
      </div>

      {erreur && <p className="rounded-md bg-red-50 px-4 py-3 text-sm text-red-700">{erreur}</p>}

      {edition !== null && (
        <Formulaire
          ressource={ressource}
          item={edition === "nouveau" ? null : edition}
          onAnnuler={() => setEdition(null)}
          onEnregistre={async () => {
            setEdition(null);
            recharger();
          }}
        />
      )}

      <div className="overflow-x-auto rounded-lg border border-stone-200 bg-white">
        <div className="flex items-center justify-between border-b border-stone-200 px-4 py-2 text-sm text-stone-600">
          <span>
            {visibles.length} élément{visibles.length > 1 ? "s" : ""}
          </span>
          <label className="flex items-center gap-2">
            <input type="checkbox" checked={inactifs} onChange={(e) => setInactifs(e.target.checked)} />
            Afficher les désactivés
          </label>
        </div>
        <table className="w-full text-left text-sm">
          <thead className="bg-stone-50 text-stone-600">
            <tr>
              {colonnes.map((c) => (
                <th key={c.name} className="px-4 py-2 font-medium">
                  {c.label}
                </th>
              ))}
              <th className="px-4 py-2 font-medium">Statut</th>
              {peutEcrire && <th className="px-4 py-2" />}
            </tr>
          </thead>
          <tbody>
            {chargement ? (
              <tr>
                <td colSpan={colonnes.length + 2} className="px-4 py-6 text-center text-stone-500">
                  Chargement…
                </td>
              </tr>
            ) : visibles.length === 0 ? (
              <tr>
                <td colSpan={colonnes.length + 2} className="px-4 py-6 text-center text-stone-500">
                  Aucun élément pour le moment.
                </td>
              </tr>
            ) : (
              visibles.map((item) => (
                <tr key={item.id} className="border-t border-stone-100">
                  {colonnes.map((c) => (
                    <td key={c.name} className="px-4 py-2 text-stone-800">
                      {afficher(c, item[c.name])}
                    </td>
                  ))}
                  <td className="px-4 py-2">
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs ${
                        item.actif ? "bg-olive-100 text-olive-800" : "bg-stone-100 text-stone-500"
                      }`}
                    >
                      {item.actif ? "Actif" : "Désactivé"}
                    </span>
                  </td>
                  {peutEcrire && (
                    <td className="space-x-3 whitespace-nowrap px-4 py-2 text-right">
                      <button onClick={() => setEdition(item)} className="text-olive-700 hover:underline">
                        Modifier
                      </button>
                      <button onClick={() => basculerActif(item)} className="text-stone-500 hover:underline">
                        {item.actif ? "Désactiver" : "Réactiver"}
                      </button>
                    </td>
                  )}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function afficher(champ: Champ, valeur: unknown): string {
  if (valeur === null || valeur === undefined || valeur === "") return "—";
  if (champ.name === "type") return TYPE_STOCKAGE[String(valeur)] ?? String(valeur);
  if (champ.name === "role") return ROLE_LABELS[valeur as Role] ?? String(valeur);
  if (champ.type === "number") return Number(valeur).toLocaleString("fr-FR");
  return String(valeur);
}

function Formulaire({
  ressource,
  item,
  onAnnuler,
  onEnregistre,
}: {
  ressource: Ressource;
  item: Item | null;
  onAnnuler: () => void;
  onEnregistre: () => Promise<void>;
}) {
  const [valeurs, setValeurs] = useState<Valeurs>(() =>
    Object.fromEntries(
      ressource.champs.map((c) => [c.name, item?.[c.name] == null ? "" : String(item[c.name])]),
    ),
  );
  const [erreur, setErreur] = useState<string | null>(null);
  const [envoi, setEnvoi] = useState(false);

  async function soumettre(e: React.FormEvent) {
    e.preventDefault();
    setEnvoi(true);
    setErreur(null);
    // Les champs vides ne sont pas envoyés ; les nombres sont convertis.
    const body: Record<string, unknown> = {};
    for (const c of ressource.champs) {
      const v = valeurs[c.name].trim();
      if (v === "") continue;
      body[c.name] = c.type === "number" ? Number(v) : v;
    }
    try {
      await api(item ? `${ressource.endpoint}/${item.id}` : ressource.endpoint, {
        method: item ? "PATCH" : "POST",
        body,
      });
      await onEnregistre();
    } catch (e) {
      setErreur((e as Error).message);
    } finally {
      setEnvoi(false);
    }
  }

  return (
    <form onSubmit={soumettre} className="space-y-4 rounded-lg border border-stone-200 bg-white p-5">
      <h2 className="font-medium text-stone-900">
        {item ? `Modifier ${String(item.code ?? item.nom ?? "")}` : ressource.ajouter}
      </h2>
      <div className="grid gap-4 sm:grid-cols-2">
        {ressource.champs.map((c) => {
          const requis = c.required || (c.requiredOnCreateOnly && !item);
          const props = {
            id: c.name,
            value: valeurs[c.name],
            required: requis,
            placeholder: c.placeholder ?? (c.requiredOnCreateOnly && item ? "Laisser vide pour ne pas changer" : undefined),
            onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
              setValeurs((v) => ({ ...v, [c.name]: e.target.value })),
            className: "input",
          };
          return (
            <div key={c.name} className={c.type === "textarea" ? "sm:col-span-2" : undefined}>
              <label htmlFor={c.name} className="mb-1 block text-sm text-stone-700">
                {c.label}
                {requis && <span className="text-red-600"> *</span>}
              </label>
              {c.type === "select" ? (
                <select {...props}>
                  <option value="">Choisir…</option>
                  {c.options?.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              ) : c.type === "textarea" ? (
                <textarea {...props} rows={3} />
              ) : (
                <input {...props} type={c.type ?? "text"} min={c.type === "number" ? 1 : undefined} />
              )}
            </div>
          );
        })}
      </div>
      {erreur && <p className="text-sm text-red-700">{erreur}</p>}
      <div className="flex gap-3">
        <button type="submit" disabled={envoi} className="btn-primary">
          {envoi ? "Enregistrement…" : "Enregistrer"}
        </button>
        <button type="button" onClick={onAnnuler} className="btn-secondary">
          Annuler
        </button>
      </div>
    </form>
  );
}

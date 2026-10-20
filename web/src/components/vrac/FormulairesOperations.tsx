"use client";

import { useState } from "react";
import { api } from "@/lib/api";
import { useApi } from "@/lib/useApi";
import { type Cuve, type MotifSortie, MOTIFS_SORTIE, aujourdhui, dateOperation, kg } from "@/lib/vrac";
import { Champ, Erreur } from "./ui";

interface Props {
  cuves: Cuve[];
  onAnnuler: () => void;
  onFin: (message: string) => void;
}

/** Libellé d'une cuve dans une liste de choix : code, lot et quantité. */
function libelle(c: Cuve) {
  return c.lot ? `${c.code} · ${c.lot.code} · ${kg(c.quantiteKg)}` : `${c.code} · vide (${kg(c.capaciteKg)})`;
}

function useEnvoi() {
  const [erreur, setErreur] = useState<string | null>(null);
  const [envoi, setEnvoi] = useState(false);
  async function envoyer(action: () => Promise<void>) {
    setEnvoi(true);
    setErreur(null);
    try {
      await action();
    } catch (e) {
      setErreur((e as Error).message);
    } finally {
      setEnvoi(false);
    }
  }
  return { erreur, envoi, envoyer };
}

function Boutons({ envoi, libelle, onAnnuler, desactive }: { envoi: boolean; libelle: string; onAnnuler: () => void; desactive?: boolean }) {
  return (
    <div className="flex gap-3">
      <button type="submit" disabled={envoi || desactive} className="btn-primary">
        {envoi ? "Enregistrement…" : libelle}
      </button>
      <button type="button" onClick={onAnnuler} className="btn-secondary">
        Annuler
      </button>
    </div>
  );
}

export function FormulaireTransfert({ cuves, onAnnuler, onFin }: Props) {
  const [v, setV] = useState({ sourceId: "", destinationId: "", quantiteKg: "", date: aujourdhui(), notes: "" });
  const { erreur, envoi, envoyer } = useEnvoi();
  const source = cuves.find((c) => c.id === Number(v.sourceId));

  return (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        envoyer(async () => {
          await api("/operations/transfert", {
            method: "POST",
            body: {
              lotId: source!.lot!.id,
              sourceId: Number(v.sourceId),
              destinationId: Number(v.destinationId),
              quantiteKg: Number(v.quantiteKg),
              date: dateOperation(v.date),
              notes: v.notes || undefined,
            },
          });
          onFin(`Transfert de ${kg(Number(v.quantiteKg))} du lot ${source!.lot!.code} enregistré.`);
        });
      }}
    >
      <div className="grid gap-4 sm:grid-cols-3">
        <Champ label="Cuve de départ" requis>
          <select
            className="input"
            required
            value={v.sourceId}
            onChange={(e) => {
              const c = cuves.find((x) => x.id === Number(e.target.value));
              setV({ ...v, sourceId: e.target.value, quantiteKg: c ? String(c.quantiteKg) : "" });
            }}
          >
            <option value="">Choisir…</option>
            {cuves.filter((c) => c.lot).map((c) => (
              <option key={c.id} value={c.id}>
                {libelle(c)}
              </option>
            ))}
          </select>
        </Champ>
        <Champ label="Cuve d'arrivée" requis>
          <select className="input" required value={v.destinationId} onChange={(e) => setV({ ...v, destinationId: e.target.value })}>
            <option value="">Choisir…</option>
            {cuves
              .filter((c) => c.id !== source?.id && (!c.lot || c.lot.id === source?.lot?.id))
              .map((c) => (
                <option key={c.id} value={c.id}>
                  {libelle(c)}
                </option>
              ))}
          </select>
        </Champ>
        <Champ label="Quantité (kg)" requis>
          <input className="input" type="number" min={1} max={source?.quantiteKg} required value={v.quantiteKg} onChange={(e) => setV({ ...v, quantiteKg: e.target.value })} />
        </Champ>
        <Champ label="Date" requis>
          <input className="input" type="date" required value={v.date} onChange={(e) => setV({ ...v, date: e.target.value })} />
        </Champ>
        <Champ label="Notes" large>
          <input className="input" value={v.notes} onChange={(e) => setV({ ...v, notes: e.target.value })} />
        </Champ>
      </div>
      <p className="text-sm text-stone-500">La cuve d&apos;arrivée doit être vide ou contenir le même lot.</p>
      <Erreur message={erreur} />
      <Boutons envoi={envoi} libelle="Enregistrer le transfert" onAnnuler={onAnnuler} />
    </form>
  );
}

interface Controle {
  quantiteKg: number;
  aciditeEstimee: number | null;
  avertissements: string[];
}

export function FormulaireAssemblage({ cuves, onAnnuler, onFin }: Props) {
  const [entrees, setEntrees] = useState([
    { stockageId: "", quantiteKg: "" },
    { stockageId: "", quantiteKg: "" },
  ]);
  const [v, setV] = useState({ destinationId: "", code: "", date: aujourdhui(), notes: "" });
  const [controle, setControle] = useState<Controle | null>(null);
  const { erreur, envoi, envoyer } = useEnvoi();
  const pleines = cuves.filter((c) => c.lot);
  const sources = new Set(entrees.map((e) => Number(e.stockageId)));

  const body = () => ({
    entrees: entrees.map((e) => {
      const c = cuves.find((x) => x.id === Number(e.stockageId))!;
      return { lotId: c.lot!.id, stockageId: c.id, quantiteKg: Number(e.quantiteKg) };
    }),
    destinationId: Number(v.destinationId),
    code: v.code || undefined,
    date: dateOperation(v.date),
    notes: v.notes || undefined,
  });

  // Toute modification oblige à vérifier de nouveau avant de confirmer.
  const majEntree = (i: number, champ: "stockageId" | "quantiteKg", valeur: string) => {
    setControle(null);
    setEntrees((es) =>
      es.map((e, j) => {
        if (j !== i) return e;
        const maj = { ...e, [champ]: valeur };
        if (champ === "stockageId") maj.quantiteKg = String(cuves.find((c) => c.id === Number(valeur))?.quantiteKg ?? "");
        return maj;
      }),
    );
  };

  return (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        envoyer(async () => {
          if (!controle) {
            setControle(await api<Controle>("/operations/assemblage/simulation", { method: "POST", body: body() }));
            return;
          }
          const res = await api<{ lot: { code: string } }>("/operations/assemblage", { method: "POST", body: body() });
          onFin(`Assemblage enregistré : nouveau lot ${res.lot.code} (${kg(controle.quantiteKg)}).`);
        });
      }}
    >
      <div className="space-y-2">
        <div className="text-sm text-stone-700">
          Lots à assembler <span className="text-red-600">*</span>
        </div>
        {entrees.map((e, i) => (
          <div key={i} className="flex flex-wrap items-center gap-2">
            <select className="input max-w-sm" required value={e.stockageId} onChange={(ev) => majEntree(i, "stockageId", ev.target.value)}>
              <option value="">Cuve…</option>
              {pleines.map((c) => (
                <option key={c.id} value={c.id} disabled={sources.has(c.id) && Number(e.stockageId) !== c.id}>
                  {libelle(c)}
                </option>
              ))}
            </select>
            <input
              className="input max-w-[10rem]"
              type="number"
              min={1}
              required
              placeholder="Quantité (kg)"
              value={e.quantiteKg}
              onChange={(ev) => majEntree(i, "quantiteKg", ev.target.value)}
            />
            {entrees.length > 2 && (
              <button
                type="button"
                className="text-sm text-stone-500 hover:underline"
                onClick={() => {
                  setControle(null);
                  setEntrees((es) => es.filter((_, j) => j !== i));
                }}
              >
                Retirer
              </button>
            )}
          </div>
        ))}
        <button
          type="button"
          className="text-sm text-olive-700 hover:underline"
          onClick={() => {
            setControle(null);
            setEntrees((es) => [...es, { stockageId: "", quantiteKg: "" }]);
          }}
        >
          + Ajouter un lot
        </button>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Champ label="Cuve de l'assemblage" requis>
          <select
            className="input"
            required
            value={v.destinationId}
            onChange={(e) => {
              setControle(null);
              setV({ ...v, destinationId: e.target.value });
            }}
          >
            <option value="">Choisir…</option>
            {cuves.map((c) => (
              <option key={c.id} value={c.id}>
                {libelle(c)}
              </option>
            ))}
          </select>
        </Champ>
        <Champ label="Code du nouveau lot">
          <input className="input" placeholder="Généré automatiquement" value={v.code} onChange={(e) => setV({ ...v, code: e.target.value })} />
        </Champ>
        <Champ label="Date" requis>
          <input className="input" type="date" required value={v.date} onChange={(e) => setV({ ...v, date: e.target.value })} />
        </Champ>
        <Champ label="Notes" large>
          <input className="input" value={v.notes} onChange={(e) => setV({ ...v, notes: e.target.value })} />
        </Champ>
      </div>
      <p className="text-sm text-stone-500">
        La cuve de l&apos;assemblage doit être vide, ou se vider entièrement dans l&apos;assemblage.
      </p>

      {controle && (
        <div className="space-y-2 rounded-md border border-stone-200 bg-stone-50 p-4 text-sm">
          <div>
            Nouveau lot de <strong>{kg(controle.quantiteKg)}</strong>
            {controle.aciditeEstimee !== null && (
              <>
                , acidité estimée <strong>{controle.aciditeEstimee.toLocaleString("fr-FR")} %</strong>
              </>
            )}
            .
          </div>
          {controle.avertissements.length > 0 ? (
            <ul className="list-disc space-y-1 pl-5 text-amber-800">
              {controle.avertissements.map((a) => (
                <li key={a}>{a}</li>
              ))}
            </ul>
          ) : (
            <div className="text-olive-800">Aucun avertissement.</div>
          )}
        </div>
      )}

      <Erreur message={erreur} />
      <Boutons envoi={envoi} libelle={controle ? "Confirmer l'assemblage" : "Vérifier l'assemblage"} onAnnuler={onAnnuler} />
    </form>
  );
}

export function FormulaireSortie({ cuves, onAnnuler, onFin }: Props) {
  const clients = useApi<{ id: number; code: string; raisonSociale: string; adresse: string | null; ville: string | null }[]>("/clients");
  const [v, setV] = useState({ stockageId: "", quantiteKg: "", motif: "VENTE" as MotifSortie, clientId: "", date: aujourdhui(), notes: "" });
  const [transport, setTransport] = useState(true);
  const [l, setL] = useState({
    transporteur: "",
    immatriculation: "",
    chauffeur: "",
    numeroBl: "",
    adresseLivraison: "",
    dateEnlevement: aujourdhui(),
    dateLivraisonPrevue: "",
  });
  const { erreur, envoi, envoyer } = useEnvoi();
  const source = cuves.find((c) => c.id === Number(v.stockageId));
  const vente = v.motif === "VENTE";

  return (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        envoyer(async () => {
          const livraison = vente && transport ? Object.fromEntries(Object.entries(l).filter(([, x]) => x !== "")) : undefined;
          await api("/operations/sortie", {
            method: "POST",
            body: {
              lotId: source!.lot!.id,
              stockageId: source!.id,
              quantiteKg: Number(v.quantiteKg),
              motif: v.motif,
              clientId: vente ? Number(v.clientId) : undefined,
              date: dateOperation(v.date),
              notes: v.notes || undefined,
              livraison,
            },
          });
          onFin(`Sortie de ${kg(Number(v.quantiteKg))} du lot ${source!.lot!.code} enregistrée.`);
        });
      }}
    >
      <div className="grid gap-4 sm:grid-cols-3">
        <Champ label="Cuve" requis>
          <select
            className="input"
            required
            value={v.stockageId}
            onChange={(e) => {
              const c = cuves.find((x) => x.id === Number(e.target.value));
              setV({ ...v, stockageId: e.target.value, quantiteKg: c ? String(c.quantiteKg) : "" });
            }}
          >
            <option value="">Choisir…</option>
            {cuves.filter((c) => c.lot).map((c) => (
              <option key={c.id} value={c.id}>
                {libelle(c)}
              </option>
            ))}
          </select>
        </Champ>
        <Champ label="Quantité (kg)" requis>
          <input className="input" type="number" min={1} max={source?.quantiteKg} required value={v.quantiteKg} onChange={(e) => setV({ ...v, quantiteKg: e.target.value })} />
        </Champ>
        <Champ label="Motif" requis>
          <select className="input" value={v.motif} onChange={(e) => setV({ ...v, motif: e.target.value as MotifSortie })}>
            {Object.entries(MOTIFS_SORTIE).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </Champ>
        {vente && (
          <Champ label="Client" requis>
            <select
              className="input"
              required
              value={v.clientId}
              onChange={(e) => {
                const c = clients.data?.find((x) => x.id === Number(e.target.value));
                setV({ ...v, clientId: e.target.value });
                if (c && !l.adresseLivraison) setL({ ...l, adresseLivraison: [c.adresse, c.ville].filter(Boolean).join(", ") });
              }}
            >
              <option value="">Choisir…</option>
              {clients.data?.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.raisonSociale} ({c.code})
                </option>
              ))}
            </select>
          </Champ>
        )}
        <Champ label="Date" requis>
          <input className="input" type="date" required value={v.date} onChange={(e) => setV({ ...v, date: e.target.value })} />
        </Champ>
        <Champ label="Notes">
          <input className="input" value={v.notes} onChange={(e) => setV({ ...v, notes: e.target.value })} />
        </Champ>
      </div>

      {vente && (
        <div className="space-y-3">
          <label className="flex items-center gap-2 text-sm text-stone-700">
            <input type="checkbox" checked={transport} onChange={(e) => setTransport(e.target.checked)} />
            Transport sous-traité
          </label>
          {transport && (
            <div className="grid gap-4 sm:grid-cols-3">
              <Champ label="Transporteur" requis>
                <input className="input" required value={l.transporteur} onChange={(e) => setL({ ...l, transporteur: e.target.value })} />
              </Champ>
              <Champ label="Immatriculation">
                <input className="input" value={l.immatriculation} onChange={(e) => setL({ ...l, immatriculation: e.target.value })} />
              </Champ>
              <Champ label="Chauffeur">
                <input className="input" value={l.chauffeur} onChange={(e) => setL({ ...l, chauffeur: e.target.value })} />
              </Champ>
              <Champ label="N° de bon de livraison">
                <input className="input" value={l.numeroBl} onChange={(e) => setL({ ...l, numeroBl: e.target.value })} />
              </Champ>
              <Champ label="Date d'enlèvement">
                <input className="input" type="date" value={l.dateEnlevement} onChange={(e) => setL({ ...l, dateEnlevement: e.target.value })} />
              </Champ>
              <Champ label="Livraison prévue le">
                <input className="input" type="date" value={l.dateLivraisonPrevue} onChange={(e) => setL({ ...l, dateLivraisonPrevue: e.target.value })} />
              </Champ>
              <Champ label="Adresse de livraison" large>
                <input className="input" value={l.adresseLivraison} onChange={(e) => setL({ ...l, adresseLivraison: e.target.value })} />
              </Champ>
            </div>
          )}
        </div>
      )}

      <Erreur message={erreur} />
      <Boutons envoi={envoi} libelle="Enregistrer la sortie" onAnnuler={onAnnuler} />
    </form>
  );
}

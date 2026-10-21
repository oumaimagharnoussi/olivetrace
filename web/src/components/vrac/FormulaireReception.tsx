"use client";

import { useState } from "react";
import { api } from "@/lib/api";
import { CATEGORIES } from "@/lib/qualite";
import { useApi } from "@/lib/useApi";
import { type Cuve, type Ref, aujourdhui, campagneEnCours, kg } from "@/lib/vrac";
import { PrevisionQualite } from "@/components/ia/PrevisionQualite";
import { ChampsAnalyse, analyseVersApi, analyseVide } from "./ChampsAnalyse";
import { ChampsTransport, transportVersApi, transportVide } from "./ChampsTransport";
import { Champ, Erreur } from "./ui";

/** Réception d'huile d'une huilerie : nouveau lot réparti dans une ou plusieurs cuves vides. */
export function FormulaireReception({ onAnnuler, onEnregistre }: { onAnnuler: () => void; onEnregistre: (message: string) => void }) {
  const huileries = useApi<Ref[]>("/huileries");
  const varietes = useApi<Ref[]>("/varietes");
  const cuves = useApi<Cuve[]>("/stock");

  const [lot, setLot] = useState({
    code: "",
    huilerieId: "",
    varieteId: "",
    campagne: campagneEnCours(),
    dateReception: aujourdhui(),
    numeroBon: "",
    notes: "",
    categorieVisee: "EXTRA_VIERGE",
  });
  const [repartition, setRepartition] = useState([{ stockageId: "", quantiteKg: "" }]);
  const [avecAnalyse, setAvecAnalyse] = useState(false);
  const [analyse, setAnalyse] = useState(() => analyseVide(aujourdhui()));
  const [avecTransport, setAvecTransport] = useState(true);
  const [transport, setTransport] = useState(() => transportVide(aujourdhui()));
  const [erreur, setErreur] = useState<string | null>(null);
  const [envoi, setEnvoi] = useState(false);

  const total = repartition.reduce((s, r) => s + (Number(r.quantiteKg) || 0), 0);

  async function soumettre(e: React.FormEvent) {
    e.preventDefault();
    setEnvoi(true);
    setErreur(null);
    try {
      const res = await api<{ code: string; nonConformite: { code: string; description: string } | null }>("/lots/reception", {
        method: "POST",
        body: {
          code: lot.code || undefined,
          huilerieId: Number(lot.huilerieId),
          varieteId: Number(lot.varieteId),
          campagne: lot.campagne || undefined,
          dateReception: lot.dateReception,
          numeroBon: lot.numeroBon || undefined,
          notes: lot.notes || undefined,
          categorieVisee: lot.categorieVisee,
          repartition: repartition.map((r) => ({ stockageId: Number(r.stockageId), quantiteKg: Number(r.quantiteKg) })),
          analyse: avecAnalyse ? analyseVersApi(analyse) : undefined,
          transport: avecTransport ? transportVersApi(transport) : undefined,
        },
      });
      onEnregistre(
        res.nonConformite
          ? `Lot ${res.code} reçu mais bloqué : ${res.nonConformite.description} (non-conformité ${res.nonConformite.code}).`
          : `Lot ${res.code} enregistré.${avecTransport ? " Le bon de réception est disponible sur la fiche du lot." : ""}`,
      );
    } catch (e) {
      setErreur((e as Error).message);
    } finally {
      setEnvoi(false);
    }
  }

  const maj = (champ: keyof typeof lot) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setLot((l) => ({ ...l, [champ]: e.target.value }));

  return (
    <form onSubmit={soumettre} className="space-y-5 rounded-lg border border-stone-200 bg-white p-5">
      <h2 className="font-medium text-stone-900">Nouvelle réception</h2>
      <div className="grid gap-4 sm:grid-cols-3">
        <Champ label="Huilerie" requis>
          <select className="input" required value={lot.huilerieId} onChange={maj("huilerieId")}>
            <option value="">Choisir…</option>
            {huileries.data?.map((h) => (
              <option key={h.id} value={h.id}>
                {h.nom} ({h.code})
              </option>
            ))}
          </select>
        </Champ>
        <Champ label="Variété" requis>
          <select className="input" required value={lot.varieteId} onChange={maj("varieteId")}>
            <option value="">Choisir…</option>
            {varietes.data?.map((v) => (
              <option key={v.id} value={v.id}>
                {v.nom}
              </option>
            ))}
          </select>
        </Champ>
        <Champ label="Date de réception" requis>
          <input className="input" type="date" required value={lot.dateReception} onChange={maj("dateReception")} />
        </Champ>
        <Champ label="Campagne">
          <input className="input" placeholder="2026/2027" value={lot.campagne} onChange={maj("campagne")} />
        </Champ>
        <Champ label="N° de bon (huilerie)">
          <input className="input" value={lot.numeroBon} onChange={maj("numeroBon")} />
        </Champ>
        <Champ label="Code du lot">
          <input className="input" placeholder="Généré automatiquement" value={lot.code} onChange={maj("code")} />
        </Champ>
        <Champ label="Catégorie visée" requis>
          <select className="input" value={lot.categorieVisee} onChange={maj("categorieVisee")}>
            {Object.entries(CATEGORIES).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </Champ>
      </div>

      <PrevisionQualite huilerieId={lot.huilerieId} varieteId={lot.varieteId} />

      <div className="space-y-2">
        <div className="text-sm text-stone-700">
          Mise en cuve <span className="text-red-600">*</span>
          <span className="ml-2 text-stone-500">Total : {kg(total)}</span>
        </div>
        {repartition.map((r, i) => (
          <div key={i} className="flex flex-wrap items-center gap-2">
            <select
              className="input max-w-xs"
              required
              value={r.stockageId}
              onChange={(e) => setRepartition((rs) => rs.map((x, j) => (j === i ? { ...x, stockageId: e.target.value } : x)))}
            >
              <option value="">Cuve…</option>
              {cuves.data?.map((c) => (
                <option key={c.id} value={c.id} disabled={!!c.lot}>
                  {c.code} · {c.lot ? `occupée (${c.lot.code})` : `vide, ${kg(c.capaciteKg)}`}
                </option>
              ))}
            </select>
            <input
              className="input max-w-[10rem]"
              type="number"
              min={1}
              required
              placeholder="Quantité (kg)"
              value={r.quantiteKg}
              onChange={(e) => setRepartition((rs) => rs.map((x, j) => (j === i ? { ...x, quantiteKg: e.target.value } : x)))}
            />
            {repartition.length > 1 && (
              <button type="button" className="text-sm text-stone-500 hover:underline" onClick={() => setRepartition((rs) => rs.filter((_, j) => j !== i))}>
                Retirer
              </button>
            )}
          </div>
        ))}
        <button
          type="button"
          className="text-sm text-olive-700 hover:underline"
          onClick={() => setRepartition((rs) => [...rs, { stockageId: "", quantiteKg: "" }])}
        >
          + Ajouter une cuve
        </button>
      </div>

      <div className="space-y-3">
        <label className="flex items-center gap-2 text-sm text-stone-700">
          <input type="checkbox" checked={avecTransport} onChange={(e) => setAvecTransport(e.target.checked)} />
          Transport sous-traité et contrôles à l&apos;arrivée (bon de réception numérique)
        </label>
        {avecTransport && (
          <>
            <ChampsTransport valeurs={transport} onChange={setTransport} />
            {transport.quantiteAnnonceeKg && total > 0 && Number(transport.quantiteAnnonceeKg) !== total && (
              <p className="text-sm text-amber-800">
                Écart avec le bon de livraison : {kg(total - Number(transport.quantiteAnnonceeKg))} (
                {(((total - Number(transport.quantiteAnnonceeKg)) / Number(transport.quantiteAnnonceeKg)) * 100).toLocaleString("fr-FR", { maximumFractionDigits: 2 })} %).
              </p>
            )}
          </>
        )}
      </div>

      <div className="space-y-3">
        <label className="flex items-center gap-2 text-sm text-stone-700">
          <input type="checkbox" checked={avecAnalyse} onChange={(e) => setAvecAnalyse(e.target.checked)} />
          Saisir l&apos;analyse de laboratoire
        </label>
        {avecAnalyse && <ChampsAnalyse valeurs={analyse} onChange={setAnalyse} />}
      </div>

      <Champ label="Notes">
        <input className="input" value={lot.notes} onChange={maj("notes")} />
      </Champ>

      <Erreur message={erreur} />
      <div className="flex gap-3">
        <button type="submit" disabled={envoi} className="btn-primary">
          {envoi ? "Enregistrement…" : "Enregistrer la réception"}
        </button>
        <button type="button" onClick={onAnnuler} className="btn-secondary">
          Annuler
        </button>
      </div>
    </form>
  );
}

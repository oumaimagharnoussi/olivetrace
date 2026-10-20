"use client";

import { useState } from "react";
import { api } from "@/lib/api";
import { type StockProduitsFinis, litres, unites } from "@/lib/conditionnement";
import { type Expedition, INCOTERMS, MODES_TRANSPORT, type ModeTransport, PAYS_UE, nomPays } from "@/lib/export";
import type { ControleExpedition } from "@/lib/qualite";
import { useApi } from "@/lib/useApi";
import { aujourdhui } from "@/lib/vrac";
import { BlocControle } from "../qualite/Controle";
import { Boutons, useEnvoi } from "../vrac/FormulairesOperations";
import { Champ, Erreur } from "../vrac/ui";

type Client = { id: number; code: string; raisonSociale: string; pays: string; actif: boolean };

type Ligne = { lotConditionneId: string; quantiteUnites: string };

const CHAMPS_TEXTE = [
  ["transporteur", "Transporteur ou transitaire"],
  ["navire", "Navire / voyage ou vol"],
  ["portChargement", "Port ou lieu de chargement"],
  ["portDechargement", "Port ou lieu de déchargement"],
  ["numeroConteneur", "N° de conteneur"],
  ["numeroPlomb", "N° de plomb"],
  ["numeroConnaissement", "Connaissement (B/L), CMR ou LTA"],
  ["numeroCommande", "Commande du client"],
  ["numeroFacture", "N° de facture"],
] as const;

/** Contrôle qualité d'un lot pour le client, affiché sous sa ligne (blocages des étapes 3 et 4). */
function ControleLigne({ lotVracId, clientId }: { lotVracId: number; clientId: string }) {
  const { data } = useApi<ControleExpedition>(`/qualite/controle-expedition?lotId=${lotVracId}${clientId ? `&clientId=${clientId}` : ""}`);
  return <BlocControle controle={data} refus="expédition impossible" />;
}

/** Création d'une expédition, ou modification tant qu'elle est préparée. */
export function FormulaireExpedition({
  expedition,
  onAnnuler,
  onFin,
}: {
  expedition?: Expedition;
  onAnnuler: () => void;
  onFin: (id: number, message: string) => void;
}) {
  const clients = useApi<Client[]>("/clients");
  const stock = useApi<StockProduitsFinis>("/produits-finis");
  const { erreur, envoi, envoyer } = useEnvoi();
  const [v, setV] = useState({
    clientId: expedition ? String(expedition.clientId) : "",
    paysDestination: expedition?.paysDestination ?? "",
    adresseLivraison: expedition?.adresseLivraison ?? "",
    datePrevue: expedition ? expedition.datePrevue.slice(0, 10) : aujourdhui(),
    incoterm: expedition?.incoterm ?? "",
    lieuIncoterm: expedition?.lieuIncoterm ?? "",
    modeTransport: (expedition?.modeTransport ?? "MARITIME") as ModeTransport,
    transporteur: expedition?.transporteur ?? "",
    navire: expedition?.navire ?? "",
    portChargement: expedition?.portChargement ?? "",
    portDechargement: expedition?.portDechargement ?? "",
    numeroConteneur: expedition?.numeroConteneur ?? "",
    numeroPlomb: expedition?.numeroPlomb ?? "",
    numeroConnaissement: expedition?.numeroConnaissement ?? "",
    numeroCommande: expedition?.numeroCommande ?? "",
    numeroFacture: expedition?.numeroFacture ?? "",
    nombrePalettes: expedition?.nombrePalettes ? String(expedition.nombrePalettes) : "",
    poidsBrutKg: expedition?.poidsBrutKg ? String(expedition.poidsBrutKg) : "",
    notes: expedition?.notes ?? "",
  });
  const [lignes, setLignes] = useState<Ligne[]>(
    expedition
      ? expedition.lignes.map((l) => ({ lotConditionneId: String(l.lotConditionneId), quantiteUnites: String(l.quantiteUnites) }))
      : [{ lotConditionneId: "", quantiteUnites: "" }],
  );
  const set = (champ: keyof typeof v) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setV({ ...v, [champ]: e.target.value });
  const lots = stock.data?.lots ?? [];
  const client = clients.data?.find((c) => c.id === Number(v.clientId));
  const pays = v.paysDestination || client?.pays || "";
  const preparee = !expedition || expedition.statut === "PREPAREE";

  function majLigne(i: number, champ: keyof Ligne, valeur: string) {
    setLignes(lignes.map((l, j) => (j === i ? { ...l, [champ]: valeur } : l)));
  }

  const texte = (x: string) => x.trim() || undefined;

  return (
    <form
      className="space-y-5"
      onSubmit={(e) => {
        e.preventDefault();
        envoyer(async () => {
          const body = {
            ...(preparee
              ? {
                  clientId: Number(v.clientId),
                  lignes: lignes.map((l) => ({ lotConditionneId: Number(l.lotConditionneId), quantiteUnites: Number(l.quantiteUnites) })),
                }
              : {}),
            paysDestination: v.paysDestination || undefined,
            adresseLivraison: texte(v.adresseLivraison),
            datePrevue: v.datePrevue,
            incoterm: v.incoterm || undefined,
            lieuIncoterm: texte(v.lieuIncoterm),
            modeTransport: v.modeTransport,
            ...Object.fromEntries(CHAMPS_TEXTE.map(([champ]) => [champ, texte(v[champ])])),
            nombrePalettes: v.nombrePalettes ? Number(v.nombrePalettes) : undefined,
            poidsBrutKg: v.poidsBrutKg ? Number(v.poidsBrutKg) : undefined,
            notes: texte(v.notes),
          };
          const res = await api<{ expedition: Expedition; avertissements: string[] }>(expedition ? `/expeditions/${expedition.id}` : "/expeditions", {
            method: expedition ? "PATCH" : "POST",
            body,
          });
          const avert = res.avertissements.length ? ` À vérifier : ${res.avertissements.join(" ")}` : "";
          onFin(res.expedition.id, `Expédition ${res.expedition.code} ${expedition ? "modifiée" : "créée"}.${avert}`);
        });
      }}
    >
      <div className="grid gap-4 sm:grid-cols-3">
        <Champ label="Client" requis>
          <select className="input" required disabled={!preparee} value={v.clientId} onChange={set("clientId")}>
            <option value="">Choisir…</option>
            {clients.data
              ?.filter((c) => c.actif || c.id === Number(v.clientId))
              .map((c) => (
                <option key={c.id} value={c.id}>
                  {c.raisonSociale} ({c.pays})
                </option>
              ))}
          </select>
        </Champ>
        <Champ label="Pays de destination (code ISO)">
          <input
            className="input uppercase"
            maxLength={2}
            placeholder={client?.pays ?? "FR"}
            value={v.paysDestination}
            onChange={(e) => setV({ ...v, paysDestination: e.target.value.toUpperCase() })}
          />
          {pays && (
            <span className={`mt-1 block text-xs ${PAYS_UE.has(pays) ? "text-olive-700" : "text-amber-700"}`}>
              {nomPays(pays)} · {PAYS_UE.has(pays) ? "Union européenne" : "hors Union européenne"}
            </span>
          )}
        </Champ>
        <Champ label="Départ prévu le" requis>
          <input className="input" type="date" required value={v.datePrevue} onChange={set("datePrevue")} />
        </Champ>
        <Champ label="Adresse de livraison" large>
          <input className="input" placeholder="Laissée vide : l'adresse du client" value={v.adresseLivraison} onChange={set("adresseLivraison")} />
        </Champ>
        <Champ label="Mode de transport">
          <select className="input" value={v.modeTransport} onChange={set("modeTransport")}>
            {Object.entries(MODES_TRANSPORT).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </Champ>
        <Champ label="Incoterm">
          <select className="input" value={v.incoterm} onChange={set("incoterm")}>
            <option value="">—</option>
            {INCOTERMS.map((i) => (
              <option key={i} value={i}>
                {i}
              </option>
            ))}
          </select>
        </Champ>
        <Champ label="Lieu de l'incoterm">
          <input className="input" placeholder="ex. Sfax, Marseille" value={v.lieuIncoterm} onChange={set("lieuIncoterm")} />
        </Champ>
        {CHAMPS_TEXTE.map(([champ, label]) => (
          <Champ key={champ} label={label}>
            <input className="input" value={v[champ]} onChange={set(champ)} />
          </Champ>
        ))}
        <Champ label="Palettes">
          <input className="input" type="number" min={1} value={v.nombrePalettes} onChange={set("nombrePalettes")} />
        </Champ>
        <Champ label="Poids brut pesé (kg)">
          <input className="input" type="number" min={1} value={v.poidsBrutKg} onChange={set("poidsBrutKg")} />
        </Champ>
        <Champ label="Notes" large>
          <input className="input" value={v.notes} onChange={set("notes")} />
        </Champ>
      </div>

      <div className="space-y-3">
        <h3 className="font-medium text-stone-900">Lots à expédier</h3>
        {!preparee && <p className="text-sm text-stone-500">L&apos;expédition est partie : les lots ne se modifient plus.</p>}
        {preparee &&
          lignes.map((l, i) => {
            const lot = lots.find((x) => x.id === Number(l.lotConditionneId));
            return (
              <div key={i} className="space-y-2 rounded-md border border-stone-200 p-3">
                <div className="grid items-end gap-3 sm:grid-cols-[1fr_10rem_auto]">
                  <Champ label="Lot conditionné" requis>
                    <select className="input" required value={l.lotConditionneId} onChange={(e) => majLigne(i, "lotConditionneId", e.target.value)}>
                      <option value="">Choisir…</option>
                      {lots.map((x) => (
                        <option key={x.id} value={x.id} disabled={lignes.some((autre, j) => j !== i && autre.lotConditionneId === String(x.id))}>
                          {x.code} · {x.format.nom} · {unites(x.stockUnites)} en stock
                        </option>
                      ))}
                    </select>
                  </Champ>
                  <Champ label="Unités" requis>
                    <input
                      className="input"
                      type="number"
                      required
                      min={1}
                      max={lot?.stockUnites}
                      value={l.quantiteUnites}
                      onChange={(e) => majLigne(i, "quantiteUnites", e.target.value)}
                    />
                  </Champ>
                  <button
                    type="button"
                    className="btn-secondary"
                    disabled={lignes.length === 1}
                    onClick={() => setLignes(lignes.filter((_, j) => j !== i))}
                  >
                    Retirer
                  </button>
                </div>
                {lot && (
                  <p className="text-xs text-stone-500">
                    {litres((Number(l.quantiteUnites || 0) * lot.format.contenanceMl) / 1000)}
                    {lot.format.unitesParCarton && Number(l.quantiteUnites) > 0
                      ? ` · ${unites(Math.ceil(Number(l.quantiteUnites) / lot.format.unitesParCarton))} cartons de ${lot.format.unitesParCarton}`
                      : ""}
                  </p>
                )}
                {lot && <ControleLigne lotVracId={lot.lotVrac.id} clientId={v.clientId} />}
              </div>
            );
          })}
        {preparee && (
          <button type="button" className="text-sm text-olive-700 hover:underline" onClick={() => setLignes([...lignes, { lotConditionneId: "", quantiteUnites: "" }])}>
            + Ajouter un lot
          </button>
        )}
      </div>

      <Erreur message={erreur} />
      <Boutons envoi={envoi} libelle={expedition ? "Enregistrer" : "Créer l'expédition"} onAnnuler={onAnnuler} />
    </form>
  );
}

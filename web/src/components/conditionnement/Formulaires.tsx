"use client";

import { useState } from "react";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import {
  DENSITE_HUILE_KG_L,
  type Format,
  type LotConditionne,
  TYPES_MOUVEMENT_PRODUIT,
  type TypeMouvementProduit,
  unites,
} from "@/lib/conditionnement";
import type { ControleExpedition } from "@/lib/qualite";
import { useApi } from "@/lib/useApi";
import { type Cuve, aujourdhui, dateOperation, kg } from "@/lib/vrac";
import { BlocControle } from "../qualite/Controle";
import { Boutons, libelle, useEnvoi } from "../vrac/FormulairesOperations";
import { Champ, Erreur } from "../vrac/ui";

interface Props {
  cuves: Cuve[];
  onAnnuler: () => void;
  onFin: (message: string) => void;
}

type Client = { id: number; code: string; raisonSociale: string; pays: string };

/** Contrôle qualité d'un lot avant filtration ou mise en bouteille (lot analysé, conforme, non bloqué). */
function useControleConditionnement(lotId: number | undefined, clientId?: string) {
  const { data } = useApi<ControleExpedition>(
    lotId ? `/qualite/controle-expedition?lotId=${lotId}&conditionnement=true${clientId ? `&clientId=${clientId}` : ""}` : null,
  );
  return lotId ? data : null;
}

export function FormulaireFiltration({ cuves, onAnnuler, onFin }: Props) {
  const { user } = useAuth();
  const [v, setV] = useState({
    sourceId: "",
    destinationId: "",
    quantiteEntreeKg: "",
    quantiteSortieKg: "",
    operateur: user?.nom ?? "",
    typeFiltre: "",
    porositeMicrons: "",
    pressionBar: "",
    temperatureC: "",
    debitLh: "",
    dureeMinutes: "",
    code: "",
    date: aujourdhui(),
    notes: "",
  });
  const { erreur, envoi, envoyer } = useEnvoi();
  const source = cuves.find((c) => c.id === Number(v.sourceId));
  const controle = useControleConditionnement(source?.lot?.id);
  const perte = Number(v.quantiteEntreeKg) - Number(v.quantiteSortieKg);
  const set = (champ: keyof typeof v) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setV({ ...v, [champ]: e.target.value });
  const nombreOuRien = (x: string) => (x === "" ? undefined : Number(x));

  return (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        envoyer(async () => {
          const res = await api<{ filtration: { code: string; lotSortie: { code: string } }; avertissements: string[] }>("/filtrations", {
            method: "POST",
            body: {
              lotId: source!.lot!.id,
              sourceId: source!.id,
              destinationId: Number(v.destinationId),
              quantiteEntreeKg: Number(v.quantiteEntreeKg),
              quantiteSortieKg: Number(v.quantiteSortieKg),
              operateur: v.operateur,
              typeFiltre: v.typeFiltre || undefined,
              porositeMicrons: nombreOuRien(v.porositeMicrons),
              pressionBar: nombreOuRien(v.pressionBar),
              temperatureC: nombreOuRien(v.temperatureC),
              debitLh: nombreOuRien(v.debitLh),
              dureeMinutes: nombreOuRien(v.dureeMinutes),
              code: v.code || undefined,
              date: dateOperation(v.date),
              notes: v.notes || undefined,
            },
          });
          onFin(
            `Filtration ${res.filtration.code} enregistrée : lot filtré ${res.filtration.lotSortie.code} (${kg(Number(v.quantiteSortieKg))}).` +
              (res.avertissements.length ? ` ${res.avertissements.join(" ")}` : ""),
          );
        });
      }}
    >
      <div className="grid gap-4 sm:grid-cols-3">
        <Champ label="Cuve de départ (lot à filtrer)" requis>
          <select
            className="input"
            required
            value={v.sourceId}
            onChange={(e) => {
              const c = cuves.find((x) => x.id === Number(e.target.value));
              setV({ ...v, sourceId: e.target.value, quantiteEntreeKg: c ? String(c.quantiteKg) : "", quantiteSortieKg: c ? String(c.quantiteKg) : "" });
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
        <Champ label="Cuve d'arrivée (huile filtrée)" requis>
          <select className="input" required value={v.destinationId} onChange={set("destinationId")}>
            <option value="">Choisir…</option>
            {/* Une cuve vide, ou la cuve de départ si elle est vidée entièrement. */}
            {cuves
              .filter((c) => !c.lot || c.id === source?.id)
              .map((c) => (
                <option key={c.id} value={c.id}>
                  {libelle(c)}
                </option>
              ))}
          </select>
        </Champ>
        <Champ label="Date" requis>
          <input className="input" type="date" required value={v.date} onChange={set("date")} />
        </Champ>
        <Champ label="Huile mise en filtration (kg)" requis>
          <input className="input" type="number" min={1} max={source?.quantiteKg} required value={v.quantiteEntreeKg} onChange={set("quantiteEntreeKg")} />
        </Champ>
        <Champ label="Huile filtrée obtenue (kg)" requis>
          <input className="input" type="number" min={1} max={v.quantiteEntreeKg || undefined} required value={v.quantiteSortieKg} onChange={set("quantiteSortieKg")} />
        </Champ>
        <Champ label="Opérateur" requis>
          <input className="input" required value={v.operateur} onChange={set("operateur")} />
        </Champ>
        <Champ label="Type de filtre">
          <input className="input" placeholder="Plaques de cellulose, cartouches…" value={v.typeFiltre} onChange={set("typeFiltre")} />
        </Champ>
        <Champ label="Porosité (µm)">
          <input className="input" type="number" min={0} step="0.1" value={v.porositeMicrons} onChange={set("porositeMicrons")} />
        </Champ>
        <Champ label="Pression (bar)">
          <input className="input" type="number" min={0} step="0.01" value={v.pressionBar} onChange={set("pressionBar")} />
        </Champ>
        <Champ label="Température (°C)">
          <input className="input" type="number" step="0.1" value={v.temperatureC} onChange={set("temperatureC")} />
        </Champ>
        <Champ label="Débit (L/h)">
          <input className="input" type="number" min={1} value={v.debitLh} onChange={set("debitLh")} />
        </Champ>
        <Champ label="Durée (minutes)">
          <input className="input" type="number" min={1} value={v.dureeMinutes} onChange={set("dureeMinutes")} />
        </Champ>
        <Champ label="Code du lot filtré">
          <input className="input" placeholder="Généré si vide" value={v.code} onChange={set("code")} />
        </Champ>
        <Champ label="Notes" large>
          <input className="input" value={v.notes} onChange={set("notes")} />
        </Champ>
      </div>
      {v.quantiteEntreeKg && v.quantiteSortieKg && perte >= 0 && (
        <p className="text-sm text-stone-600">
          Perte de filtration : {kg(perte)}
          {Number(v.quantiteEntreeKg) > 0 && ` (${((perte / Number(v.quantiteEntreeKg)) * 100).toLocaleString("fr-FR", { maximumFractionDigits: 1 })} %)`}.
        </p>
      )}
      <BlocControle controle={controle} refus="filtration impossible" />
      <Erreur message={erreur} />
      <Boutons envoi={envoi} libelle="Enregistrer la filtration" onAnnuler={onAnnuler} desactive={controle?.autorise === false} />
    </form>
  );
}

export function FormulaireConditionnement({ cuves, onAnnuler, onFin }: Props) {
  const { user } = useAuth();
  const formats = useApi<Format[]>("/formats");
  const clients = useApi<Client[]>("/clients");
  const [v, setV] = useState({
    stockageId: "",
    formatId: "",
    nombreUnites: "",
    quantiteKg: "",
    code: "",
    dluo: "",
    clientId: "",
    paysDestination: "",
    destination: "",
    operateur: user?.nom ?? "",
    date: aujourdhui(),
    notes: "",
  });
  const { erreur, envoi, envoyer } = useEnvoi();
  const source = cuves.find((c) => c.id === Number(v.stockageId));
  const format = formats.data?.find((f) => f.id === Number(v.formatId));
  const controle = useControleConditionnement(source?.lot?.id, v.clientId);
  // Estimation affichée ; laissée vide, l'API calcule l'huile prise dans la cuve.
  const kgEstimes = format && v.nombreUnites ? Math.round(((Number(v.nombreUnites) * format.contenanceMl) / 1000) * DENSITE_HUILE_KG_L) : null;
  const set = (champ: keyof typeof v) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setV({ ...v, [champ]: e.target.value });

  return (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        envoyer(async () => {
          const res = await api<{ lot: LotConditionne; avertissements: string[] }>("/conditionnements", {
            method: "POST",
            body: {
              lotId: source!.lot!.id,
              stockageId: source!.id,
              formatId: Number(v.formatId),
              nombreUnites: Number(v.nombreUnites),
              quantiteKg: v.quantiteKg ? Number(v.quantiteKg) : undefined,
              code: v.code || undefined,
              dluo: v.dluo || undefined,
              clientId: v.clientId ? Number(v.clientId) : undefined,
              paysDestination: v.paysDestination || undefined,
              destination: v.destination || undefined,
              operateur: v.operateur || undefined,
              date: dateOperation(v.date),
              notes: v.notes || undefined,
            },
          });
          onFin(
            `Lot ${res.lot.code} enregistré : ${unites(res.lot.nombreUnites)} × ${res.lot.format.nom} (${kg(res.lot.quantiteKg)} d'huile).` +
              (res.avertissements.length ? ` ${res.avertissements.join(" ")}` : ""),
          );
        });
      }}
    >
      <div className="grid gap-4 sm:grid-cols-3">
        <Champ label="Cuve (lot à mettre en bouteille)" requis>
          <select className="input" required value={v.stockageId} onChange={set("stockageId")}>
            <option value="">Choisir…</option>
            {cuves.filter((c) => c.lot).map((c) => (
              <option key={c.id} value={c.id}>
                {libelle(c)}
              </option>
            ))}
          </select>
        </Champ>
        <Champ label="Format" requis>
          <select className="input" required value={v.formatId} onChange={set("formatId")}>
            <option value="">Choisir…</option>
            {formats.data?.map((f) => (
              <option key={f.id} value={f.id}>
                {f.nom}
              </option>
            ))}
          </select>
        </Champ>
        <Champ label="Nombre d'unités" requis>
          <input className="input" type="number" min={1} required value={v.nombreUnites} onChange={set("nombreUnites")} />
        </Champ>
        <Champ label="Huile prise dans la cuve (kg)">
          <input
            className="input"
            type="number"
            min={1}
            max={source?.quantiteKg}
            placeholder={kgEstimes ? `Calculée : ${kgEstimes}` : "Calculée si vide"}
            value={v.quantiteKg}
            onChange={set("quantiteKg")}
          />
        </Champ>
        <Champ label="Numéro de lot final">
          <input className="input" placeholder="Généré si vide (C2026-0001)" value={v.code} onChange={set("code")} />
        </Champ>
        <Champ label="DLUO">
          <input className="input" type="date" value={v.dluo} onChange={set("dluo")} />
        </Champ>
        <Champ label="Client">
          <select
            className="input"
            value={v.clientId}
            onChange={(e) => {
              const c = clients.data?.find((x) => x.id === Number(e.target.value));
              setV({ ...v, clientId: e.target.value, paysDestination: c?.pays ?? v.paysDestination });
            }}
          >
            <option value="">Aucun (stock)</option>
            {clients.data?.map((c) => (
              <option key={c.id} value={c.id}>
                {c.raisonSociale} ({c.code})
              </option>
            ))}
          </select>
        </Champ>
        <Champ label="Pays de destination">
          <input className="input" maxLength={2} placeholder="FR" value={v.paysDestination} onChange={(e) => setV({ ...v, paysDestination: e.target.value.toUpperCase() })} />
        </Champ>
        <Champ label="Destination / commande">
          <input className="input" placeholder="Marché, marque, n° de commande" value={v.destination} onChange={set("destination")} />
        </Champ>
        <Champ label="Opérateur">
          <input className="input" value={v.operateur} onChange={set("operateur")} />
        </Champ>
        <Champ label="Date" requis>
          <input className="input" type="date" required value={v.date} onChange={set("date")} />
        </Champ>
        <Champ label="Notes">
          <input className="input" value={v.notes} onChange={set("notes")} />
        </Champ>
      </div>
      <p className="text-sm text-stone-500">
        Sans DLUO saisie, elle est fixée à 18 mois après la mise en bouteille. Avec un client, son cahier des charges qualité est vérifié.
      </p>
      <BlocControle controle={controle} refus="mise en bouteille impossible" />
      <Erreur message={erreur} />
      <Boutons envoi={envoi} libelle="Enregistrer la mise en bouteille" onAnnuler={onAnnuler} desactive={controle?.autorise === false} />
    </form>
  );
}

export function FormulaireMouvementProduit({
  lots,
  lotId,
  onAnnuler,
  onFin,
}: {
  lots: LotConditionne[];
  lotId?: number;
  onAnnuler: () => void;
  onFin: (message: string) => void;
}) {
  const clients = useApi<Client[]>("/clients");
  const [v, setV] = useState({
    lotConditionneId: lotId ? String(lotId) : "",
    type: "EXPEDITION" as Exclude<TypeMouvementProduit, "CONDITIONNEMENT">,
    quantiteUnites: "",
    clientId: "",
    reference: "",
    date: aujourdhui(),
    notes: "",
  });
  const { erreur, envoi, envoyer } = useEnvoi();
  const lot = lots.find((l) => l.id === Number(v.lotConditionneId));
  const set = (champ: keyof typeof v) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setV({ ...v, [champ]: e.target.value });

  return (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        envoyer(async () => {
          await api("/produits-finis/mouvements", {
            method: "POST",
            body: {
              lotConditionneId: Number(v.lotConditionneId),
              type: v.type,
              quantiteUnites: Number(v.quantiteUnites),
              clientId: v.clientId ? Number(v.clientId) : undefined,
              reference: v.reference || undefined,
              date: dateOperation(v.date),
              notes: v.notes || undefined,
            },
          });
          onFin(`${TYPES_MOUVEMENT_PRODUIT[v.type]} de ${unites(Math.abs(Number(v.quantiteUnites)))} unités du lot ${lot!.code} enregistrée.`);
        });
      }}
    >
      <div className="grid gap-4 sm:grid-cols-3">
        <Champ label="Lot conditionné" requis>
          <select className="input" required value={v.lotConditionneId} onChange={set("lotConditionneId")}>
            <option value="">Choisir…</option>
            {lots.map((l) => (
              <option key={l.id} value={l.id}>
                {l.code} · {l.format.nom} · {unites(l.stockUnites)} en stock
              </option>
            ))}
          </select>
        </Champ>
        <Champ label="Mouvement" requis>
          <select className="input" value={v.type} onChange={set("type")}>
            {(["EXPEDITION", "CASSE", "AJUSTEMENT"] as const).map((t) => (
              <option key={t} value={t}>
                {TYPES_MOUVEMENT_PRODUIT[t]}
              </option>
            ))}
          </select>
        </Champ>
        <Champ label={v.type === "AJUSTEMENT" ? "Unités (+ ou -)" : "Unités"} requis>
          <input
            className="input"
            type="number"
            required
            min={v.type === "AJUSTEMENT" ? undefined : 1}
            max={v.type === "AJUSTEMENT" ? undefined : lot?.stockUnites}
            value={v.quantiteUnites}
            onChange={set("quantiteUnites")}
          />
        </Champ>
        {v.type === "EXPEDITION" && (
          <Champ label="Client" requis>
            <select className="input" required value={v.clientId} onChange={set("clientId")}>
              <option value="">Choisir…</option>
              {clients.data?.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.raisonSociale} ({c.code})
                </option>
              ))}
            </select>
          </Champ>
        )}
        <Champ label="Référence (BL, facture)">
          <input className="input" value={v.reference} onChange={set("reference")} />
        </Champ>
        <Champ label="Date" requis>
          <input className="input" type="date" required value={v.date} onChange={set("date")} />
        </Champ>
        <Champ label="Notes" large>
          <input className="input" value={v.notes} onChange={set("notes")} />
        </Champ>
      </div>
      <Erreur message={erreur} />
      <Boutons envoi={envoi} libelle="Enregistrer" onAnnuler={onAnnuler} />
    </form>
  );
}

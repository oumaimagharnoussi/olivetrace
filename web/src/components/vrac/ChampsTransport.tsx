"use client";

import type { TransportReception } from "@/lib/vrac";
import { Champ } from "./ui";

/** Champs du transport sous-traité d'une réception, tels que saisis dans le formulaire. */
export type ValeursTransport = {
  transporteur: string;
  immatriculation: string;
  chauffeur: string;
  numeroBl: string;
  conditionsLivraison: string;
  dateEnlevement: string;
  dateArrivee: string;
  quantiteAnnonceeKg: string;
  temperatureC: string;
  citerneConforme: "" | "oui" | "non";
  plombsIntacts: "" | "oui" | "non";
  numeroPlomb: string;
  receptionnePar: string;
  observations: string;
};

const jour = (d: string | null) => (d ? d.slice(0, 10) : "");
const ouiNon = (v: boolean | null): "" | "oui" | "non" => (v === null ? "" : v ? "oui" : "non");

export function transportVide(dateArrivee = ""): ValeursTransport {
  return {
    transporteur: "",
    immatriculation: "",
    chauffeur: "",
    numeroBl: "",
    conditionsLivraison: "",
    dateEnlevement: "",
    dateArrivee,
    quantiteAnnonceeKg: "",
    temperatureC: "",
    citerneConforme: "",
    plombsIntacts: "",
    numeroPlomb: "",
    receptionnePar: "",
    observations: "",
  };
}

export function transportDepuisApi(t: TransportReception): ValeursTransport {
  return {
    transporteur: t.transporteur,
    immatriculation: t.immatriculation ?? "",
    chauffeur: t.chauffeur ?? "",
    numeroBl: t.numeroBl ?? "",
    conditionsLivraison: t.conditionsLivraison ?? "",
    dateEnlevement: jour(t.dateEnlevement),
    dateArrivee: jour(t.dateArrivee),
    quantiteAnnonceeKg: t.quantiteAnnonceeKg?.toString() ?? "",
    temperatureC: t.temperatureC ?? "",
    citerneConforme: ouiNon(t.citerneConforme),
    plombsIntacts: ouiNon(t.plombsIntacts),
    numeroPlomb: t.numeroPlomb ?? "",
    receptionnePar: t.receptionnePar ?? "",
    observations: t.observations ?? "",
  };
}

export function transportVersApi(v: ValeursTransport) {
  const texte = (s: string) => s.trim() || undefined;
  const booleen = (s: "" | "oui" | "non") => (s === "" ? undefined : s === "oui");
  return {
    transporteur: v.transporteur.trim(),
    immatriculation: texte(v.immatriculation),
    chauffeur: texte(v.chauffeur),
    numeroBl: texte(v.numeroBl),
    conditionsLivraison: texte(v.conditionsLivraison),
    dateEnlevement: v.dateEnlevement || undefined,
    dateArrivee: v.dateArrivee || undefined,
    quantiteAnnonceeKg: v.quantiteAnnonceeKg ? Number(v.quantiteAnnonceeKg) : undefined,
    temperatureC: v.temperatureC ? Number(v.temperatureC) : undefined,
    citerneConforme: booleen(v.citerneConforme),
    plombsIntacts: booleen(v.plombsIntacts),
    numeroPlomb: texte(v.numeroPlomb),
    receptionnePar: texte(v.receptionnePar),
    observations: texte(v.observations),
  };
}

/** Prestataire, conditions de livraison et contrôles à l'arrivée (écart de poids, température, citerne, plombs). */
export function ChampsTransport({ valeurs, onChange }: { valeurs: ValeursTransport; onChange: (v: ValeursTransport) => void }) {
  const maj = (champ: keyof ValeursTransport) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    onChange({ ...valeurs, [champ]: e.target.value });
  const choix = (champ: "citerneConforme" | "plombsIntacts", oui: string, non: string) => (
    <select className="input" value={valeurs[champ]} onChange={maj(champ)}>
      <option value="">Non contrôlé</option>
      <option value="oui">{oui}</option>
      <option value="non">{non}</option>
    </select>
  );
  return (
    <div className="grid gap-4 sm:grid-cols-3">
      <Champ label="Transporteur (prestataire)" requis>
        <input className="input" required value={valeurs.transporteur} onChange={maj("transporteur")} />
      </Champ>
      <Champ label="Immatriculation">
        <input className="input" value={valeurs.immatriculation} onChange={maj("immatriculation")} />
      </Champ>
      <Champ label="Chauffeur">
        <input className="input" value={valeurs.chauffeur} onChange={maj("chauffeur")} />
      </Champ>
      <Champ label="N° de bon de livraison">
        <input className="input" value={valeurs.numeroBl} onChange={maj("numeroBl")} />
      </Champ>
      <Champ label="Conditions de livraison" large>
        <input className="input" placeholder="ex. franco cuves OLIVED, transport à la charge de l'huilerie" value={valeurs.conditionsLivraison} onChange={maj("conditionsLivraison")} />
      </Champ>
      <Champ label="Date d'enlèvement">
        <input className="input" type="date" value={valeurs.dateEnlevement} onChange={maj("dateEnlevement")} />
      </Champ>
      <Champ label="Date d'arrivée">
        <input className="input" type="date" value={valeurs.dateArrivee} onChange={maj("dateArrivee")} />
      </Champ>
      <Champ label="Poids annoncé sur le BL (kg)">
        <input className="input" type="number" min={1} value={valeurs.quantiteAnnonceeKg} onChange={maj("quantiteAnnonceeKg")} />
      </Champ>
      <Champ label="Température de l'huile (°C)">
        <input className="input" type="number" step="0.1" value={valeurs.temperatureC} onChange={maj("temperatureC")} />
      </Champ>
      <Champ label="Citerne">{choix("citerneConforme", "Conforme", "Non conforme")}</Champ>
      <Champ label="Plombs">{choix("plombsIntacts", "Intacts", "Absents ou rompus")}</Champ>
      <Champ label="N° de plomb">
        <input className="input" value={valeurs.numeroPlomb} onChange={maj("numeroPlomb")} />
      </Champ>
      <Champ label="Réceptionné par">
        <input className="input" value={valeurs.receptionnePar} onChange={maj("receptionnePar")} />
      </Champ>
      <Champ label="Observations">
        <input className="input" value={valeurs.observations} onChange={maj("observations")} />
      </Champ>
    </div>
  );
}

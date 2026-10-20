"use client";

import { Champ } from "./ui";

export type ValeursAnalyse = Record<(typeof CHAMPS)[number]["name"], string>;

const CHAMPS = [
  { name: "dateAnalyse", label: "Date d'analyse", type: "date" },
  { name: "laboratoire", label: "Laboratoire", type: "text" },
  { name: "reference", label: "N° de bulletin", type: "text" },
  { name: "acidite", label: "Acidité (% ac. oléique)", type: "number", step: "0.01" },
  { name: "peroxyde", label: "Peroxyde (meq O2/kg)", type: "number", step: "0.01" },
  { name: "k232", label: "K232", type: "number", step: "0.001" },
  { name: "k270", label: "K270", type: "number", step: "0.001" },
  { name: "deltaK", label: "ΔK", type: "number", step: "0.001" },
  { name: "polyphenols", label: "Polyphénols (mg/kg)", type: "number", step: "1" },
  { name: "commentaire", label: "Commentaire", type: "text" },
] as const;

export function analyseVide(dateAnalyse: string): ValeursAnalyse {
  return Object.fromEntries(CHAMPS.map((c) => [c.name, c.name === "dateAnalyse" ? dateAnalyse : ""])) as ValeursAnalyse;
}

/** Corps envoyé à l'API : champs vides retirés, nombres convertis. */
export function analyseVersApi(v: ValeursAnalyse): Record<string, unknown> {
  const body: Record<string, unknown> = {};
  for (const c of CHAMPS) {
    const valeur = v[c.name].trim();
    if (valeur !== "") body[c.name] = c.type === "number" ? Number(valeur) : valeur;
  }
  return body;
}

export function ChampsAnalyse({ valeurs, onChange }: { valeurs: ValeursAnalyse; onChange: (v: ValeursAnalyse) => void }) {
  return (
    <div className="grid gap-4 sm:grid-cols-3">
      {CHAMPS.map((c) => (
        <Champ key={c.name} label={c.label} requis={c.name === "dateAnalyse"}>
          <input
            className="input"
            type={c.type}
            step={"step" in c ? c.step : undefined}
            min={c.type === "number" && c.name !== "deltaK" ? 0 : undefined}
            required={c.name === "dateAnalyse"}
            value={valeurs[c.name]}
            onChange={(e) => onChange({ ...valeurs, [c.name]: e.target.value })}
          />
        </Champ>
      ))}
    </div>
  );
}

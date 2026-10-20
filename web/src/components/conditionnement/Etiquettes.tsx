"use client";

import Link from "next/link";
import { useState } from "react";
import { api } from "@/lib/api";
import type { Etiquettes as EtiquettesData, Passeport } from "@/lib/passeport";
import { useApi } from "@/lib/useApi";
import { Champ, Erreur } from "../vrac/ui";
import { ImageQr } from "./Passeport";

/** Impression du QR code du lot (étiquette de carton, document d'export) ou d'une planche d'étiquettes de bouteille. */
export function EtiquettesQr({ lotId }: { lotId: number }) {
  const base = `/conditionnements/${lotId}/passeport`;
  const { data: passeport, erreur } = useApi<Passeport>(base);
  const [mode, setMode] = useState<"lot" | "bouteilles">("lot");
  const [plage, setPlage] = useState({ de: "1", a: "" });
  const [planche, setPlanche] = useState<EtiquettesData | null>(null);
  const [erreurPlanche, setErreurPlanche] = useState<string | null>(null);
  const [chargement, setChargement] = useState(false);

  if (erreur) return <Erreur message={erreur} />;
  if (!passeport) return <p className="text-stone-500">Chargement…</p>;

  const generer = async (e: React.FormEvent) => {
    e.preventDefault();
    setChargement(true);
    setErreurPlanche(null);
    try {
      const params = new URLSearchParams({ de: plage.de || "1", ...(plage.a ? { a: plage.a } : {}) });
      setPlanche(await api<EtiquettesData>(`${base}/etiquettes?${params}`));
    } catch (err) {
      setErreurPlanche((err as Error).message);
    } finally {
      setChargement(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="space-y-3 print:hidden">
        <Link href={`/conditionnement/${lotId}`} className="text-sm text-olive-700 hover:underline">
          ← Lot conditionné {passeport.code}
        </Link>
        <h1 className="text-2xl font-semibold text-stone-900">Étiquettes QR code du lot {passeport.code}</h1>
        {!passeport.publie && (
          <p className="rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
            Le passeport n&apos;est pas publié : le QR code affichera « passeport indisponible ».
          </p>
        )}
        <div className="flex flex-wrap gap-2">
          <button className={mode === "lot" ? "btn-primary" : "btn-secondary"} onClick={() => setMode("lot")}>
            QR code du lot
          </button>
          <button className={mode === "bouteilles" ? "btn-primary" : "btn-secondary"} onClick={() => setMode("bouteilles")}>
            Une étiquette par bouteille
          </button>
        </div>
        {mode === "bouteilles" && (
          <form onSubmit={generer} className="flex flex-wrap items-end gap-3">
            <Champ label="De la bouteille n°">
              <input className="input w-32" type="number" min={1} max={passeport.nombreUnites} value={plage.de} onChange={(e) => setPlage({ ...plage, de: e.target.value })} />
            </Champ>
            <Champ label={`à la bouteille n° (sur ${passeport.nombreUnites.toLocaleString("fr-FR")})`}>
              <input className="input w-32" type="number" min={1} max={passeport.nombreUnites} value={plage.a} onChange={(e) => setPlage({ ...plage, a: e.target.value })} />
            </Champ>
            <button className="btn-secondary" disabled={chargement}>
              {chargement ? "Génération…" : "Générer la planche"}
            </button>
            <p className="w-full text-xs text-stone-500">500 étiquettes au plus par planche ; imprimez les suivantes en changeant les numéros.</p>
          </form>
        )}
        <Erreur message={erreurPlanche} />
        {(mode === "lot" || planche) && (
          <button className="btn-primary" onClick={() => window.print()}>
            Imprimer
          </button>
        )}
      </div>

      {mode === "lot" && (
        <div className="flex w-fit flex-col items-center gap-2 rounded-lg border border-stone-200 bg-white p-6 print:border-0">
          <ImageQr chemin={`${base}/qr.svg`} alt={`QR code du lot ${passeport.code}`} className="h-64 w-64" />
          <p className="text-lg font-semibold">Lot {passeport.code}</p>
          <p className="text-sm text-stone-600">Scannez pour voir l&apos;origine et les analyses</p>
        </div>
      )}

      {mode === "bouteilles" && planche && (
        <div className="grid grid-cols-[repeat(auto-fill,minmax(3.5cm,1fr))] gap-2">
          {planche.etiquettes.map((e) => (
            <div key={e.numero} className="flex break-inside-avoid flex-col items-center rounded border border-stone-200 bg-white p-1 text-center">
              {/* SVG produit par node-qrcode dans l'API : il ne contient que l'adresse du passeport. */}
              <div className="h-[3cm] w-[3cm] [&>svg]:h-full [&>svg]:w-full" dangerouslySetInnerHTML={{ __html: e.svg }} />
              <p className="text-[9px] leading-tight">
                Lot {planche.code} · n° {e.numero}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

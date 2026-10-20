"use client";

import { FIABILITES, type PrevisionHuilerie, classeRisque, pourcent, valeur } from "@/lib/ia";
import { useApi } from "@/lib/useApi";

/** Qualité attendue d'un lot d'après l'historique de son huilerie (et de sa variété) : affichée dès la saisie de la réception. */
export function PrevisionQualite({ huilerieId, varieteId }: { huilerieId: string; varieteId?: string }) {
  const { data, erreur } = useApi<PrevisionHuilerie>(
    huilerieId ? `/ia/prevision?huilerieId=${huilerieId}${varieteId ? `&varieteId=${varieteId}` : ""}` : null,
  );
  if (!huilerieId || erreur || !data || data.huilerie.id !== Number(huilerieId)) return null;
  if (!data.lotsAnalysesTotal) return null;

  const fiabilite = data.parametres.find((p) => p.prevision)?.prevision?.fiabilite ?? "FAIBLE";
  return (
    <div className="rounded-md border border-olive-200 bg-olive-50 px-4 py-3 text-sm">
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-medium text-olive-900">Prévision IA pour ce lot</span>
        <span className={`rounded-full px-2 py-0.5 text-xs ${FIABILITES[fiabilite].classe}`}>{FIABILITES[fiabilite].libelle}</span>
        <span className="text-xs text-stone-500">
          {data.lotsAnalyses
            ? `${data.lotsAnalyses} lot(s) de ${data.huilerie.nom} déjà analysé(s), conformes à ${pourcent(data.tauxConformite)}`
            : `aucun lot de ${data.huilerie.nom} encore analysé : moyenne de toutes les huileries`}
        </span>
      </div>
      <div className="mt-2 flex flex-wrap gap-x-5 gap-y-1 text-stone-700">
        {data.parametres
          .filter((p) => p.prevision)
          .map((p) => (
            <span key={p.parametre} title={`8 fois sur 10 entre ${valeur(p.prevision!.basse)} et ${valeur(p.prevision!.haute)}`}>
              {p.libelle} ≈ <strong>{valeur(p.prevision!.valeur, p.unite)}</strong>
            </span>
          ))}
      </div>
      {data.risqueNonConforme !== null && (
        <div className={`mt-1 ${classeRisque(data.risqueNonConforme)}`}>
          Risque que l&apos;huile ne soit pas extra vierge : {pourcent(data.risqueNonConforme)}
          {data.risqueNonConforme >= 0.3 && ". Faites analyser ce lot avant de le mélanger ou de le vendre."}
        </div>
      )}
    </div>
  );
}

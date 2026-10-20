// Graphiques simples du tableau de bord et des rapports, en HTML et Tailwind (pas de bibliothèque à installer).
// Une seule série par graphique, couleur olive ; la valeur exacte s'affiche au survol et dans le tableau sous le graphique.
import Link from "next/link";

export function Indicateur({
  libelle,
  valeur,
  detail,
  href,
  alerte,
}: {
  libelle: string;
  valeur: string;
  detail?: string;
  href?: string;
  alerte?: boolean;
}) {
  const contenu = (
    <>
      <div className="text-sm text-stone-500">{libelle}</div>
      <div className={`mt-1 text-3xl font-semibold tabular-nums ${alerte ? "text-red-700" : "text-olive-800"}`}>{valeur}</div>
      {detail && <div className="mt-1 text-xs text-stone-500">{detail}</div>}
    </>
  );
  const classe = `block rounded-lg border bg-white p-5 ${alerte ? "border-red-200" : "border-stone-200"}`;
  return href ? (
    <Link href={href} className={`${classe} hover:border-olive-600`}>
      {contenu}
    </Link>
  ) : (
    <div className={classe}>{contenu}</div>
  );
}

/** Barres horizontales : une ligne par élément (huilerie, pays, format…), triées par l'API. */
export function BarresHorizontales({
  lignes,
  format,
  vide = "Aucune donnée sur la période.",
}: {
  lignes: { libelle: string; valeur: number; detail?: string; href?: string }[];
  format: (v: number) => string;
  vide?: string;
}) {
  if (!lignes.length) return <p className="text-sm text-stone-500">{vide}</p>;
  const max = Math.max(...lignes.map((l) => l.valeur), 1);
  return (
    <ul className="space-y-2">
      {lignes.map((l) => (
        <li key={l.libelle} className="group grid grid-cols-[minmax(0,9rem)_1fr_auto] items-center gap-3 text-sm" title={`${l.libelle} : ${format(l.valeur)}${l.detail ? ` (${l.detail})` : ""}`}>
          <span className="truncate text-stone-700">{l.href ? <Link href={l.href} className="hover:underline">{l.libelle}</Link> : l.libelle}</span>
          <span className="h-4 rounded-r bg-stone-100">
            <span
              className="block h-full rounded-r bg-olive-600 group-hover:bg-olive-800"
              style={{ width: `${Math.max((l.valeur / max) * 100, l.valeur > 0 ? 1 : 0)}%` }}
            />
          </span>
          <span className="whitespace-nowrap text-right tabular-nums text-stone-700">
            {format(l.valeur)}
            {l.detail && <span className="ml-1 text-xs text-stone-500">{l.detail}</span>}
          </span>
        </li>
      ))}
    </ul>
  );
}

/** Colonnes par mois : la valeur s'affiche au survol de chaque colonne. */
export function Colonnes({ points, format }: { points: { libelle: string; valeur: number }[]; format: (v: number) => string }) {
  const max = Math.max(...points.map((p) => p.valeur), 0);
  if (max === 0) return <p className="text-sm text-stone-500">Aucune donnée sur la période.</p>;
  return (
    <div>
      <div className="mb-1 text-xs text-stone-500">max. {format(max)}</div>
      <div className="flex h-40 items-end gap-1 border-b border-stone-300">
        {points.map((p) => (
          <div key={p.libelle} className="group relative flex h-full flex-1 items-end" title={`${p.libelle} : ${format(p.valeur)}`}>
            <div
              className="w-full rounded-t bg-olive-600 group-hover:bg-olive-800"
              style={{ height: `${(p.valeur / max) * 100}%`, minHeight: p.valeur > 0 ? 2 : 0 }}
            />
            <div className="pointer-events-none absolute bottom-full left-1/2 z-10 mb-1 hidden -translate-x-1/2 whitespace-nowrap rounded bg-stone-900 px-2 py-1 text-xs text-white group-hover:block">
              {p.libelle} : {format(p.valeur)}
            </div>
          </div>
        ))}
      </div>
      <div className="mt-1 flex gap-1">
        {points.map((p, i) => (
          <div key={p.libelle} className="flex-1 truncate text-center text-[10px] text-stone-500">
            {points.length <= 12 || i % 2 === 0 ? p.libelle : ""}
          </div>
        ))}
      </div>
    </div>
  );
}

/** Jauge de remplissage d'une cuve. */
export function Jauge({ taux }: { taux: number }) {
  return (
    <div className="h-2 overflow-hidden rounded-full bg-stone-100">
      <div className="h-full rounded-full bg-olive-600" style={{ width: `${Math.min(taux, 100)}%` }} />
    </div>
  );
}

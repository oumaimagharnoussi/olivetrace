import { CATEGORIES, type CategorieHuile, STATUTS_NC, STATUTS_QUALITE, type StatutNonConformite, type StatutQualite } from "@/lib/qualite";

const base = "inline-block whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-medium";

const COULEURS_QUALITE: Record<StatutQualite, string> = {
  NON_ANALYSE: "bg-stone-100 text-stone-600",
  CONFORME: "bg-olive-100 text-olive-800",
  INCOMPLET: "bg-amber-50 text-amber-800",
  NON_CONFORME: "bg-red-100 text-red-800",
};

export function BadgeQualite({ statut, bloque }: { statut: StatutQualite; bloque?: boolean }) {
  return (
    <span className="inline-flex flex-wrap gap-1">
      <span className={`${base} ${COULEURS_QUALITE[statut]}`}>{STATUTS_QUALITE[statut]}</span>
      {bloque && <span className={`${base} bg-red-700 text-white`}>Bloqué</span>}
    </span>
  );
}

export function BadgeCategorie({ categorie }: { categorie: CategorieHuile | null }) {
  if (!categorie) return <span className="text-stone-400">—</span>;
  const couleur = categorie === "EXTRA_VIERGE" ? "bg-olive-100 text-olive-800" : categorie === "VIERGE" ? "bg-amber-50 text-amber-800" : "bg-red-100 text-red-800";
  return <span className={`${base} ${couleur}`}>{CATEGORIES[categorie]}</span>;
}

export function BadgeNc({ statut }: { statut: StatutNonConformite }) {
  const couleur = statut === "OUVERTE" ? "bg-red-100 text-red-800" : statut === "EN_TRAITEMENT" ? "bg-amber-50 text-amber-800" : "bg-stone-100 text-stone-600";
  return <span className={`${base} ${couleur}`}>{STATUTS_NC[statut]}</span>;
}

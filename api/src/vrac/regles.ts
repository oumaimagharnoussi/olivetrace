// Règles métier du flux vrac, sans accès à la base : elles sont testées dans regles.spec.ts.

/** Seuil d'acidité de l'huile d'olive extra vierge (règlement UE 2022/2104), en % d'acide oléique. */
export const ACIDITE_MAX_EXTRA_VIERGE = 0.8;

export interface ContenuCuve {
  lotId: number;
  quantiteKg: number;
}

export interface CuveAVerifier {
  id: number;
  code: string;
  capaciteKg: number;
  actif: boolean;
}

/**
 * Applique des mouvements au contenu actuel des cuves et renvoie les erreurs éventuelles.
 * Une cuve ne peut pas descendre sous zéro pour un lot, ne peut contenir qu'un lot et ne peut pas dépasser sa capacité.
 */
export function verifierMouvements(
  cuves: CuveAVerifier[],
  contenuActuel: Map<number, ContenuCuve[]>,
  mouvements: { lotId: number; stockageId: number; quantiteKg: number }[],
  codeLot: (lotId: number) => string,
): string[] {
  const erreurs: string[] = [];
  for (const cuve of cuves) {
    const quantites = new Map<number, number>();
    for (const c of contenuActuel.get(cuve.id) ?? []) quantites.set(c.lotId, c.quantiteKg);
    let entree = false;
    for (const m of mouvements.filter((m) => m.stockageId === cuve.id)) {
      quantites.set(m.lotId, (quantites.get(m.lotId) ?? 0) + m.quantiteKg);
      if (m.quantiteKg > 0) entree = true;
    }

    if (entree && !cuve.actif) erreurs.push(`La cuve ${cuve.code} est désactivée.`);
    for (const [lotId, q] of quantites) {
      if (q < 0) {
        const avant = (contenuActuel.get(cuve.id) ?? []).find((c) => c.lotId === lotId)?.quantiteKg ?? 0;
        erreurs.push(`Stock insuffisant : la cuve ${cuve.code} contient ${formatKg(avant)} du lot ${codeLot(lotId)}.`);
      }
    }
    const lots = [...quantites].filter(([, q]) => q > 0);
    if (lots.length > 1) {
      erreurs.push(
        `La cuve ${cuve.code} contiendrait plusieurs lots (${lots.map(([id]) => codeLot(id)).join(', ')}). ` +
          'Pour mettre des lots ensemble, faites un assemblage.',
      );
    }
    const total = lots.reduce((s, [, q]) => s + q, 0);
    if (total > cuve.capaciteKg) {
      erreurs.push(`Capacité dépassée : la cuve ${cuve.code} contiendrait ${formatKg(total)} pour ${formatKg(cuve.capaciteKg)}.`);
    }
  }
  return erreurs;
}

export interface LotAssemble {
  code: string;
  quantiteKg: number;
  variete: string | null;
  campagne: string | null;
  /** Acidité de la dernière analyse, si le lot a été analysé. */
  acidite: number | null;
}

/**
 * Contrôles d'un assemblage avant de le valider : acidité estimée (moyenne pondérée)
 * et avertissements (variétés ou campagnes différentes, lots sans analyse, déclassement).
 * Les avertissements n'empêchent pas l'assemblage : c'est à l'utilisateur de confirmer.
 */
export function controlerAssemblage(lots: LotAssemble[]) {
  const avertissements: string[] = [];

  const varietes = unique(lots.map((l) => l.variete ?? 'variété inconnue'));
  if (varietes.length > 1) {
    avertissements.push(`Assemblage de plusieurs variétés (${varietes.join(', ')}) : le nouveau lot ne sera plus monovariétal.`);
  }

  const campagnes = unique(lots.map((l) => l.campagne).filter((c): c is string => !!c));
  if (campagnes.length > 1) {
    avertissements.push(`Assemblage de plusieurs campagnes (${campagnes.join(', ')}).`);
  }

  const sansAnalyse = lots.filter((l) => l.acidite === null);
  if (sansAnalyse.length) {
    avertissements.push(
      `Lot${sansAnalyse.length > 1 ? 's' : ''} sans analyse d'acidité (${sansAnalyse.map((l) => l.code).join(', ')}) : ` +
        "la qualité de l'assemblage ne peut pas être estimée.",
    );
  }

  const total = lots.reduce((s, l) => s + l.quantiteKg, 0);
  const aciditeEstimee =
    sansAnalyse.length || total === 0
      ? null
      : Math.round((lots.reduce((s, l) => s + l.acidite! * l.quantiteKg, 0) / total) * 100) / 100;

  const nonExtraVierges = lots.filter((l) => l.acidite !== null && l.acidite > ACIDITE_MAX_EXTRA_VIERGE);
  if (nonExtraVierges.length && nonExtraVierges.length < lots.length) {
    avertissements.push(
      `Mélange d'huile extra vierge avec ${nonExtraVierges.map((l) => `${l.code} (${pourcent(l.acidite!)})`).join(', ')}, ` +
        `au-dessus de ${pourcent(ACIDITE_MAX_EXTRA_VIERGE)} d'acidité.`,
    );
  }
  if (aciditeEstimee !== null && aciditeEstimee > ACIDITE_MAX_EXTRA_VIERGE) {
    avertissements.push(
      `Acidité estimée ${pourcent(aciditeEstimee)} : l'assemblage ne serait pas extra vierge (maximum ${pourcent(ACIDITE_MAX_EXTRA_VIERGE)}).`,
    );
  }

  return { quantiteKg: total, aciditeEstimee, avertissements };
}

/** Nombre de jours entiers entre deux dates. */
export function joursEntre(debut: Date, fin: Date): number {
  return Math.floor((fin.getTime() - debut.getTime()) / 86_400_000);
}

export function formatKg(kg: number): string {
  return `${kg.toLocaleString('fr-FR')} kg`;
}

function pourcent(valeur: number): string {
  return `${valeur.toLocaleString('fr-FR')} %`;
}

function unique<T>(valeurs: T[]): T[] {
  return [...new Set(valeurs)];
}

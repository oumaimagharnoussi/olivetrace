// Calculs des rapports (regroupements, périodes), sans accès à la base : ils sont testés dans regles.spec.ts.

/** Mois au format AAAA-MM (heure UTC, comme les dates enregistrées). */
export function cleMois(date: Date): string {
  return date.toISOString().slice(0, 7);
}

/** Tous les mois de la période, du premier au dernier, même ceux sans activité (pour des graphiques sans trou). */
export function moisDeLaPeriode(du: Date, au: Date): string[] {
  const mois: string[] = [];
  let annee = du.getUTCFullYear();
  let m = du.getUTCMonth();
  const fin = au.getUTCFullYear() * 12 + au.getUTCMonth();
  while (annee * 12 + m <= fin && mois.length < 120) {
    mois.push(`${annee}-${String(m + 1).padStart(2, '0')}`);
    m++;
    if (m === 12) {
      m = 0;
      annee++;
    }
  }
  return mois;
}

/**
 * Période d'un rapport. Sans dates : la campagne oléicole en cours (du 1er octobre au 30 septembre).
 * `au` est inclus jusqu'à la fin de la journée.
 */
export function periode(du?: string, au?: string, maintenant = new Date()): { du: Date; au: Date } {
  const anneeDebut = maintenant.getUTCMonth() >= 9 ? maintenant.getUTCFullYear() : maintenant.getUTCFullYear() - 1;
  const debut = du ? new Date(`${du.slice(0, 10)}T00:00:00.000Z`) : new Date(Date.UTC(anneeDebut, 9, 1));
  const fin = au ? new Date(`${au.slice(0, 10)}T23:59:59.999Z`) : new Date(Date.UTC(anneeDebut + 1, 8, 30, 23, 59, 59, 999));
  return { du: debut, au: fin };
}

/** Additionne des valeurs par clé et renvoie les lignes triées de la plus grande à la plus petite (selon `tri`). */
export function regrouper<T, V extends Record<string, number>>(
  elements: T[],
  cle: (e: T) => string,
  valeurs: (e: T) => V,
  tri: keyof V,
): ({ cle: string } & V)[] {
  const groupes = new Map<string, V>();
  for (const e of elements) {
    const k = cle(e);
    const v = valeurs(e);
    const g = groupes.get(k);
    if (!g) groupes.set(k, { ...v });
    else for (const n of Object.keys(v) as (keyof V)[]) (g[n] as number) += v[n];
  }
  return [...groupes]
    .map(([k, v]) => ({ cle: k, ...v }))
    .sort((a, b) => (b[tri] as number) - (a[tri] as number) || a.cle.localeCompare(b.cle));
}

/** Série mensuelle : une valeur par mois de la période, 0 quand il n'y a rien. */
export function serieMensuelle<T>(elements: T[], date: (e: T) => Date, valeur: (e: T) => number, mois: string[]) {
  const totaux = new Map(mois.map((m) => [m, 0]));
  for (const e of elements) {
    const k = cleMois(date(e));
    if (totaux.has(k)) totaux.set(k, totaux.get(k)! + valeur(e));
  }
  return [...totaux].map(([m, v]) => ({ mois: m, valeur: Math.round(v * 10) / 10 }));
}

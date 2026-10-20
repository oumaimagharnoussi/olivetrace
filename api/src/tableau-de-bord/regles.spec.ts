import { cleMois, moisDeLaPeriode, periode, regrouper, serieMensuelle } from './regles.js';

describe('periode', () => {
  it('prend la campagne en cours par défaut (1er octobre au 30 septembre)', () => {
    const p = periode(undefined, undefined, new Date('2026-10-20T10:00:00Z'));
    expect(p.du.toISOString()).toBe('2026-10-01T00:00:00.000Z');
    expect(p.au.toISOString()).toBe('2027-09-30T23:59:59.999Z');
    expect(periode(undefined, undefined, new Date('2026-03-05T10:00:00Z')).du.toISOString()).toBe('2025-10-01T00:00:00.000Z');
  });

  it('inclut toute la journée de fin', () => {
    const p = periode('2026-01-01', '2026-01-31');
    expect(p.du.toISOString()).toBe('2026-01-01T00:00:00.000Z');
    expect(p.au.toISOString()).toBe('2026-01-31T23:59:59.999Z');
  });
});

describe('mois', () => {
  it('liste les mois de la période, à cheval sur deux années', () => {
    expect(moisDeLaPeriode(new Date('2025-11-15Z'), new Date('2026-02-01Z'))).toEqual(['2025-11', '2025-12', '2026-01', '2026-02']);
    expect(cleMois(new Date('2026-10-20T10:00:00Z'))).toBe('2026-10');
  });

  it('remplit les mois sans activité', () => {
    const serie = serieMensuelle(
      [
        { d: new Date('2025-11-02Z'), kg: 100 },
        { d: new Date('2025-11-20Z'), kg: 50 },
        { d: new Date('2026-01-03Z'), kg: 10 },
        { d: new Date('2027-01-03Z'), kg: 999 }, // hors période
      ],
      (e) => e.d,
      (e) => e.kg,
      ['2025-11', '2025-12', '2026-01'],
    );
    expect(serie).toEqual([
      { mois: '2025-11', valeur: 150 },
      { mois: '2025-12', valeur: 0 },
      { mois: '2026-01', valeur: 10 },
    ]);
  });
});

describe('regrouper', () => {
  it('additionne par clé et trie du plus grand au plus petit', () => {
    const lignes = regrouper(
      [
        { pays: 'FR', u: 100, l: 75 },
        { pays: 'IT', u: 500, l: 250 },
        { pays: 'FR', u: 20, l: 15 },
      ],
      (e) => e.pays,
      (e) => ({ unites: e.u, litres: e.l, expeditions: 1 }),
      'litres',
    );
    expect(lignes).toEqual([
      { cle: 'IT', unites: 500, litres: 250, expeditions: 1 },
      { cle: 'FR', unites: 120, litres: 90, expeditions: 2 },
    ]);
  });
});

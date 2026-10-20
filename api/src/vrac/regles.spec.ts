import { controlerAssemblage, verifierMouvements } from './regles.js';

const cuve = (id: number, capaciteKg = 24000, actif = true) => ({ id, code: `CS-0${id}`, capaciteKg, actif });
const code = (id: number) => `L${id}`;

describe('verifierMouvements', () => {
  it('accepte une réception dans une cuve vide', () => {
    expect(verifierMouvements([cuve(1)], new Map(), [{ lotId: 1, stockageId: 1, quantiteKg: 20000 }], code)).toEqual([]);
  });

  it('refuse de dépasser la capacité', () => {
    const erreurs = verifierMouvements([cuve(1)], new Map(), [{ lotId: 1, stockageId: 1, quantiteKg: 25000 }], code);
    expect(erreurs[0]).toContain('Capacité dépassée');
  });

  it('refuse un deuxième lot dans une cuve occupée', () => {
    const contenu = new Map([[1, [{ lotId: 1, quantiteKg: 5000 }]]]);
    const erreurs = verifierMouvements([cuve(1)], contenu, [{ lotId: 2, stockageId: 1, quantiteKg: 1000 }], code);
    expect(erreurs[0]).toContain('plusieurs lots');
  });

  it('refuse de sortir plus que le stock', () => {
    const contenu = new Map([[1, [{ lotId: 1, quantiteKg: 5000 }]]]);
    const erreurs = verifierMouvements([cuve(1)], contenu, [{ lotId: 1, stockageId: 1, quantiteKg: -6000 }], code);
    expect(erreurs[0]).toContain('Stock insuffisant');
  });

  it("accepte un assemblage dans une cuve qui se vide de son lot d'origine", () => {
    const contenu = new Map([
      [1, [{ lotId: 1, quantiteKg: 10000 }]],
      [2, [{ lotId: 2, quantiteKg: 8000 }]],
    ]);
    const mouvements = [
      { lotId: 1, stockageId: 1, quantiteKg: -10000 },
      { lotId: 2, stockageId: 2, quantiteKg: -8000 },
      { lotId: 3, stockageId: 1, quantiteKg: 18000 },
    ];
    expect(verifierMouvements([cuve(1), cuve(2)], contenu, mouvements, code)).toEqual([]);
  });

  it('refuse une entrée dans une cuve désactivée', () => {
    const erreurs = verifierMouvements([cuve(1, 24000, false)], new Map(), [{ lotId: 1, stockageId: 1, quantiteKg: 100 }], code);
    expect(erreurs[0]).toContain('désactivée');
  });
});

describe('controlerAssemblage', () => {
  const lot = (code: string, quantiteKg: number, acidite: number | null, variete = 'Chemlali', campagne = '2026/2027') => ({
    code,
    quantiteKg,
    acidite,
    variete,
    campagne,
  });

  it("calcule l'acidité moyenne pondérée sans avertissement", () => {
    const r = controlerAssemblage([lot('A', 10000, 0.3), lot('B', 30000, 0.5)]);
    expect(r.aciditeEstimee).toBe(0.45);
    expect(r.quantiteKg).toBe(40000);
    expect(r.avertissements).toEqual([]);
  });

  it('signale les variétés différentes et les lots sans analyse', () => {
    const r = controlerAssemblage([lot('A', 1000, 0.3), lot('B', 1000, null, 'Chétoui')]);
    expect(r.aciditeEstimee).toBeNull();
    expect(r.avertissements.join(' ')).toContain('plusieurs variétés');
    expect(r.avertissements.join(' ')).toContain('sans analyse');
  });

  it('signale le déclassement en dessous de la qualité extra vierge', () => {
    const r = controlerAssemblage([lot('A', 1000, 0.4), lot('B', 3000, 1.2)]);
    expect(r.aciditeEstimee).toBe(1);
    expect(r.avertissements.join(' ')).toContain("Mélange d'huile extra vierge");
    expect(r.avertissements.join(' ')).toContain('ne serait pas extra vierge');
  });
});

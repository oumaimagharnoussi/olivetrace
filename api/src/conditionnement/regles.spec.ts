import { controlerFiltration, dluoParDefaut, kgPourUnites, litres, mouvementProduit } from './regles.js';

describe('kgPourUnites', () => {
  it("convertit des bouteilles en kilos d'huile", () => {
    expect(litres(1200, 750)).toBe(900);
    expect(kgPourUnites(1200, 750)).toBe(824); // 900 L × 0,916
    expect(kgPourUnites(100, 5000, 0.92)).toBe(460);
  });
});

describe('dluoParDefaut', () => {
  it('ajoute des mois sans déborder sur le mois suivant', () => {
    expect(dluoParDefaut(new Date(2026, 9, 20), 18)).toEqual(new Date(2028, 3, 20));
    expect(dluoParDefaut(new Date(2027, 0, 31), 1)).toEqual(new Date(2027, 1, 28));
  });
});

describe('controlerFiltration', () => {
  it('calcule la perte de filtration', () => {
    expect(controlerFiltration(10000, 9900)).toEqual({ erreurs: [], avertissements: [], perteKg: 100, tauxPerte: 1 });
  });

  it("refuse plus d'huile filtrée que d'huile mise en filtration", () => {
    expect(controlerFiltration(1000, 1200).erreurs[0]).toContain('ne peut pas dépasser');
  });

  it('signale une perte élevée', () => {
    expect(controlerFiltration(1000, 900).avertissements[0]).toContain('100 kg (10 %)');
  });
});

describe('mouvementProduit', () => {
  it('retire les unités expédiées ou cassées', () => {
    expect(mouvementProduit('EXPEDITION', 120, 500, 'C1')).toEqual({ delta: -120, erreurs: [] });
    expect(mouvementProduit('CASSE', 3, 500, 'C1').delta).toBe(-3);
  });

  it('accepte un ajustement positif ou négatif', () => {
    expect(mouvementProduit('AJUSTEMENT', 4, 0, 'C1')).toEqual({ delta: 4, erreurs: [] });
    expect(mouvementProduit('AJUSTEMENT', -4, 10, 'C1').delta).toBe(-4);
  });

  it('refuse de sortir plus que le stock', () => {
    expect(mouvementProduit('EXPEDITION', 600, 500, 'C1').erreurs[0]).toContain('il reste 500 unités du lot C1');
  });
});

import {
  joursAvantSeuil,
  margeQualite,
  mediane,
  pente,
  prevoir,
  probabiliteHorsBornes,
  repartitionNormale,
  scoreRecommandation,
  scoreRobuste,
  statistiques,
} from './regles.js';

describe('statistiques', () => {
  it('calcule moyenne, écart-type, médiane et écart absolu médian', () => {
    const s = statistiques([0.2, 0.3, 0.4, 0.5, 2])!;
    expect(s.n).toBe(5);
    expect(s.moyenne).toBeCloseTo(0.68);
    expect(s.mediane).toBe(0.4);
    expect(s.mad).toBeCloseTo(0.1);
    expect(statistiques([])).toBeNull();
    expect(mediane([3, 1, 2, 4])).toBe(2.5);
  });

  it('loi normale', () => {
    expect(repartitionNormale(0)).toBeCloseTo(0.5, 6);
    expect(repartitionNormale(1.96)).toBeCloseTo(0.975, 3);
    expect(repartitionNormale(-1.2816)).toBeCloseTo(0.1, 3);
  });
});

describe('prevoir', () => {
  const global = [0.3, 0.3, 0.4, 0.4, 0.5, 0.5, 0.3, 0.4];

  it("tire une huilerie peu connue vers la moyenne générale", () => {
    const p = prevoir([[1.0], global])!;
    // (1 × 1,0 + 3 × 0,3875) / 4
    expect(p.valeur).toBeCloseTo(0.54, 2);
    expect(p.fiabilite).toBe('FAIBLE');
  });

  it("suit une huilerie bien connue", () => {
    const huilerie = Array(30).fill(0.9);
    const p = prevoir([huilerie, global])!;
    expect(p.valeur).toBeCloseTo(0.85, 2);
    expect(p.haute).toBeGreaterThan(p.valeur); // l'historique général garde une part d'incertitude
    expect(p.fiabilite).toBe('BONNE');
    expect(p.n).toBe(30);
  });

  it("ne laisse pas une analyse aberrante élargir l'intervalle", () => {
    const huilerie = [0.3, 0.32, 0.28, 0.31, 0.29, 0.3, 0.33, 0.27, 2.9];
    const p = prevoir([huilerie, global])!;
    expect(p.haute - p.basse).toBeLessThan(0.3);
  });

  it('va du groupe le plus précis au plus général et ignore les groupes vides', () => {
    expect(prevoir([[0.5], [0.5, 0.5, 0.5], global])!.fiabilite).toBe('MOYENNE'); // la variété est peu connue, l'huilerie un peu plus
    expect(prevoir([[], []])).toBeNull();
  });
});

describe('probabiliteHorsBornes', () => {
  it('donne la probabilité de dépasser un maximum ou de passer sous un minimum', () => {
    expect(probabiliteHorsBornes(0.8, 0.1, null, 0.8)).toBeCloseTo(0.5, 2);
    expect(probabiliteHorsBornes(0.4, 0.1, null, 0.8)).toBeLessThan(0.001);
    expect(probabiliteHorsBornes(2.5, 0.5, 2.5, null)).toBeCloseTo(0.5, 2);
    expect(probabiliteHorsBornes(1, 0, null, 0.8)).toBe(1);
  });
});

describe('anomalies et tendances', () => {
  it('repère une valeur inhabituelle avec un score robuste', () => {
    const s = statistiques([0.3, 0.32, 0.35, 0.3, 0.28, 0.33, 0.31, 0.29, 0.34])!;
    expect(Math.abs(scoreRobuste(0.31, s)!)).toBeLessThan(1);
    expect(scoreRobuste(1.2, s)!).toBeGreaterThan(3.5);
    expect(scoreRobuste(1, statistiques([1, 1, 1])!)).toBeNull();
  });

  it('calcule une pente par jour et le temps avant un seuil', () => {
    expect(pente([{ jours: 0, valeur: 0.3 }, { jours: 30, valeur: 0.36 }, { jours: 60, valeur: 0.42 }])).toBeCloseTo(0.002, 6);
    expect(pente([{ jours: 0, valeur: 1 }])).toBeNull();
    expect(joursAvantSeuil(0.5, 0.002, 0.8)).toBe(150);
    expect(joursAvantSeuil(0.9, 0.002, 0.8)).toBe(0);
    expect(joursAvantSeuil(0.5, 0, 0.8)).toBeNull();
  });
});

describe('recommandations', () => {
  const criteres = [
    { champ: 'acidite', min: null, max: 0.8 },
    { champ: 'polyphenols', min: 250, max: null },
  ];

  it('mesure la marge la plus faible face aux critères', () => {
    expect(margeQualite({ acidite: 0.4, polyphenols: 500 }, criteres)).toBe(0.5);
    expect(margeQualite({ acidite: 0.2, polyphenols: 300 }, criteres)).toBe(0.2);
    expect(margeQualite({ acidite: 1.0 }, criteres)).toBe(-0.25);
    expect(margeQualite({}, criteres)).toBeNull();
  });

  it('combine marge et ancienneté', () => {
    expect(scoreRecommandation(1, 180)).toBe(100);
    expect(scoreRecommandation(0.5, 0)).toBe(30);
    expect(scoreRecommandation(-1, 400)).toBe(40);
  });
});

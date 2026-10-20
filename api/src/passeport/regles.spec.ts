import { lireBouteille, nettoyerCertifications, nouveauJeton, parametreBouteille, plageEtiquettes, urlPasseport } from './regles.js';

const SECRET = 'secret-de-test';

describe('nouveauJeton', () => {
  it('tire un jeton différent à chaque fois, utilisable dans une adresse', () => {
    const a = nouveauJeton();
    expect(a).toMatch(/^[A-Za-z0-9_-]{22}$/);
    expect(nouveauJeton()).not.toBe(a);
  });
});

describe('lireBouteille', () => {
  it('reconnaît le numéro signé d\'une bouteille du lot', () => {
    expect(lireBouteille(SECRET, 'jeton', 1200, parametreBouteille(SECRET, 'jeton', 12))).toEqual({ numero: 12, reconnue: true });
  });

  it('refuse un numéro modifié à la main ou venant d\'un autre lot', () => {
    const b = parametreBouteille(SECRET, 'jeton', 12);
    expect(lireBouteille(SECRET, 'jeton', 1200, b.replace(/^12/, '13'))?.reconnue).toBe(false);
    expect(lireBouteille(SECRET, 'autre', 1200, b)?.reconnue).toBe(false);
    expect(lireBouteille('autre-secret', 'jeton', 1200, b)?.reconnue).toBe(false);
  });

  it('refuse un numéro au-delà des unités du lot ou mal formé', () => {
    expect(lireBouteille(SECRET, 'jeton', 10, parametreBouteille(SECRET, 'jeton', 12))).toEqual({ numero: null, reconnue: false });
    expect(lireBouteille(SECRET, 'jeton', 10, 'abc')?.reconnue).toBe(false);
  });

  it("ne dit rien quand le QR code est celui du lot, sans numéro de bouteille", () => {
    expect(lireBouteille(SECRET, 'jeton', 10)).toBeNull();
  });
});

describe('urlPasseport', () => {
  it("construit l'adresse publique", () => {
    expect(urlPasseport('http://localhost:3000/', 'abc')).toBe('http://localhost:3000/p/abc');
    expect(urlPasseport('https://trace.olived.tn', 'abc', '3-xyz')).toBe('https://trace.olived.tn/p/abc?b=3-xyz');
  });
});

describe('plageEtiquettes', () => {
  it('borne la plage au nombre d\'unités et à 500 étiquettes', () => {
    expect(plageEtiquettes(undefined, undefined, 120)).toEqual({ debut: 1, fin: 120, erreurs: [] });
    expect(plageEtiquettes(1, undefined, 2000).fin).toBe(500);
    expect(plageEtiquettes(100, 5000, 300).fin).toBe(300);
  });

  it('refuse une plage hors du lot', () => {
    expect(plageEtiquettes(0, 10, 100).erreurs).toHaveLength(1);
    expect(plageEtiquettes(50, 10, 100).erreurs[0]).toContain('supérieur ou égal');
  });
});

describe('nettoyerCertifications', () => {
  it('retire les lignes vides et les doublons', () => {
    expect(nettoyerCertifications([' Bio UE ', '', 'Bio UE', 'IGP'])).toEqual(['Bio UE', 'IGP']);
  });
});

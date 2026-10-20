import {
  donneesTransaction,
  empreinteAncrage,
  empreinteEvenement,
  jsonCanonique,
  lireDonneesTransaction,
  preuveMerkle,
  racineMerkle,
  sha256,
  verifierPreuve,
} from './regles.js';

describe('jsonCanonique', () => {
  it("ne dépend pas de l'ordre des clés", () => {
    expect(jsonCanonique({ b: 1, a: { d: [1, { y: 2, x: 1 }], c: null } })).toBe('{"a":{"c":null,"d":[1,{"x":1,"y":2}]},"b":1}');
    expect(jsonCanonique({ a: 1, b: 2 })).toBe(jsonCanonique({ b: 2, a: 1 }));
    expect(jsonCanonique({ id: 12n, d: new Date('2026-10-20T10:00:00Z'), absent: undefined })).toBe('{"d":"2026-10-20T10:00:00.000Z","id":"12"}');
  });
});

describe('empreinteEvenement', () => {
  const e = { id: 1n, userId: 1, action: 'CREATE', entite: 'Lot', entiteId: '5', donnees: { code: 'L2026-0001', quantiteKg: 20000 }, createdAt: new Date('2026-10-20T10:00:00Z') };

  it('change dès que le contenu change', () => {
    expect(empreinteEvenement(e)).toMatch(/^[0-9a-f]{64}$/);
    expect(empreinteEvenement({ ...e, donnees: { quantiteKg: 20000, code: 'L2026-0001' } })).toBe(empreinteEvenement(e));
    expect(empreinteEvenement({ ...e, donnees: { code: 'L2026-0001', quantiteKg: 19000 } })).not.toBe(empreinteEvenement(e));
    expect(empreinteEvenement({ ...e, createdAt: new Date('2026-10-20T10:00:01Z') })).not.toBe(empreinteEvenement(e));
  });
});

describe('arbre de Merkle', () => {
  const feuilles = ['a', 'b', 'c', 'd', 'e'].map(sha256);

  it('donne une preuve vérifiable pour chaque feuille, nombre pair ou impair', () => {
    for (const n of [1, 2, 3, 5]) {
      const f = feuilles.slice(0, n);
      const racine = racineMerkle(f);
      f.forEach((feuille, i) => expect(verifierPreuve(feuille, preuveMerkle(f, i))).toBe(racine));
    }
    expect(racineMerkle([feuilles[0]])).toBe(feuilles[0]);
  });

  it('détecte une feuille modifiée ou retirée', () => {
    const racine = racineMerkle(feuilles);
    expect(racineMerkle([feuilles[0], sha256('x'), ...feuilles.slice(2)])).not.toBe(racine);
    expect(racineMerkle(feuilles.slice(0, 4))).not.toBe(racine);
    expect(verifierPreuve(sha256('x'), preuveMerkle(feuilles, 1))).not.toBe(racine);
  });
});

describe('ancrage', () => {
  it('enchaîne les ancrages et relit les données de transaction', () => {
    const r = sha256('racine');
    expect(empreinteAncrage(null, r, 3)).not.toBe(empreinteAncrage(sha256('autre'), r, 3));
    const e = empreinteAncrage(null, r, 3);
    expect(lireDonneesTransaction(donneesTransaction(e))).toBe(e);
    expect(lireDonneesTransaction('0x1234')).toBeNull();
  });
});

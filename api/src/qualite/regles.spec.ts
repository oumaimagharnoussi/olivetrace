import { type Critere, classer, controlerExpedition, decrireEcart, evaluer, evaluerPourLot } from './regles.js';

const EXTRA: Critere[] = [
  { parametre: 'ACIDITE', min: null, max: 0.8 },
  { parametre: 'PEROXYDE', min: null, max: 20 },
  { parametre: 'K232', min: null, max: 2.5 },
  { parametre: 'K270', min: null, max: 0.22 },
];
const VIERGE: Critere[] = [
  { parametre: 'ACIDITE', min: null, max: 2 },
  { parametre: 'PEROXYDE', min: null, max: 20 },
  { parametre: 'K232', min: null, max: 2.6 },
  { parametre: 'K270', min: null, max: 0.25 },
];
const CRITERES = { EXTRA_VIERGE: EXTRA, VIERGE };
const complet = { acidite: 0.3, peroxyde: 8, k232: 1.9, k270: 0.15 };

describe('evaluer', () => {
  it('accepte une analyse dans les limites (bornes comprises)', () => {
    expect(evaluer({ ...complet, acidite: 0.8 }, EXTRA)).toEqual({ resultat: 'CONFORME', ecarts: [], nonMesures: [] });
  });

  it('liste les paramètres hors limites', () => {
    const r = evaluer({ ...complet, acidite: 1.2, k270: 0.3 }, EXTRA);
    expect(r.resultat).toBe('NON_CONFORME');
    expect(r.ecarts.map((e) => e.parametre)).toEqual(['ACIDITE', 'K270']);
  });

  it('signale les paramètres non mesurés sans les compter comme écarts', () => {
    const r = evaluer({ acidite: 0.4 }, EXTRA);
    expect(r.resultat).toBe('INCOMPLET');
    expect(r.nonMesures).toEqual(['PEROXYDE', 'K232', 'K270']);
  });

  it('contrôle un minimum (ex. polyphénols exigés par un client)', () => {
    const r = evaluer({ polyphenols: 180 }, [{ parametre: 'POLYPHENOLS', min: 250, max: null }]);
    expect(r.resultat).toBe('NON_CONFORME');
    expect(decrireEcart(r.ecarts[0])).toBe('Polyphénols 180 mg/kg (minimum 250 mg/kg)');
  });
});

describe('classer', () => {
  it('classe en extra vierge, vierge ou lampante', () => {
    expect(classer(complet, CRITERES)).toBe('EXTRA_VIERGE');
    expect(classer({ ...complet, acidite: 1.5 }, CRITERES)).toBe('VIERGE');
    expect(classer({ ...complet, acidite: 3.1 }, CRITERES)).toBe('LAMPANTE');
  });
});

describe('evaluerPourLot', () => {
  it('rend non conforme un lot visé extra vierge mais classé vierge', () => {
    const r = evaluerPourLot({ ...complet, acidite: 1.1 }, 'EXTRA_VIERGE', CRITERES);
    expect(r.categorie).toBe('VIERGE');
    expect(r.resultat).toBe('NON_CONFORME');
  });

  it('accepte la même huile pour un lot visé vierge', () => {
    const r = evaluerPourLot({ ...complet, acidite: 1.1 }, 'VIERGE', CRITERES);
    expect(r.resultat).toBe('CONFORME');
  });

  it('ne donne pas de catégorie à une analyse sans valeur', () => {
    const r = evaluerPourLot({}, 'EXTRA_VIERGE', CRITERES);
    expect(r.categorie).toBeNull();
    expect(r.resultat).toBe('INCOMPLET');
  });
});

describe('controlerExpedition', () => {
  const maintenant = new Date('2026-10-20');
  const options = { maintenant, ageMaxAnalyseJours: 90 };
  const lot = {
    code: 'L2026-0001',
    bloque: false,
    statutQualite: 'CONFORME' as const,
    categorieVisee: 'EXTRA_VIERGE' as const,
    derniereAnalyse: { dateAnalyse: new Date('2026-10-01'), valeurs: { ...complet, polyphenols: 300 } },
  };

  it('autorise un lot conforme', () => {
    expect(controlerExpedition(lot, [], options)).toEqual({ autorise: true, blocages: [], avertissements: [] });
  });

  it('bloque un lot avec une non-conformité ouverte', () => {
    const r = controlerExpedition({ ...lot, bloque: true }, [], options);
    expect(r.autorise).toBe(false);
    expect(r.blocages[0]).toContain('bloqué');
  });

  it('bloque une vente hors cahier des charges du client', () => {
    const r = controlerExpedition(lot, [{ nom: 'Client DE', criteres: [{ parametre: 'POLYPHENOLS', min: 400, max: null }] }], options);
    expect(r.autorise).toBe(false);
    expect(r.blocages[0]).toContain('Polyphénols 300 mg/kg');
  });

  it('avertit sans bloquer pour un lot sans analyse ou une analyse ancienne', () => {
    expect(controlerExpedition({ ...lot, statutQualite: 'NON_ANALYSE', derniereAnalyse: null }, [], options)).toMatchObject({
      autorise: true,
      avertissements: [expect.stringContaining('aucune analyse')],
    });
    const ancienne = { ...lot, derniereAnalyse: { ...lot.derniereAnalyse, dateAnalyse: new Date('2026-05-01') } };
    expect(controlerExpedition(ancienne, [], options).avertissements[0]).toContain('172 jours');
  });
});

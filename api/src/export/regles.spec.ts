import { type DossierExport, pageHtml } from './documents.js';
import { CODES_NC, colisage, controlerLignes, controlerTransition, html } from './regles.js';

describe('controlerTransition', () => {
  it('suit le parcours préparée, expédiée, livrée', () => {
    expect(controlerTransition('PREPAREE', 'EXPEDIEE')).toBeNull();
    expect(controlerTransition('EXPEDIEE', 'LIVREE')).toBeNull();
    expect(controlerTransition('PREPAREE', 'ANNULEE')).toBeNull();
  });

  it("refuse d'annuler une expédition partie ou de revenir en arrière", () => {
    expect(controlerTransition('EXPEDIEE', 'ANNULEE')).toMatch(/ne peut plus être annulée/);
    expect(controlerTransition('LIVREE', 'PREPAREE')).toMatch(/ne peut pas passer/);
    expect(controlerTransition('PREPAREE', 'LIVREE')).toMatch(/ne peut pas passer/);
  });
});

describe('controlerLignes', () => {
  const stock = new Map([
    [1, { code: 'C2026-0001', stockUnites: 100 }],
    [2, { code: 'C2026-0002', stockUnites: 0 }],
  ]);

  it('accepte des lignes couvertes par le stock', () => {
    expect(controlerLignes([{ lotConditionneId: 1, quantiteUnites: 100 }], stock)).toEqual([]);
  });

  it('refuse un stock insuffisant, un lot en double, un lot inconnu ou une expédition vide', () => {
    expect(controlerLignes([{ lotConditionneId: 1, quantiteUnites: 101 }], stock)).toEqual(['Stock insuffisant : il reste 100 unités du lot C2026-0001.']);
    expect(
      controlerLignes(
        [
          { lotConditionneId: 1, quantiteUnites: 10 },
          { lotConditionneId: 1, quantiteUnites: 10 },
        ],
        stock,
      ),
    ).toEqual(['Le lot C2026-0001 apparaît deux fois.']);
    expect(controlerLignes([{ lotConditionneId: 9, quantiteUnites: 1 }], stock)).toEqual(['Lot conditionné 9 introuvable.']);
    expect(controlerLignes([], stock)).toEqual(['Ajoutez au moins un lot à expédier.']);
  });
});

describe('colisage', () => {
  it('calcule volume, poids net et cartons (dernier carton incomplet signalé)', () => {
    expect(colisage(1000, 750, 0.916, 12)).toEqual({ litres: 750, poidsNetKg: 687, cartons: 84, cartonIncomplet: true });
    expect(colisage(24, 500, 0.916, 12)).toEqual({ litres: 12, poidsNetKg: 11, cartons: 2, cartonIncomplet: false });
    expect(colisage(10, 5000, 0.916, null).cartons).toBeNull();
  });
});

describe('codes NC', () => {
  it('distingue extra vierge et vierge depuis la nomenclature 2022', () => {
    expect(CODES_NC.EXTRA_VIERGE).toBe('1509 20 00');
    expect(CODES_NC.VIERGE).toBe('1509 30 00');
  });
});

describe('documents', () => {
  const dossier: DossierExport = {
    exportateur: {
      raisonSociale: 'OLIVED',
      adresse: 'Route de Tunis, Sfax',
      pays: 'Tunisie',
      matriculeFiscal: null,
      codeDouane: null,
      numeroExportateurAgree: 'TN/123',
      telephone: null,
      email: null,
      signataire: null,
      fonction: null,
      lieu: 'Sfax',
    },
    expedition: {
      code: 'E2026-0001',
      statut: 'PREPAREE',
      datePrevue: new Date('2026-11-02'),
      dateDepart: null,
      incoterm: 'FOB',
      lieuIncoterm: 'Sfax',
      modeTransport: 'MARITIME',
      transporteur: null,
      navire: null,
      portChargement: 'Sfax',
      portDechargement: 'Marseille',
      numeroConteneur: null,
      numeroPlomb: null,
      numeroConnaissement: null,
      numeroCommande: null,
      numeroFacture: null,
      nombrePalettes: null,
      poidsBrutKg: null,
      adresseLivraison: null,
      paysDestination: 'FR',
      paysDestinationNom: 'France',
      ue: true,
    },
    client: { raisonSociale: 'Épicerie <Fine> & Co', adresse: null, ville: 'Lyon', pays: 'France', numeroTva: 'FR123' },
    lignes: [
      {
        code: 'C2026-0001',
        produit: "Huile d'olive extra vierge",
        categorie: 'extra vierge',
        codeNc: '1509 20 00',
        format: { nom: 'Bouteille verre 75 cl', contenanceMl: 750, materiau: 'verre', unitesParCarton: 12 },
        quantiteUnites: 1200,
        litres: 900,
        poidsNetKg: 824.4,
        cartons: 100,
        dateConditionnement: new Date('2026-10-20'),
        dluo: new Date('2028-04-20'),
        lotVrac: 'L2026-0003',
        origine: { huileries: [{ nom: 'Huilerie Sfax', region: 'Sfax' }], varietes: ['Chemlali'], campagnes: ['2025/2026'], assemblage: false },
        filtrations: [],
        analyse: {
          date: new Date('2026-10-15'),
          laboratoire: 'Labo',
          reference: 'B-42',
          categorie: 'extra vierge',
          resultat: 'Conforme',
          lotAnalyse: 'L2026-0001',
          valeurs: [{ libelle: 'Acidité', unite: '%', valeur: 0.3, min: null, max: 0.8 }],
        },
        conforme: true,
      },
    ],
    totaux: { unites: 1200, litres: 900, poidsNetKg: 824.4, cartons: 100 },
    genereLe: new Date('2026-10-20'),
  };

  it('échappe le texte venant de la base', () => {
    expect(html('<b> & "x"')).toBe('&lt;b&gt; &amp; &quot;x&quot;');
    const page = pageHtml(dossier, ['colisage']);
    expect(page).toContain('Épicerie &lt;Fine&gt; &amp; Co');
    expect(page).not.toContain('<Fine>');
  });

  it("met tous les documents du dossier à la suite, avec la déclaration d'origine et le lot analysé", () => {
    const page = pageHtml(dossier, ['colisage', 'origine', 'analyses', 'conformite', 'fiches']);
    expect(page.match(/<section class="doc">/g)).toHaveLength(5);
    expect(page).toContain("ont l'origine préférentielle <strong>Tunisie</strong>");
    expect(page).toContain('autorisation douanière n° TN/123');
    expect(page).toContain('règlement délégué (UE) 2022/2104');
    expect(page).toContain("lot d'origine du lot L2026-0003, avant filtration");
    expect(page).toContain('1509 20 00');
  });
});

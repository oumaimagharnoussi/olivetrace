// Pages HTML des documents du dossier export, imprimées en PDF par PdfService.
// Elles ne lisent pas la base : elles reçoivent un DossierExport déjà construit (ExpeditionsService.dossier),
// ce qui permet de les tester. Tout texte venant de la base passe par html().
import { DOCUMENTS, type TypeDocument, html } from './regles.js';

export interface Exportateur {
  raisonSociale: string;
  adresse: string | null;
  pays: string;
  matriculeFiscal: string | null;
  codeDouane: string | null;
  numeroExportateurAgree: string | null;
  telephone: string | null;
  email: string | null;
  signataire: string | null;
  fonction: string | null;
  lieu: string | null;
}

export interface ValeurAnalyse {
  libelle: string;
  unite: string;
  valeur: number;
  min: number | null;
  max: number | null;
}

export interface LigneDossier {
  code: string; // numéro de lot final, imprimé sur l'étiquette
  produit: string;
  categorie: string; // libellé : extra vierge, vierge…
  codeNc: string;
  format: { nom: string; contenanceMl: number; materiau: string | null; unitesParCarton: number | null };
  quantiteUnites: number;
  litres: number;
  poidsNetKg: number;
  cartons: number | null;
  dateConditionnement: Date;
  dluo: Date | null;
  lotVrac: string;
  origine: { huileries: { nom: string; region: string | null }[]; varietes: string[]; campagnes: string[]; assemblage: boolean };
  filtrations: { date: Date; typeFiltre: string | null; porositeMicrons: number | null }[];
  analyse: {
    date: Date;
    laboratoire: string | null;
    reference: string | null;
    categorie: string | null;
    resultat: string;
    lotAnalyse: string; // lot vrac analysé (le lot filtré reprend l'analyse de son lot d'entrée)
    valeurs: ValeurAnalyse[];
  } | null;
  conforme: boolean; // lot analysé, conforme et non bloqué au moment de l'édition
}

export interface DossierExport {
  exportateur: Exportateur;
  expedition: {
    code: string;
    statut: string;
    datePrevue: Date;
    dateDepart: Date | null;
    incoterm: string | null;
    lieuIncoterm: string | null;
    modeTransport: string;
    transporteur: string | null;
    navire: string | null;
    portChargement: string | null;
    portDechargement: string | null;
    numeroConteneur: string | null;
    numeroPlomb: string | null;
    numeroConnaissement: string | null;
    numeroCommande: string | null;
    numeroFacture: string | null;
    nombrePalettes: number | null;
    poidsBrutKg: number | null;
    adresseLivraison: string | null;
    paysDestination: string;
    paysDestinationNom: string;
    ue: boolean;
  };
  client: { raisonSociale: string; adresse: string | null; ville: string | null; pays: string; numeroTva: string | null };
  lignes: LigneDossier[];
  totaux: { unites: number; litres: number; poidsNetKg: number; cartons: number | null };
  genereLe: Date;
}

const MODES: Record<string, string> = { MARITIME: 'Maritime', ROUTIER: 'Routier', AERIEN: 'Aérien', FERROVIAIRE: 'Ferroviaire' };

export function d(date: Date | null | undefined) {
  return date ? date.toLocaleDateString('fr-FR', { timeZone: 'Africa/Tunis' }) : '—';
}

export function n(valeur: number, decimales = 0) {
  return valeur.toLocaleString('fr-FR', { minimumFractionDigits: decimales, maximumFractionDigits: decimales });
}

function nombre(valeur: number) {
  return valeur.toLocaleString('fr-FR', { maximumFractionDigits: 3 });
}

/** Texte ou tiret, échappé. */
export function t(valeur: unknown) {
  return valeur === null || valeur === undefined || valeur === '' ? '—' : html(valeur);
}

function limite(v: { min: number | null; max: number | null }) {
  if (v.min !== null && v.max !== null) return `${nombre(v.min)} à ${nombre(v.max)}`;
  if (v.max !== null) return `≤ ${nombre(v.max)}`;
  if (v.min !== null) return `≥ ${nombre(v.min)}`;
  return '—';
}

function respecte(v: ValeurAnalyse) {
  return (v.min === null || v.valeur >= v.min) && (v.max === null || v.valeur <= v.max);
}

export const STYLE = `
  * { box-sizing: border-box; }
  body { font-family: Arial, Helvetica, sans-serif; font-size: 10.5px; color: #1c1917; margin: 0; }
  .doc { page-break-after: always; }
  .doc:last-child { page-break-after: auto; }
  .entete { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 2px solid #556120; padding-bottom: 8px; margin-bottom: 14px; }
  .entete .societe { font-size: 15px; font-weight: bold; color: #434c1d; }
  .entete .petit { color: #57534e; font-size: 9.5px; line-height: 1.4; }
  h1 { font-size: 17px; margin: 0 0 2px; color: #2f3514; text-align: right; }
  .ref { text-align: right; color: #57534e; font-size: 10px; }
  h2 { font-size: 12px; margin: 16px 0 6px; color: #434c1d; text-transform: uppercase; letter-spacing: .03em; }
  .cadres { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
  .cadre { border: 1px solid #d6d3d1; border-radius: 4px; padding: 8px 10px; }
  .cadre .titre { font-size: 9px; text-transform: uppercase; color: #78716c; margin-bottom: 3px; }
  table { width: 100%; border-collapse: collapse; margin-top: 4px; }
  th { background: #f7f8ec; color: #434c1d; text-align: left; font-weight: bold; }
  th, td { border: 1px solid #d6d3d1; padding: 4px 6px; vertical-align: top; }
  td.n, th.n { text-align: right; white-space: nowrap; }
  tr.total td { font-weight: bold; background: #fafaf9; }
  .ok { color: #3f6212; font-weight: bold; }
  .ko { color: #b91c1c; font-weight: bold; }
  .declaration { border: 1px solid #556120; background: #f7f8ec; padding: 10px 12px; border-radius: 4px; line-height: 1.5; margin-top: 10px; }
  ul { margin: 4px 0; padding-left: 18px; line-height: 1.5; }
  .signature { margin-top: 26px; display: grid; grid-template-columns: 1fr 1fr; gap: 20px; }
  .signature .zone { border-top: 1px solid #a8a29e; padding-top: 4px; min-height: 60px; color: #57534e; }
  .note { color: #78716c; font-size: 9px; margin-top: 10px; line-height: 1.4; }
  dl { display: grid; grid-template-columns: 34% 66%; margin: 0; }
  dt, dd { margin: 0; padding: 4px 6px; border-bottom: 1px solid #e7e5e4; }
  dt { color: #57534e; }
`;

function entete(dossier: DossierExport, titre: string, sousTitre?: string) {
  const e = dossier.exportateur;
  return `
    <div class="entete">
      <div>
        <div class="societe">${html(e.raisonSociale)}</div>
        <div class="petit">
          ${e.adresse ? `${html(e.adresse)}<br>` : ''}${html(e.pays)}
          ${e.matriculeFiscal ? `<br>Matricule fiscal : ${html(e.matriculeFiscal)}` : ''}
          ${e.telephone || e.email ? `<br>${[e.telephone, e.email].filter(Boolean).map(html).join(' · ')}` : ''}
        </div>
      </div>
      <div>
        <h1>${html(titre)}</h1>
        ${sousTitre ? `<div class="ref">${html(sousTitre)}</div>` : ''}
        <div class="ref">Expédition ${html(dossier.expedition.code)} · ${d(dossier.expedition.dateDepart ?? dossier.expedition.datePrevue)}</div>
      </div>
    </div>`;
}

function cadresParties(dossier: DossierExport) {
  const { exportateur: e, client: c, expedition: x } = dossier;
  return `
    <div class="cadres">
      <div class="cadre"><div class="titre">Exportateur</div>
        <strong>${html(e.raisonSociale)}</strong><br>${t(e.adresse)}<br>${html(e.pays)}
        ${e.codeDouane ? `<br>Code en douane : ${html(e.codeDouane)}` : ''}
      </div>
      <div class="cadre"><div class="titre">Destinataire</div>
        <strong>${html(c.raisonSociale)}</strong><br>${[c.adresse, c.ville].filter(Boolean).map(html).join(', ') || '—'}<br>${html(x.paysDestinationNom)}
        ${c.numeroTva ? `<br>N° TVA : ${html(c.numeroTva)}` : ''}
        ${x.adresseLivraison ? `<br><span style="color:#57534e">Livraison : ${html(x.adresseLivraison)}</span>` : ''}
      </div>
    </div>`;
}

function transport(dossier: DossierExport) {
  const x = dossier.expedition;
  const lignes: [string, string | null][] = [
    ['Mode de transport', MODES[x.modeTransport] ?? x.modeTransport],
    ['Incoterm', [x.incoterm, x.lieuIncoterm].filter(Boolean).join(' ') || null],
    ['Transporteur', x.transporteur],
    [x.modeTransport === 'AERIEN' ? 'Vol' : 'Navire / voyage', x.navire],
    ['Chargement', x.portChargement],
    ['Déchargement', x.portDechargement],
    ['Conteneur / plomb', [x.numeroConteneur, x.numeroPlomb && `plomb ${x.numeroPlomb}`].filter(Boolean).join(' · ') || null],
    [x.modeTransport === 'ROUTIER' ? 'CMR' : x.modeTransport === 'AERIEN' ? 'LTA' : 'Connaissement (B/L)', x.numeroConnaissement],
    ['Commande client', x.numeroCommande],
    ['Facture', x.numeroFacture],
  ];
  const remplies = lignes.filter(([, v]) => v);
  if (!remplies.length) return '';
  return `<h2>Transport</h2><dl>${remplies.map(([k, v]) => `<dt>${html(k)}</dt><dd>${html(v)}</dd>`).join('')}</dl>`;
}

function tableauMarchandises(dossier: DossierExport, avecPoids = true) {
  return `
    <table>
      <thead><tr>
        <th>N° de lot</th><th>Désignation</th><th>Code NC</th><th>Format</th>
        <th class="n">Unités</th><th class="n">Cartons</th><th class="n">Volume</th>${avecPoids ? '<th class="n">Poids net</th>' : ''}<th>DLUO</th>
      </tr></thead>
      <tbody>
        ${dossier.lignes
          .map(
            (l) => `<tr>
              <td><strong>${html(l.code)}</strong></td>
              <td>${html(l.produit)}</td>
              <td>${html(l.codeNc)}</td>
              <td>${html(l.format.nom)}</td>
              <td class="n">${n(l.quantiteUnites)}</td>
              <td class="n">${l.cartons === null ? '—' : n(l.cartons)}</td>
              <td class="n">${n(l.litres, 2)} L</td>
              ${avecPoids ? `<td class="n">${n(l.poidsNetKg, 1)} kg</td>` : ''}
              <td>${d(l.dluo)}</td>
            </tr>`,
          )
          .join('')}
        <tr class="total">
          <td colspan="4">Total</td>
          <td class="n">${n(dossier.totaux.unites)}</td>
          <td class="n">${dossier.totaux.cartons === null ? '—' : n(dossier.totaux.cartons)}</td>
          <td class="n">${n(dossier.totaux.litres, 2)} L</td>
          ${avecPoids ? `<td class="n">${n(dossier.totaux.poidsNetKg, 1)} kg</td>` : ''}
          <td></td>
        </tr>
      </tbody>
    </table>`;
}

function signature(dossier: DossierExport, gauche = "Cachet de l'exportateur") {
  const e = dossier.exportateur;
  return `
    <div class="signature">
      <div class="zone">${html(gauche)}</div>
      <div class="zone">${e.lieu ? `Fait à ${html(e.lieu)}, le` : 'Le'} ${d(dossier.genereLe)}<br>
        ${e.signataire ? `${html(e.signataire)}${e.fonction ? `, ${html(e.fonction)}` : ''}<br>` : ''}Signature</div>
    </div>`;
}

// --- Documents ---------------------------------------------------------------------------------

function colisage(dossier: DossierExport) {
  const x = dossier.expedition;
  return `
    ${entete(dossier, DOCUMENTS.colisage, 'Packing list')}
    ${cadresParties(dossier)}
    <h2>Marchandises</h2>
    ${tableauMarchandises(dossier)}
    <p>
      Poids net total d'huile : <strong>${n(dossier.totaux.poidsNetKg, 1)} kg</strong>
      ${x.poidsBrutKg ? ` · Poids brut : <strong>${n(x.poidsBrutKg)} kg</strong>` : ''}
      ${x.nombrePalettes ? ` · Palettes : <strong>${n(x.nombrePalettes)}</strong>` : ''}
    </p>
    ${transport(dossier)}
    <p class="note">Poids net calculé à partir du volume (masse volumique de l'huile d'olive). Les numéros de lot sont ceux imprimés sur les étiquettes.</p>
    ${signature(dossier)}`;
}

function origine(dossier: DossierExport) {
  const e = dossier.exportateur;
  const huileries = [...new Map(dossier.lignes.flatMap((l) => l.origine.huileries).map((h) => [h.nom, h])).values()];
  const varietes = [...new Set(dossier.lignes.flatMap((l) => l.origine.varietes))].sort();
  const campagnes = [...new Set(dossier.lignes.flatMap((l) => l.origine.campagnes))].sort();
  const autorisation = e.numeroExportateurAgree ? `autorisation douanière n° ${html(e.numeroExportateurAgree)}` : 'autorisation douanière n° ……………';
  return `
    ${entete(dossier, DOCUMENTS.origine, "Déclaration d'origine de l'exportateur")}
    ${cadresParties(dossier)}
    <h2>Marchandises</h2>
    ${tableauMarchandises(dossier, false)}
    <h2>Origine des huiles</h2>
    <dl>
      <dt>Pays d'origine</dt><dd><strong>${html(e.pays)}</strong> : olives récoltées et triturées en ${html(e.pays)}, huile stockée et conditionnée par ${html(e.raisonSociale)}</dd>
      <dt>Huileries</dt><dd>${huileries.map((h) => `${html(h.nom)}${h.region ? ` (${html(h.region)})` : ''}`).join(', ') || '—'}</dd>
      <dt>Variétés</dt><dd>${varietes.map(html).join(', ') || '—'}</dd>
      <dt>Campagnes</dt><dd>${campagnes.map(html).join(', ') || '—'}</dd>
      <dt>Pays de destination</dt><dd>${html(dossier.expedition.paysDestinationNom)}${dossier.expedition.ue ? ' (Union européenne)' : ''}</dd>
    </dl>
    <div class="declaration">
      L'exportateur des produits couverts par le présent document (${autorisation}) déclare que, sauf indication claire
      du contraire, ces produits ont l'origine préférentielle <strong>${html(e.pays)}</strong>.
    </div>
    <p class="note">
      Texte de la déclaration d'origine de la convention paneuroméditerranéenne (accord d'association UE-Tunisie).
      Sans numéro d'exportateur agréé, elle n'est valable que pour un envoi d'une valeur jusqu'à 6 000 € ; au-delà,
      le certificat de circulation EUR.1 visé par la douane tunisienne reste nécessaire, avec les informations de ce document.
    </p>
    ${signature(dossier)}`;
}

function bulletins(dossier: DossierExport) {
  const blocs = dossier.lignes.map((l) => {
    if (!l.analyse) {
      return `<h2>Lot ${html(l.code)}</h2><p class="ko">Aucune analyse de laboratoire pour ce lot.</p>`;
    }
    const a = l.analyse;
    return `
      <h2>Lot ${html(l.code)} : ${html(l.produit)}</h2>
      <dl>
        <dt>Lot vrac analysé</dt><dd>${html(a.lotAnalyse)}${a.lotAnalyse !== l.lotVrac ? ` (lot d'origine du lot ${html(l.lotVrac)}, avant filtration)` : ''}</dd>
        <dt>Laboratoire</dt><dd>${t(a.laboratoire)}</dd>
        <dt>Bulletin n°</dt><dd>${t(a.reference)}</dd>
        <dt>Date de l'analyse</dt><dd>${d(a.date)}</dd>
        <dt>Catégorie atteinte</dt><dd>${t(a.categorie)}</dd>
        <dt>Résultat</dt><dd class="${l.conforme ? 'ok' : 'ko'}">${html(a.resultat)}</dd>
      </dl>
      <table>
        <thead><tr><th>Paramètre</th><th class="n">Résultat</th><th>Unité</th><th class="n">Limite (${html(l.categorie)})</th><th>Conformité</th></tr></thead>
        <tbody>
          ${a.valeurs
            .map(
              (v) => `<tr>
                <td>${html(v.libelle)}</td>
                <td class="n">${nombre(v.valeur)}</td>
                <td>${html(v.unite)}</td>
                <td class="n">${limite(v)}</td>
                <td>${v.min === null && v.max === null ? '—' : respecte(v) ? '<span class="ok">Conforme</span>' : '<span class="ko">Hors limite</span>'}</td>
              </tr>`,
            )
            .join('')}
        </tbody>
      </table>`;
  });
  return `
    ${entete(dossier, DOCUMENTS.analyses, "Résultats d'analyse par lot")}
    ${blocs.join('')}
    <p class="note">
      Valeurs relevées sur le bulletin du laboratoire et comparées aux limites du règlement délégué (UE) 2022/2104
      enregistrées dans OliveTrace. Le bulletin original du laboratoire fait foi.
    </p>`;
}

function conformite(dossier: DossierExport) {
  const e = dossier.exportateur;
  return `
    ${entete(dossier, DOCUMENTS.conformite, 'Déclaration du producteur')}
    ${cadresParties(dossier)}
    <h2>Produits concernés</h2>
    <table>
      <thead><tr><th>N° de lot</th><th>Désignation</th><th>Code NC</th><th>Format</th><th class="n">Unités</th><th>Analyse</th><th>DLUO</th></tr></thead>
      <tbody>
        ${dossier.lignes
          .map(
            (l) => `<tr>
              <td><strong>${html(l.code)}</strong></td><td>${html(l.produit)}</td><td>${html(l.codeNc)}</td><td>${html(l.format.nom)}</td>
              <td class="n">${n(l.quantiteUnites)}</td>
              <td>${l.analyse ? `${d(l.analyse.date)}${l.analyse.reference ? `, n° ${html(l.analyse.reference)}` : ''}` : '—'}</td>
              <td>${d(l.dluo)}</td>
            </tr>`,
          )
          .join('')}
      </tbody>
    </table>
    <h2>Déclaration</h2>
    <div class="declaration">
      ${html(e.raisonSociale)} déclare sous sa seule responsabilité que les huiles d'olive désignées ci-dessus :
      <ul>
        <li>appartiennent à la catégorie indiquée et respectent les caractéristiques fixées par le
          <strong>règlement délégué (UE) 2022/2104</strong> (normes de commercialisation de l'huile d'olive),
          d'après les analyses réalisées selon les méthodes du <strong>règlement d'exécution (UE) 2022/2105</strong> ;</li>
        <li>sont étiquetées conformément au règlement (UE) n° 1169/2011 et aux règles d'étiquetage du
          règlement délégué (UE) 2022/2104 (dénomination de la catégorie, origine, conditions de conservation) ;</li>
        <li>sont conditionnées dans des emballages destinés au contact des denrées alimentaires conformément au
          règlement (CE) n° 1935/2004 ;</li>
        <li>proviennent de lots tracés de la réception à l'huilerie jusqu'à la mise en bouteille (numéros de lot ci-dessus).</li>
      </ul>
      Aucun de ces lots ne fait l'objet d'une non-conformité ouverte à la date de la présente déclaration.
    </div>
    ${signature(dossier)}`;
}

function fiches(dossier: DossierExport) {
  return dossier.lignes
    .map((l, i) => {
      const huileries = l.origine.huileries.map((h) => `${html(h.nom)}${h.region ? ` (${html(h.region)})` : ''}`).join(', ');
      return `
        <div ${i < dossier.lignes.length - 1 ? 'style="page-break-after: always"' : ''}>
          ${entete(dossier, 'Fiche technique produit', `Lot ${l.code}`)}
          <h2>${html(l.produit)}</h2>
          <dl>
            <dt>Dénomination</dt><dd>Huile d'olive ${html(l.categorie)}</dd>
            <dt>Code NC</dt><dd>${html(l.codeNc)}</dd>
            <dt>Origine</dt><dd>${html(dossier.exportateur.pays)}</dd>
            <dt>Variétés</dt><dd>${l.origine.varietes.map(html).join(', ') || '—'}</dd>
            <dt>Huileries</dt><dd>${huileries || '—'}</dd>
            <dt>Campagne</dt><dd>${l.origine.campagnes.map(html).join(', ') || '—'}</dd>
            <dt>Composition</dt><dd>100 % huile d'olive${l.origine.assemblage ? ', assemblage de plusieurs lots' : ''}. Sans additif.</dd>
            <dt>Procédé</dt><dd>Huile obtenue uniquement par des procédés mécaniques.
              ${l.filtrations.length ? `Filtration${l.filtrations.map((f) => ` le ${d(f.date)}${f.typeFiltre ? ` (${html(f.typeFiltre)}${f.porositeMicrons ? `, ${nombre(f.porositeMicrons)} µm` : ''})` : ''}`).join(',')}.` : 'Non filtrée.'}
            </dd>
          </dl>
          <h2>Conditionnement</h2>
          <dl>
            <dt>Format</dt><dd>${html(l.format.nom)} (${n(l.format.contenanceMl)} ml${l.format.materiau ? `, ${html(l.format.materiau)}` : ''})</dd>
            <dt>Unités par carton</dt><dd>${l.format.unitesParCarton ? n(l.format.unitesParCarton) : '—'}</dd>
            <dt>Mise en bouteille</dt><dd>${d(l.dateConditionnement)}</dd>
            <dt>À consommer de préférence avant</dt><dd>${d(l.dluo)}</dd>
            <dt>Conservation</dt><dd>À l'abri de la lumière et de la chaleur, entre 15 et 25 °C, bouteille bien fermée.</dd>
            <dt>Allergènes</dt><dd>Aucun (règlement (UE) n° 1169/2011, annexe II).</dd>
          </dl>
          <h2>Caractéristiques analytiques</h2>
          ${
            l.analyse
              ? `<table>
                  <thead><tr><th>Paramètre</th><th class="n">Valeur du lot</th><th>Unité</th><th class="n">Limite UE (${html(l.categorie)})</th></tr></thead>
                  <tbody>${l.analyse.valeurs
                    .map((v) => `<tr><td>${html(v.libelle)}</td><td class="n">${nombre(v.valeur)}</td><td>${html(v.unite)}</td><td class="n">${limite(v)}</td></tr>`)
                    .join('')}</tbody>
                </table>
                <p class="note">Analyse du ${d(l.analyse.date)}${l.analyse.laboratoire ? `, ${html(l.analyse.laboratoire)}` : ''}${l.analyse.reference ? `, bulletin n° ${html(l.analyse.reference)}` : ''}.</p>`
              : '<p class="ko">Aucune analyse de laboratoire pour ce lot.</p>'
          }
        </div>`;
    })
    .join('');
}

const PAGES: Record<TypeDocument, (dossier: DossierExport) => string> = { colisage, origine, analyses: bulletins, conformite, fiches };

/** Page HTML d'un ou plusieurs documents (le dossier complet les met bout à bout, un par page). */
export function pageHtml(dossier: DossierExport, documents: TypeDocument[]): string {
  const titre = documents.length === 1 ? `${DOCUMENTS[documents[0]]} ${dossier.expedition.code}` : `Dossier export ${dossier.expedition.code}`;
  return `<!doctype html>
<html lang="fr"><head><meta charset="utf-8"><title>${html(titre)}</title><style>${STYLE}</style></head>
<body>${documents.map((doc) => `<section class="doc">${PAGES[doc](dossier)}</section>`).join('')}</body></html>`;
}

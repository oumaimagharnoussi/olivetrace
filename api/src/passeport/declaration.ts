// Déclaration de conformité UE d'un lot conditionné, téléchargeable depuis la page publique du passeport.
// Contrairement à celle du dossier export, elle ne nomme ni le client ni les quantités : seulement le lot et ses analyses.
import { type Exportateur, STYLE, d, t } from '../export/documents.js';
import { html } from '../export/regles.js';

export interface DeclarationLot {
  societe: Exportateur;
  code: string;
  produit: string;
  categorie: string;
  format: string;
  dateConditionnement: Date;
  dluo: Date | null;
  origine: { pays: string; varietes: string[]; campagnes: string[] };
  analyse: {
    date: Date;
    laboratoire: string | null;
    valeurs: { libelle: string; unite: string; valeur: number; min: number | null; max: number | null }[];
  };
  genereLe: Date;
}

function nombre(valeur: number) {
  return valeur.toLocaleString('fr-FR', { maximumFractionDigits: 3 });
}

function limite(v: { min: number | null; max: number | null }) {
  if (v.min !== null && v.max !== null) return `${nombre(v.min)} à ${nombre(v.max)}`;
  if (v.max !== null) return `≤ ${nombre(v.max)}`;
  if (v.min !== null) return `≥ ${nombre(v.min)}`;
  return '—';
}

export function pageDeclarationLot(x: DeclarationLot): string {
  const s = x.societe;
  return `<!doctype html>
<html lang="fr"><head><meta charset="utf-8"><title>Déclaration de conformité UE ${html(x.code)}</title><style>${STYLE}</style></head>
<body>
  <div class="entete">
    <div>
      <div class="societe">${html(s.raisonSociale)}</div>
      <div class="petit">${s.adresse ? `${html(s.adresse)}<br>` : ''}${html(s.pays)}</div>
    </div>
    <div>
      <h1>Déclaration de conformité UE</h1>
      <div class="ref">Lot ${html(x.code)}</div>
    </div>
  </div>
  <h2>Produit</h2>
  <dl>
    <dt>Désignation</dt><dd>${html(x.produit)}</dd>
    <dt>Catégorie</dt><dd>Huile d'olive ${html(x.categorie)}</dd>
    <dt>Format</dt><dd>${html(x.format)}</dd>
    <dt>Origine</dt><dd>${html(x.origine.pays)}${x.origine.varietes.length ? `, ${x.origine.varietes.map(html).join(', ')}` : ''}</dd>
    <dt>Campagne</dt><dd>${t(x.origine.campagnes.join(', '))}</dd>
    <dt>Conditionnement / DLUO</dt><dd>${d(x.dateConditionnement)} / ${d(x.dluo)}</dd>
  </dl>
  <h2>Analyse de laboratoire</h2>
  <p>Analyse du ${d(x.analyse.date)}${x.analyse.laboratoire ? `, ${html(x.analyse.laboratoire)}` : ''}.</p>
  <table>
    <tr><th>Paramètre</th><th class="n">Résultat</th><th class="n">Limite (catégorie ${html(x.categorie)})</th></tr>
    ${x.analyse.valeurs
      .map((v) => `<tr><td>${html(v.libelle)}</td><td class="n">${nombre(v.valeur)}${v.unite ? ` ${html(v.unite)}` : ''}</td><td class="n">${limite(v)}</td></tr>`)
      .join('')}
  </table>
  <h2>Déclaration</h2>
  <div class="declaration">
    ${html(s.raisonSociale)} déclare sous sa seule responsabilité que l'huile d'olive du lot ${html(x.code)} :
    <ul>
      <li>appartient à la catégorie <strong>${html(x.categorie)}</strong> et respecte les caractéristiques fixées par le
        <strong>règlement délégué (UE) 2022/2104</strong>, d'après des analyses réalisées selon les méthodes du
        <strong>règlement d'exécution (UE) 2022/2105</strong> ;</li>
      <li>est étiquetée conformément au règlement (UE) n° 1169/2011 et aux règles d'étiquetage du règlement délégué (UE) 2022/2104 ;</li>
      <li>est conditionnée dans des emballages destinés au contact des denrées alimentaires (règlement (CE) n° 1935/2004) ;</li>
      <li>provient de lots tracés de la réception en huilerie jusqu'à la mise en bouteille.</li>
    </ul>
    Le lot ne fait l'objet d'aucune non-conformité ouverte à la date de la présente déclaration.
  </div>
  <div class="signature">
    <div class="zone">${s.lieu ? `Fait à ${html(s.lieu)}, le` : 'Le'} ${d(x.genereLe)}<br>
      ${s.signataire ? `${html(s.signataire)}${s.fonction ? `, ${html(s.fonction)}` : ''}<br>` : ''}Pour ${html(s.raisonSociale)}</div>
    <div class="zone"></div>
  </div>
  <p class="note">Document édité par OliveTrace depuis le passeport produit du lot ${html(x.code)}.</p>
</body></html>`;
}

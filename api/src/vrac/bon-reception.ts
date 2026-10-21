// Bon de réception numérique d'un lot reçu d'une huilerie, imprimé en PDF par PdfService.
// Comme les documents du dossier export, la page ne lit pas la base : elle reçoit un BonReception déjà construit.
import { type Exportateur, STYLE, d, n, t } from '../export/documents.js';
import { html } from '../export/regles.js';

export interface BonReception {
  societe: Exportateur;
  numeroBon: string;
  lot: { code: string; dateReception: Date; campagne: string | null; categorieVisee: string; numeroBon: string | null };
  huilerie: { code: string; nom: string; region: string | null; agrement: string | null } | null;
  variete: string | null;
  cuves: { code: string; type: string; quantiteKg: number }[];
  quantiteRecueKg: number;
  transport: {
    transporteur: string;
    immatriculation: string | null;
    chauffeur: string | null;
    numeroBl: string | null;
    conditionsLivraison: string | null;
    dateEnlevement: Date | null;
    dateArrivee: Date | null;
    quantiteAnnonceeKg: number | null;
    temperatureC: number | null;
    citerneConforme: boolean | null;
    plombsIntacts: boolean | null;
    numeroPlomb: string | null;
    receptionnePar: string | null;
    observations: string | null;
  };
  controle: { ecartKg: number | null; tauxEcart: number | null; reserves: string[] };
  analyse: { date: Date; laboratoire: string | null; reference: string | null; valeurs: { libelle: string; valeur: string }[]; resultat: string } | null;
  genereLe: Date;
}

const TYPES: Record<string, string> = { CUVE_SOUTERRAINE: 'Cuve souterraine', CITERNE: 'Citerne', CUVE_TAMPON: 'Cuve tampon' };

function ouiNon(valeur: boolean | null, oui: string, non: string) {
  if (valeur === null) return '—';
  return valeur ? `<span class="ok">${oui}</span>` : `<span class="ko">${non}</span>`;
}

export function pageBonReception(b: BonReception): string {
  const s = b.societe;
  const tr = b.transport;
  const ecart =
    b.controle.ecartKg === null
      ? '—'
      : `${b.controle.ecartKg > 0 ? '+' : ''}${n(b.controle.ecartKg)} kg (${n((b.controle.tauxEcart ?? 0) * 100, 2)} %)`;
  return `<!doctype html>
<html lang="fr"><head><meta charset="utf-8"><title>Bon de réception ${html(b.numeroBon)}</title><style>${STYLE}</style></head>
<body>
  <div class="entete">
    <div>
      <div class="societe">${html(s.raisonSociale)}</div>
      <div class="petit">${s.adresse ? `${html(s.adresse)}<br>` : ''}${html(s.pays)}
        ${s.telephone || s.email ? `<br>${[s.telephone, s.email].filter(Boolean).map(html).join(' · ')}` : ''}</div>
    </div>
    <div>
      <h1>Bon de réception</h1>
      <div class="ref">N° ${html(b.numeroBon)} · lot ${html(b.lot.code)}</div>
      <div class="ref">Reçu le ${d(tr.dateArrivee ?? b.lot.dateReception)}</div>
    </div>
  </div>

  <div class="cadres">
    <div class="cadre"><div class="titre">Fournisseur (huilerie)</div>
      ${b.huilerie ? `<strong>${html(b.huilerie.nom)}</strong> (${html(b.huilerie.code)})${b.huilerie.region ? `<br>${html(b.huilerie.region)}` : ''}${b.huilerie.agrement ? `<br>Agrément sanitaire : ${html(b.huilerie.agrement)}` : ''}` : '—'}
    </div>
    <div class="cadre"><div class="titre">Transporteur (prestataire)</div>
      <strong>${html(tr.transporteur)}</strong>
      ${tr.immatriculation ? `<br>Véhicule : ${html(tr.immatriculation)}` : ''}${tr.chauffeur ? `<br>Chauffeur : ${html(tr.chauffeur)}` : ''}
    </div>
  </div>

  <h2>Marchandise</h2>
  <dl>
    <dt>Produit</dt><dd>Huile d'olive en vrac${b.variete ? `, variété ${html(b.variete)}` : ''}</dd>
    <dt>Catégorie visée</dt><dd>${html(b.lot.categorieVisee)}</dd>
    <dt>Campagne</dt><dd>${t(b.lot.campagne)}</dd>
    <dt>Bon de livraison</dt><dd>${t(tr.numeroBl ?? b.lot.numeroBon)}</dd>
    <dt>Conditions de livraison</dt><dd>${t(tr.conditionsLivraison)}</dd>
    <dt>Enlèvement / arrivée</dt><dd>${d(tr.dateEnlevement)} → ${d(tr.dateArrivee ?? b.lot.dateReception)}</dd>
  </dl>

  <h2>Quantités et affectation en cuves</h2>
  <table>
    <tr><th>Cuve / citerne</th><th>Type</th><th class="n">Quantité reçue</th></tr>
    ${b.cuves.map((c) => `<tr><td>${html(c.code)}</td><td>${html(TYPES[c.type] ?? c.type)}</td><td class="n">${n(c.quantiteKg)} kg</td></tr>`).join('')}
    <tr class="total"><td colspan="2">Total reçu</td><td class="n">${n(b.quantiteRecueKg)} kg</td></tr>
    <tr><td colspan="2">Annoncé sur le bon de livraison</td><td class="n">${tr.quantiteAnnonceeKg !== null ? `${n(tr.quantiteAnnonceeKg)} kg` : '—'}</td></tr>
    <tr><td colspan="2">Écart</td><td class="n">${ecart}</td></tr>
  </table>

  <h2>Contrôles à l'arrivée</h2>
  <dl>
    <dt>Température de l'huile</dt><dd>${tr.temperatureC !== null ? `${n(tr.temperatureC, 1)} °C` : '—'}</dd>
    <dt>Citerne</dt><dd>${ouiNon(tr.citerneConforme, 'Conforme', 'Non conforme')}</dd>
    <dt>Plombs</dt><dd>${ouiNon(tr.plombsIntacts, 'Intacts', 'Absents ou rompus')}${tr.numeroPlomb ? ` · n° ${html(tr.numeroPlomb)}` : ''}</dd>
    ${
      b.analyse
        ? `<dt>Analyse de réception</dt><dd>${d(b.analyse.date)}${b.analyse.laboratoire ? `, ${html(b.analyse.laboratoire)}` : ''}${b.analyse.reference ? `, n° ${html(b.analyse.reference)}` : ''} :
            ${b.analyse.valeurs.map((v) => `${html(v.libelle)} ${html(v.valeur)}`).join(' · ') || '—'} · <strong>${html(b.analyse.resultat)}</strong></dd>`
        : '<dt>Analyse de réception</dt><dd>Non encore analysé</dd>'
    }
  </dl>

  <div class="declaration">
    ${
      b.controle.reserves.length
        ? `<strong class="ko">Réception avec réserves :</strong><ul>${b.controle.reserves.map((r) => `<li>${html(r)}</li>`).join('')}</ul>`
        : '<strong class="ok">Réception sans réserve.</strong>'
    }
    ${tr.observations ? `<div>Observations : ${html(tr.observations)}</div>` : ''}
  </div>

  <div class="signature">
    <div class="zone">Pour ${html(s.raisonSociale)}${tr.receptionnePar ? ` : ${html(tr.receptionnePar)}` : ''}<br>Signature</div>
    <div class="zone">Le transporteur${tr.chauffeur ? ` : ${html(tr.chauffeur)}` : ''}<br>Signature</div>
  </div>
  <p class="note">Bon de réception numérique édité par OliveTrace le ${d(b.genereLe)}. Chaque réception est inscrite dans le journal d'audit (et ancrée sur la blockchain si l'option est active).</p>
</body></html>`;
}

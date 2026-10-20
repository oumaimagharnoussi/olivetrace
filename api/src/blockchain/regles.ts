// Empreintes, arbre de Merkle et contenu des transactions, sans accès à la base ni au réseau :
// testés dans regles.spec.ts. Toute empreinte est un SHA-256 en hexadécimal (64 caractères).
import { createHash } from 'node:crypto';

export function sha256(texte: string | Buffer): string {
  return createHash('sha256').update(texte).digest('hex');
}

/**
 * JSON canonique : clés triées à tous les niveaux, sans espace. MySQL ne garde pas l'ordre des clés d'une colonne JSON :
 * sans ce tri, la même donnée relue pourrait donner une autre empreinte.
 */
export function jsonCanonique(valeur: unknown): string {
  if (valeur === null || valeur === undefined) return 'null';
  if (typeof valeur === 'bigint') return JSON.stringify(valeur.toString());
  if (valeur instanceof Date) return JSON.stringify(valeur.toISOString());
  if (Array.isArray(valeur)) return `[${valeur.map(jsonCanonique).join(',')}]`;
  if (typeof valeur === 'object') {
    const entrees = Object.entries(valeur as Record<string, unknown>)
      .filter(([, v]) => v !== undefined)
      .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
    return `{${entrees.map(([k, v]) => `${JSON.stringify(k)}:${jsonCanonique(v)}`).join(',')}}`;
  }
  return JSON.stringify(valeur);
}

export interface EvenementAudit {
  id: bigint | number | string;
  userId: number | null;
  action: string;
  entite: string;
  entiteId: string;
  donnees: unknown;
  createdAt: Date;
}

/** Empreinte d'un événement du journal d'audit : tout son contenu, identifiant et date compris. */
export function empreinteEvenement(e: EvenementAudit): string {
  return sha256(
    jsonCanonique({
      id: String(e.id),
      userId: e.userId,
      action: e.action,
      entite: e.entite,
      entiteId: e.entiteId,
      donnees: e.donnees ?? null,
      createdAt: e.createdAt,
    }),
  );
}

function paire(gauche: string, droite: string): string {
  return sha256(Buffer.concat([Buffer.from(gauche, 'hex'), Buffer.from(droite, 'hex')]));
}

/** Racine de l'arbre de Merkle (au niveau impair, la dernière empreinte est associée à elle-même). */
export function racineMerkle(feuilles: string[]): string {
  if (!feuilles.length) throw new Error('Aucune empreinte à sceller');
  let niveau = feuilles;
  while (niveau.length > 1) {
    const suivant: string[] = [];
    for (let i = 0; i < niveau.length; i += 2) suivant.push(paire(niveau[i], niveau[i + 1] ?? niveau[i]));
    niveau = suivant;
  }
  return niveau[0];
}

export interface EtapePreuve {
  cote: 'GAUCHE' | 'DROITE';
  empreinte: string;
}

/** Chemin de Merkle d'une feuille : les empreintes voisines à combiner, de la feuille jusqu'à la racine. */
export function preuveMerkle(feuilles: string[], index: number): EtapePreuve[] {
  if (index < 0 || index >= feuilles.length) throw new Error('Événement hors de cet ancrage');
  const preuve: EtapePreuve[] = [];
  let niveau = feuilles;
  let i = index;
  while (niveau.length > 1) {
    const voisin = i % 2 ? i - 1 : i + 1;
    preuve.push({ cote: i % 2 ? 'GAUCHE' : 'DROITE', empreinte: niveau[voisin] ?? niveau[i] });
    const suivant: string[] = [];
    for (let j = 0; j < niveau.length; j += 2) suivant.push(paire(niveau[j], niveau[j + 1] ?? niveau[j]));
    niveau = suivant;
    i = Math.floor(i / 2);
  }
  return preuve;
}

/** Recalcule la racine à partir d'une feuille et de son chemin : égale à la racine ancrée si la preuve est valable. */
export function verifierPreuve(feuille: string, preuve: EtapePreuve[]): string {
  return preuve.reduce((h, e) => (e.cote === 'GAUCHE' ? paire(e.empreinte, h) : paire(h, e.empreinte)), feuille);
}

/** Empreinte d'un ancrage : elle enchaîne les ancrages, et c'est elle qui est inscrite sur la blockchain. */
export function empreinteAncrage(precedente: string | null, racine: string, nombreEvenements: number): string {
  return sha256(`${precedente ?? ''}:${racine}:${nombreEvenements}`);
}

/** Préfixe des données de transaction, pour reconnaître un ancrage OliveTrace dans un explorateur de blocs. */
export const PREFIXE_TRANSACTION = 'OLIVETRACE:';

/** Données (hexadécimal 0x…) de la transaction qui ancre une empreinte. */
export function donneesTransaction(empreinte: string): string {
  return `0x${Buffer.from(PREFIXE_TRANSACTION, 'utf8').toString('hex')}${empreinte}`;
}

/** Empreinte lue dans les données d'une transaction, ou null si ce n'est pas un ancrage OliveTrace. */
export function lireDonneesTransaction(donnees: string): string | null {
  const prefixe = Buffer.from(PREFIXE_TRANSACTION, 'utf8').toString('hex');
  const hex = donnees.toLowerCase().replace(/^0x/, '');
  if (!hex.startsWith(prefixe)) return null;
  const empreinte = hex.slice(prefixe.length);
  return /^[0-9a-f]{64}$/.test(empreinte) ? empreinte : null;
}

/** Réseaux connus : explorateur de blocs pour les liens vers les transactions. */
export const RESEAUX: Record<number, { nom: string; explorateur: string | null }> = {
  137: { nom: 'polygon', explorateur: 'https://polygonscan.com' },
  80002: { nom: 'polygon-amoy', explorateur: 'https://amoy.polygonscan.com' },
  1337: { nom: 'local', explorateur: null },
  31337: { nom: 'local', explorateur: null },
};

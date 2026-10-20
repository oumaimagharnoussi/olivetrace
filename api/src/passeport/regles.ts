// Règles du passeport produit, sans accès à la base : elles sont testées dans regles.spec.ts.
import { createHmac, randomBytes } from 'node:crypto';

/** Nombre maximum d'étiquettes de bouteille générées en une fois. */
export const MAX_ETIQUETTES = 500;

/** Jeton de l'adresse publique : 16 octets aléatoires, impossibles à deviner (22 caractères). */
export function nouveauJeton(): string {
  return randomBytes(16).toString('base64url');
}

/** Signature du numéro d'une bouteille : empêche de fabriquer un numéro qui n'a pas été imprimé par OLIVED. */
export function signatureBouteille(secret: string, jeton: string, numero: number): string {
  return createHmac('sha256', secret).update(`${jeton}:${numero}`).digest('base64url').slice(0, 10);
}

/** Paramètre `b` de l'adresse d'une bouteille : « numéro-signature », ex. 12-Xa81kQz0pL. */
export function parametreBouteille(secret: string, jeton: string, numero: number): string {
  return `${numero}-${signatureBouteille(secret, jeton, numero)}`;
}

/**
 * Lit le paramètre `b` scanné sur une bouteille. Le numéro n'est retenu que si la signature est bonne
 * et qu'il fait partie des unités du lot ; sinon la bouteille est signalée comme non reconnue.
 */
export function lireBouteille(secret: string, jeton: string, nombreUnites: number, parametre?: string) {
  if (!parametre) return null;
  const m = /^(\d{1,7})-([A-Za-z0-9_-]{10})$/.exec(parametre);
  const numero = m ? Number(m[1]) : null;
  const reconnue = !!m && numero! >= 1 && numero! <= nombreUnites && m[2] === signatureBouteille(secret, jeton, numero!);
  return { numero: reconnue ? numero : null, reconnue };
}

/** Adresse publique du passeport, avec le numéro de bouteille signé le cas échéant. */
export function urlPasseport(baseUrl: string, jeton: string, bouteille?: string): string {
  return `${baseUrl.replace(/\/+$/, '')}/p/${jeton}${bouteille ? `?b=${bouteille}` : ''}`;
}

/** Plage d'étiquettes de bouteille demandée, bornée au nombre d'unités du lot et à MAX_ETIQUETTES. */
export function plageEtiquettes(de: number | undefined, a: number | undefined, nombreUnites: number) {
  const erreurs: string[] = [];
  const debut = de ?? 1;
  const fin = Math.min(a ?? nombreUnites, nombreUnites, debut + MAX_ETIQUETTES - 1);
  if (debut < 1 || debut > nombreUnites) erreurs.push(`Le premier numéro doit être entre 1 et ${nombreUnites}.`);
  if (a !== undefined && a < debut) erreurs.push('Le dernier numéro doit être supérieur ou égal au premier.');
  return { debut, fin, erreurs };
}

/** Certifications saisies une par ligne : lignes vides et doublons retirés. */
export function nettoyerCertifications(lignes: string[]): string[] {
  return [...new Set(lignes.map((l) => l.trim()).filter(Boolean))];
}

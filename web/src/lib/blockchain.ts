// Types et libellés de l'ancrage blockchain (voir api/src/blockchain).
import type { Role } from "./roles";

/** Rôles qui voient la page Blockchain (comme le journal d'audit dans l'API). */
export const ROLES_BLOCKCHAIN: Role[] = ["DIRECTION"];

export type StatutAncrage = "SCELLE" | "ENVOYE" | "CONFIRME" | "ERREUR";

export const STATUTS_ANCRAGE: Record<StatutAncrage, { libelle: string; classe: string }> = {
  SCELLE: { libelle: "Scellé dans la base", classe: "bg-stone-100 text-stone-700" },
  ENVOYE: { libelle: "Envoyé, en attente", classe: "bg-amber-100 text-amber-800" },
  CONFIRME: { libelle: "Ancré sur la blockchain", classe: "bg-olive-100 text-olive-800" },
  ERREUR: { libelle: "Erreur d'envoi", classe: "bg-red-100 text-red-700" },
};

export interface Ancrage {
  id: number;
  racineMerkle: string;
  empreinte: string;
  empreintePrecedente: string | null;
  nombreEvenements: number;
  premierAuditId: string;
  dernierAuditId: string;
  statut: StatutAncrage;
  reseau: string | null;
  chainId: number | null;
  txHash: string | null;
  blocNumero: number | null;
  blocDate: string | null;
  erreur: string | null;
  createdAt: string;
  lien: string | null;
}

export interface EtatBlockchain {
  active: boolean;
  intervalleMinutes: number;
  portefeuille: { adresse: string; reseau: string; chainId: number; solde: string } | { erreur: string } | null;
  evenements: { nonScelles: number; scelles: number };
  ancrages: Ancrage[];
}

export interface Verification {
  ok: boolean;
  verifieLe: string;
  evenementsVerifies: number;
  ancrages: { id: number; statut: StatutAncrage; nombreEvenements: number; ok: boolean; surBlockchain: boolean | null; problemes: string[]; lien: string | null }[];
}

export interface Preuve {
  evenement: { id: string; userId: number | null; action: string; entite: string; entiteId: string; donnees: unknown; createdAt: string; hash: string | null };
  empreinte: string;
  intact: boolean;
  chemin: { cote: "GAUCHE" | "DROITE"; empreinte: string }[];
  racineRecalculee: string | null;
  ancrage: Ancrage | null;
}

export interface EvenementAudit {
  id: string;
  action: string;
  entite: string;
  entiteId: string;
  createdAt: string;
  user: { id: number; nom: string } | null;
  ancrage: { id: number; statut: StatutAncrage } | null;
}

/** Empreinte raccourcie pour l'affichage : début et fin. */
export function court(empreinte: string | null | undefined, n = 10): string {
  if (!empreinte) return "–";
  return empreinte.length <= 2 * n ? empreinte : `${empreinte.slice(0, n)}…${empreinte.slice(-6)}`;
}

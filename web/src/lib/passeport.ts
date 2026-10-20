// Types du passeport produit (voir api/src/passeport).
import type { Role } from "./roles";

/** Rôles qui règlent ce que montre le passeport public (mêmes droits que l'API). */
export const ROLES_PASSEPORT: Role[] = ["DIRECTION", "QUALITE", "EXPORT"];

export interface Passeport {
  id: number;
  code: string;
  jeton: string;
  url: string;
  publie: boolean;
  nomProduit: string | null;
  description: string | null;
  certifications: string[];
  afficherHuileries: boolean;
  afficherAnalyses: boolean;
  afficherProcede: boolean;
  afficherDestination: boolean;
  afficherBlockchain: boolean;
  consultations: number;
  derniereConsultation: string | null;
  nombreUnites: number;
}

export interface Etiquettes {
  code: string;
  nombreUnites: number;
  debut: number;
  fin: number;
  etiquettes: { numero: number; url: string; svg: string }[];
}

/** Passeport tel que le voit la personne qui scanne le QR code. */
export interface PasseportPublic {
  code: string;
  producteur: string;
  produit: {
    nom: string;
    description: string | null;
    categorie: string;
    format: { nom: string; contenanceMl: number; materiau: string | null };
  };
  dateConditionnement: string;
  dluo: string | null;
  bouteille: { numero: number | null; reconnue: boolean } | null;
  nombreUnites: number;
  origine: {
    pays: string;
    huileries: { nom: string; region: string | null }[];
    varietes: string[];
    campagnes: string[];
    assemblage: boolean;
  };
  analyse: {
    date: string;
    laboratoire: string | null;
    categorie: string | null;
    valeurs: { parametre: string; libelle: string; unite: string; valeur: number; min: number | null; max: number | null }[];
  } | null;
  procede: {
    filtrations: { date: string; typeFiltre: string | null; porositeMicrons: number | null }[];
    conditionnement: { date: string; format: string; materiau: string | null };
  } | null;
  destination: { pays: string | null; codePays: string | null; marche: string | null } | null;
  certifications: string[];
  /** Étapes de fabrication et preuve de leur ancrage sur la blockchain (sans leur contenu). */
  blockchain: {
    etapes: {
      etape: string;
      date: string;
      intact: boolean;
      scelle: boolean;
      ancre: boolean;
      reseau: string | null;
      bloc: { numero: number | null; date: string | null } | null;
      empreinteAncrage: string | null;
      txHash: string | null;
      lien: string | null;
    }[];
    toutesAncrees: boolean;
    intact: boolean;
  } | null;
}

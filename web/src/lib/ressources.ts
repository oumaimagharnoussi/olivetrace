// Description des écrans de gestion : champs du formulaire, colonnes du tableau, droits d'écriture.
// Les rôles d'écriture reprennent ceux de l'API (voir api/src/referentiels/*/*.controller.ts).
import { ROLE_LABELS, type Role } from "./roles";

export interface Champ {
  name: string;
  label: string;
  type?: "text" | "number" | "email" | "password" | "select" | "textarea" | "checkbox";
  /** Valeur initiale à la création (« true » pour une case cochée). */
  defaut?: string;
  options?: { value: string; label: string }[];
  required?: boolean;
  /** Affiché dans le tableau. */
  colonne?: boolean;
  /** Seulement à la création (ex. mot de passe obligatoire). */
  requiredOnCreateOnly?: boolean;
  placeholder?: string;
}

export interface Ressource {
  titre: string;
  /** Libellé du bouton de création, ex. « Ajouter une huilerie ». */
  ajouter: string;
  endpoint: string;
  rolesEcriture: Role[];
  champs: Champ[];
}

export const TYPE_STOCKAGE: Record<string, string> = {
  CUVE_SOUTERRAINE: "Cuve souterraine",
  CITERNE: "Citerne",
  CUVE_TAMPON: "Cuve tampon (conditionnement)",
};

export const REFERENTIELS: Record<string, Ressource> = {
  huileries: {
    titre: "Huileries",
    ajouter: "Ajouter une huilerie",
    endpoint: "/huileries",
    rolesEcriture: ["DIRECTION", "STOCK"],
    champs: [
      { name: "code", label: "Code", required: true, colonne: true, placeholder: "H-SFAX" },
      { name: "nom", label: "Nom", required: true, colonne: true },
      { name: "region", label: "Région", colonne: true },
      { name: "adresse", label: "Adresse" },
      { name: "telephone", label: "Téléphone" },
      { name: "agrement", label: "N° d'agrément", colonne: true },
    ],
  },
  varietes: {
    titre: "Variétés",
    ajouter: "Ajouter une variété",
    endpoint: "/varietes",
    rolesEcriture: ["DIRECTION", "QUALITE"],
    champs: [
      { name: "code", label: "Code", required: true, colonne: true, placeholder: "CHEM" },
      { name: "nom", label: "Nom", required: true, colonne: true, placeholder: "Chemlali" },
      { name: "description", label: "Description", type: "textarea", colonne: true },
    ],
  },
  stockages: {
    titre: "Cuves et citernes",
    ajouter: "Ajouter une cuve ou citerne",
    endpoint: "/stockages",
    rolesEcriture: ["DIRECTION", "STOCK"],
    champs: [
      { name: "code", label: "Code", required: true, colonne: true, placeholder: "CS-01" },
      {
        name: "type",
        label: "Type",
        type: "select",
        required: true,
        colonne: true,
        options: Object.entries(TYPE_STOCKAGE).map(([value, label]) => ({ value, label })),
      },
      { name: "capaciteKg", label: "Capacité (kg)", type: "number", required: true, colonne: true, placeholder: "24000" },
      { name: "emplacement", label: "Emplacement", colonne: true },
    ],
  },
  clients: {
    titre: "Clients",
    ajouter: "Ajouter un client",
    endpoint: "/clients",
    rolesEcriture: ["DIRECTION", "EXPORT"],
    champs: [
      { name: "code", label: "Code", required: true, colonne: true },
      { name: "raisonSociale", label: "Raison sociale", required: true, colonne: true },
      { name: "pays", label: "Pays (code ISO)", required: true, colonne: true, placeholder: "FR" },
      { name: "ville", label: "Ville", colonne: true },
      { name: "adresse", label: "Adresse" },
      { name: "email", label: "Email", type: "email" },
      { name: "telephone", label: "Téléphone" },
      { name: "numeroTva", label: "N° de TVA" },
    ],
  },
};

// Les formats sont placés après les clients : ils servent à l'atelier de conditionnement.
REFERENTIELS.formats = {
  titre: "Formats de bouteille",
  ajouter: "Ajouter un format",
  endpoint: "/formats",
  rolesEcriture: ["DIRECTION", "PRODUCTION"],
  champs: [
    { name: "code", label: "Code", required: true, colonne: true, placeholder: "VER-750" },
    { name: "nom", label: "Nom", required: true, colonne: true, placeholder: "Bouteille verre 75 cl" },
    { name: "contenanceMl", label: "Contenance (ml)", type: "number", required: true, colonne: true, placeholder: "750" },
    { name: "materiau", label: "Matériau", colonne: true, placeholder: "verre" },
    { name: "unitesParCarton", label: "Unités par carton", type: "number", colonne: true },
  ],
};

export const UTILISATEURS: Ressource = {
  titre: "Utilisateurs",
    ajouter: "Ajouter un utilisateur",
  endpoint: "/users",
  rolesEcriture: [],
  champs: [
    { name: "nom", label: "Nom", required: true, colonne: true },
    { name: "email", label: "Email", type: "email", required: true, colonne: true },
    {
      name: "role",
      label: "Rôle",
      type: "select",
      required: true,
      colonne: true,
      options: Object.entries(ROLE_LABELS).map(([value, label]) => ({ value, label })),
    },
    { name: "password", label: "Mot de passe (8 caractères min.)", type: "password", requiredOnCreateOnly: true },
    // Pour valider une inscription : choisir le rôle et cocher cette case.
    { name: "actif", label: "Compte actif", type: "checkbox", defaut: "true" },
  ],
};

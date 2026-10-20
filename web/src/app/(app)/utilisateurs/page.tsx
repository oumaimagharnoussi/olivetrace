"use client";

import { CrudPage } from "@/components/CrudPage";
import { UTILISATEURS } from "@/lib/ressources";

// Réservé à l'administrateur (l'API refuse les autres rôles).
export default function UtilisateursPage() {
  return <CrudPage ressource={UTILISATEURS} />;
}

export type Role = "ADMIN" | "DIRECTION" | "STOCK" | "QUALITE" | "PRODUCTION" | "EXPORT";

export const ROLE_LABELS: Record<Role, string> = {
  ADMIN: "Administrateur",
  DIRECTION: "Direction",
  STOCK: "Stock",
  QUALITE: "Qualité",
  PRODUCTION: "Production",
  EXPORT: "Export",
};

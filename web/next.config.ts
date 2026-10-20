import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  cacheComponents: true,
  partialPrefetching: true,
  experimental: {
    // Les pages connectées dépendent de la session, lue dans le navigateur : elles ne peuvent pas
    // être affichées instantanément depuis le serveur. On ne valide que les segments qui exportent
    // `instant`, sinon `next dev` affiche une erreur « Could not validate … instant navigation »
    // sur chaque page.
    instantInsights: {
      validationLevel: "manual-warning",
    },
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;

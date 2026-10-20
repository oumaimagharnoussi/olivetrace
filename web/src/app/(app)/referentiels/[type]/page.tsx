import { notFound } from "next/navigation";
import { CrudPage } from "@/components/CrudPage";
import { REFERENTIELS } from "@/lib/ressources";

// Les référentiels sont connus d'avance : chaque page est générée au build.
export function generateStaticParams() {
  return Object.keys(REFERENTIELS).map((type) => ({ type }));
}

export default async function ReferentielPage({ params }: PageProps<"/referentiels/[type]">) {
  const { type } = await params;
  const ressource = REFERENTIELS[type];
  if (!ressource) notFound();
  return <CrudPage key={type} ressource={ressource} />;
}

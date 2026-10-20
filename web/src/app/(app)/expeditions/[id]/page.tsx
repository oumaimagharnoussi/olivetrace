import { Suspense } from "react";
import { FicheExpedition } from "@/components/export/FicheExpedition";

// Les expéditions sont créées au fil de l'eau : l'identifiant est lu à la demande, dans un <Suspense>.
export default function ExpeditionPage({ params }: PageProps<"/expeditions/[id]">) {
  return (
    <Suspense fallback={<p className="text-stone-500">Chargement…</p>}>
      <Contenu params={params} />
    </Suspense>
  );
}

async function Contenu({ params }: { params: PageProps<"/expeditions/[id]">["params"] }) {
  const { id } = await params;
  return <FicheExpedition id={Number(id)} />;
}

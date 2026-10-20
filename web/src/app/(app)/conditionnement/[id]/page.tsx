import { Suspense } from "react";
import { FicheLotConditionne } from "@/components/conditionnement/FicheLotConditionne";

// Les lots conditionnés sont créés au fil de l'eau : l'identifiant est lu à la demande, dans un <Suspense>.
export default function LotConditionnePage({ params }: PageProps<"/conditionnement/[id]">) {
  return (
    <Suspense fallback={<p className="text-stone-500">Chargement…</p>}>
      <Contenu params={params} />
    </Suspense>
  );
}

async function Contenu({ params }: { params: PageProps<"/conditionnement/[id]">["params"] }) {
  const { id } = await params;
  return <FicheLotConditionne id={Number(id)} />;
}

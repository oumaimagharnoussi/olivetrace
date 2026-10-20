import { Suspense } from "react";
import { FicheLot } from "@/components/vrac/FicheLot";

// Les lots sont créés au fil de l'eau : l'identifiant est lu à la demande, dans un <Suspense>.
export default function LotPage({ params }: PageProps<"/lots/[id]">) {
  return (
    <Suspense fallback={<p className="text-stone-500">Chargement…</p>}>
      <Contenu params={params} />
    </Suspense>
  );
}

async function Contenu({ params }: { params: PageProps<"/lots/[id]">["params"] }) {
  const { id } = await params;
  return <FicheLot id={Number(id)} />;
}

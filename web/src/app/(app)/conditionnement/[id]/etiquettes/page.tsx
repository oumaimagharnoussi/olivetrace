import { Suspense } from "react";
import { EtiquettesQr } from "@/components/conditionnement/Etiquettes";

export default function EtiquettesPage({ params }: PageProps<"/conditionnement/[id]/etiquettes">) {
  return (
    <Suspense fallback={<p className="text-stone-500">Chargement…</p>}>
      <Contenu params={params} />
    </Suspense>
  );
}

async function Contenu({ params }: { params: PageProps<"/conditionnement/[id]/etiquettes">["params"] }) {
  const { id } = await params;
  return <EtiquettesQr lotId={Number(id)} />;
}

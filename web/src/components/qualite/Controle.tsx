import type { ControleExpedition } from "@/lib/qualite";

/** Résultat du contrôle qualité d'un lot avant une sortie : blocages en rouge, avertissements en orange. */
export function BlocControle({ controle, refus }: { controle: ControleExpedition | null | undefined; refus: string }) {
  if (!controle) return null;
  if (controle.autorise && controle.avertissements.length === 0) {
    return <p className="text-sm text-olive-800">Contrôle qualité : lot conforme.</p>;
  }
  return (
    <div
      className={`space-y-1 rounded-md border p-4 text-sm ${controle.autorise ? "border-amber-200 bg-amber-50 text-amber-900" : "border-red-200 bg-red-50 text-red-800"}`}
    >
      <div className="font-medium">{controle.autorise ? "Contrôle qualité : à vérifier" : `Contrôle qualité : ${refus}`}</div>
      <ul className="list-disc space-y-1 pl-5">
        {[...controle.blocages, ...controle.avertissements].map((m) => (
          <li key={m}>{m}</li>
        ))}
      </ul>
    </div>
  );
}

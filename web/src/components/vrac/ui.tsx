// Petits éléments d'interface partagés par les écrans du flux vrac.

export function Champ({
  label,
  requis,
  children,
  large,
}: {
  label: string;
  requis?: boolean;
  children: React.ReactNode;
  large?: boolean;
}) {
  return (
    <label className={`block ${large ? "sm:col-span-2" : ""}`}>
      <span className="mb-1 block text-sm text-stone-700">
        {label}
        {requis && <span className="text-red-600"> *</span>}
      </span>
      {children}
    </label>
  );
}

export function Erreur({ message }: { message: string | null }) {
  if (!message) return null;
  return <p className="whitespace-pre-line rounded-md bg-red-50 px-4 py-3 text-sm text-red-700">{message}</p>;
}

export function Succes({ message }: { message: string | null }) {
  if (!message) return null;
  return <p className="rounded-md bg-olive-50 px-4 py-3 text-sm text-olive-800">{message}</p>;
}

export function Carte({ titre, children, actions }: { titre?: string; children: React.ReactNode; actions?: React.ReactNode }) {
  return (
    <section className="rounded-lg border border-stone-200 bg-white">
      {(titre || actions) && (
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-stone-200 px-4 py-3">
          {titre && <h2 className="font-medium text-stone-900">{titre}</h2>}
          {actions}
        </div>
      )}
      <div className="p-4">{children}</div>
    </section>
  );
}

export function Tableau({ entetes, children, vide }: { entetes: string[]; children: React.ReactNode; vide?: boolean }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left text-sm">
        <thead className="bg-stone-50 text-stone-600">
          <tr>
            {entetes.map((e, i) => (
              <th key={i} className="whitespace-nowrap px-3 py-2 font-medium">
                {e}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {vide ? (
            <tr>
              <td colSpan={entetes.length} className="px-3 py-6 text-center text-stone-500">
                Aucun élément pour le moment.
              </td>
            </tr>
          ) : (
            children
          )}
        </tbody>
      </table>
    </div>
  );
}

export const td = "px-3 py-2 text-stone-800 border-t border-stone-100";


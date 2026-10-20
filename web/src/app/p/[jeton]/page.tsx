import type { Metadata } from "next";
import { Suspense } from "react";
import { API_URL } from "@/lib/api";
import type { PasseportPublic } from "@/lib/passeport";

// Page publique du passeport produit, ouverte en scannant le QR code : aucune connexion n'est demandée.
// Elle est construite sur le serveur Next.js, qui interroge l'API : le téléphone n'a besoin que d'atteindre ce site.

export const metadata: Metadata = {
  title: "Passeport produit · OliveTrace",
  description: "Origine, analyses et procédé d'un lot d'huile d'olive OLIVED",
};

export default function PasseportPage({ params, searchParams }: PageProps<"/p/[jeton]">) {
  return (
    <div className="min-h-screen bg-olive-50">
      <Suspense fallback={<p className="p-6 text-center text-stone-500">Chargement…</p>}>
        <Contenu params={params} searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

async function Contenu({ params, searchParams }: Pick<PageProps<"/p/[jeton]">, "params" | "searchParams">) {
  const { jeton } = await params;
  const { b } = await searchParams;
  const requete = typeof b === "string" ? `?b=${encodeURIComponent(b)}` : "";
  let passeport: PasseportPublic | null = null;
  try {
    const res = await fetch(`${API_URL}/public/passeports/${encodeURIComponent(jeton)}${requete}`);
    if (res.ok) passeport = await res.json();
  } catch {
    // API injoignable : même message qu'un passeport introuvable.
  }
  if (!passeport) return <Indisponible />;
  return <Fiche p={passeport} />;
}

function Indisponible() {
  return (
    <main className="mx-auto max-w-xl px-4 py-16 text-center">
      <p className="text-sm font-medium uppercase tracking-wide text-olive-700">OliveTrace</p>
      <h1 className="mt-2 text-2xl font-semibold text-stone-900">Passeport indisponible</h1>
      <p className="mt-3 text-stone-600">Ce QR code ne correspond à aucun passeport produit publié. Vérifiez le numéro de lot imprimé sur l&apos;étiquette.</p>
    </main>
  );
}

const jour = (v: string | null) => (v ? new Date(v).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" }) : "—");
const nombre = (v: number) => v.toLocaleString("fr-FR", { maximumFractionDigits: 3 });

function limite(min: number | null, max: number | null, unite: string) {
  const u = unite ? ` ${unite}` : "";
  if (min !== null && max !== null) return `${nombre(min)} à ${nombre(max)}${u}`;
  if (max !== null) return `≤ ${nombre(max)}${u}`;
  if (min !== null) return `≥ ${nombre(min)}${u}`;
  return "—";
}

function Section({ titre, children }: { titre: string; children: React.ReactNode }) {
  return (
    <section className="rounded-xl border border-olive-100 bg-white p-5 shadow-sm">
      <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-olive-700">{titre}</h2>
      {children}
    </section>
  );
}

function Ligne({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex justify-between gap-4 border-b border-stone-100 py-2 text-sm last:border-0">
      <dt className="text-stone-500">{label}</dt>
      <dd className="text-right text-stone-900">{children}</dd>
    </div>
  );
}

function Fiche({ p }: { p: PasseportPublic }) {
  const { origine, analyse, procede, destination, bouteille } = p;
  return (
    <main className="mx-auto max-w-xl space-y-4 px-4 py-8">
      <header className="space-y-1 text-center">
        <p className="text-sm font-medium uppercase tracking-wide text-olive-700">
          {p.producteur} · Produit de {origine.pays}
        </p>
        <h1 className="text-2xl font-semibold text-stone-900">{p.produit.nom}</h1>
        <p className="text-stone-600">
          Lot <span className="font-mono font-medium">{p.code}</span> · {p.produit.format.nom}
        </p>
        {p.produit.description && <p className="pt-2 text-sm text-stone-600">{p.produit.description}</p>}
      </header>

      {bouteille &&
        (bouteille.reconnue ? (
          <p className="rounded-lg bg-olive-100 px-4 py-3 text-center text-sm text-olive-800">
            Bouteille n° {bouteille.numero?.toLocaleString("fr-FR")} sur {p.nombreUnites.toLocaleString("fr-FR")} : numéro authentifié par {p.producteur}.
          </p>
        ) : (
          <p className="rounded-lg bg-amber-50 px-4 py-3 text-center text-sm text-amber-800">
            Numéro de bouteille non reconnu : ce QR code n&apos;a peut-être pas été imprimé par {p.producteur}. Les informations du lot restent celles
            ci-dessous.
          </p>
        ))}

      <Section titre="Produit">
        <dl>
          <Ligne label="Catégorie">Huile d&apos;olive {p.produit.categorie}</Ligne>
          <Ligne label="Contenant">
            {p.produit.format.nom}
            {p.produit.format.materiau && ` (${p.produit.format.materiau})`}
          </Ligne>
          <Ligne label="Mise en bouteille">{jour(p.dateConditionnement)}</Ligne>
          <Ligne label="À consommer de préférence avant">{jour(p.dluo)}</Ligne>
        </dl>
      </Section>

      <Section titre="Origine">
        <dl>
          <Ligne label="Pays">{origine.pays}</Ligne>
          {origine.huileries.length > 0 && (
            <Ligne label={origine.huileries.length > 1 ? "Huileries" : "Huilerie"}>
              {origine.huileries.map((h) => (
                <span key={h.nom} className="block">
                  {h.nom}
                  {h.region && <span className="text-stone-500"> · {h.region}</span>}
                </span>
              ))}
            </Ligne>
          )}
          {origine.varietes.length > 0 && <Ligne label={origine.varietes.length > 1 ? "Variétés" : "Variété"}>{origine.varietes.join(", ")}</Ligne>}
          {origine.campagnes.length > 0 && <Ligne label="Campagne oléicole">{origine.campagnes.join(", ")}</Ligne>}
          {origine.assemblage && <Ligne label="Composition">Assemblage de plusieurs lots</Ligne>}
        </dl>
      </Section>

      {analyse && (
        <Section titre="Analyses de laboratoire">
          <p className="mb-2 text-sm text-stone-600">
            Analyse du {jour(analyse.date)}
            {analyse.laboratoire && `, ${analyse.laboratoire}`}
            {analyse.categorie && ` : huile classée ${analyse.categorie}`}.
          </p>
          <table className="w-full text-sm">
            <thead className="text-left text-stone-500">
              <tr>
                <th className="py-1 font-normal">Paramètre</th>
                <th className="py-1 text-right font-normal">Résultat</th>
                <th className="py-1 text-right font-normal">Limite UE</th>
              </tr>
            </thead>
            <tbody>
              {analyse.valeurs.map((v) => (
                <tr key={v.parametre} className="border-t border-stone-100">
                  <td className="py-2 text-stone-700">{v.libelle}</td>
                  <td className="py-2 text-right font-medium text-stone-900">
                    {nombre(v.valeur)}
                    {v.unite && ` ${v.unite}`}
                  </td>
                  <td className="py-2 text-right text-stone-500">{limite(v.min, v.max, v.unite)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Section>
      )}

      {procede && (
        <Section titre="Procédé">
          <ol className="space-y-3 text-sm">
            {procede.filtrations.map((f, i) => (
              <li key={i}>
                <p className="font-medium text-stone-900">Filtration · {jour(f.date)}</p>
                <p className="text-stone-600">
                  {[f.typeFiltre, f.porositeMicrons !== null && `${nombre(f.porositeMicrons)} µm`].filter(Boolean).join(", ") || "Filtrée avant mise en bouteille"}
                </p>
              </li>
            ))}
            <li>
              <p className="font-medium text-stone-900">Mise en bouteille · {jour(procede.conditionnement.date)}</p>
              <p className="text-stone-600">
                {procede.conditionnement.format}
                {procede.conditionnement.materiau && `, ${procede.conditionnement.materiau}`}
              </p>
            </li>
          </ol>
        </Section>
      )}

      {p.certifications.length > 0 && (
        <Section titre="Certifications et conformité">
          <ul className="space-y-2 text-sm text-stone-800">
            {p.certifications.map((c) => (
              <li key={c} className="flex gap-2">
                <span className="text-olive-700">✓</span>
                {c}
              </li>
            ))}
          </ul>
        </Section>
      )}

      {destination && (
        <Section titre="Destination">
          <dl>
            {destination.pays && <Ligne label="Pays">{destination.pays}</Ligne>}
            {destination.marche && <Ligne label="Marché">{destination.marche}</Ligne>}
          </dl>
        </Section>
      )}

      <footer className="pt-4 text-center text-xs text-stone-500">Passeport produit OliveTrace · informations publiées par {p.producteur}</footer>
    </main>
  );
}

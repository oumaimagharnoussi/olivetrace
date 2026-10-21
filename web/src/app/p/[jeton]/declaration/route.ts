import { API_URL } from "@/lib/api";

/**
 * Déclaration de conformité UE du lot, en PDF. La page publique passe par le site (et non par l'API directement)
 * pour que le téléphone qui a scanné le QR code n'ait besoin que de l'adresse du site.
 */
export async function GET(_request: Request, { params }: RouteContext<"/p/[jeton]/declaration">) {
  const { jeton } = await params;
  const res = await fetch(`${API_URL}/public/passeports/${encodeURIComponent(jeton)}/declaration-conformite.pdf`).catch(() => null);
  if (!res?.ok) return new Response("Déclaration de conformité indisponible.", { status: 404, headers: { "Content-Type": "text/plain; charset=utf-8" } });
  return new Response(res.body, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": res.headers.get("Content-Disposition") ?? "inline",
    },
  });
}

"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";
import { ROLE_LABELS, useAuth } from "@/lib/auth";
import { REFERENTIELS } from "@/lib/ressources";

// Toutes les pages de ce groupe demandent une connexion.
export default function AppLayout({ children }: { children: React.ReactNode }) {
  const { user, loading, logout } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (!loading && !user) router.replace("/login");
  }, [loading, user, router]);

  if (loading || !user) {
    return <div className="flex min-h-screen items-center justify-center text-stone-500">Chargement…</div>;
  }

  const liens = [
    { href: "/", label: "Accueil" },
    ...Object.entries(REFERENTIELS).map(([type, r]) => ({ href: `/referentiels/${type}`, label: r.titre })),
    ...(user.role === "ADMIN" ? [{ href: "/utilisateurs", label: "Utilisateurs" }] : []),
  ];

  return (
    <div className="flex min-h-screen flex-col md:flex-row">
      <aside className="border-b border-olive-900 bg-olive-900 text-olive-50 md:w-60 md:shrink-0 md:border-b-0">
        <div className="px-5 py-4 text-lg font-semibold">OliveTrace</div>
        <nav className="flex flex-wrap gap-1 px-3 pb-3 md:flex-col">
          {liens.map((l) => {
            const actif = l.href === "/" ? pathname === "/" : pathname.startsWith(l.href);
            return (
              <Link
                key={l.href}
                href={l.href}
                className={`rounded-md px-3 py-2 text-sm ${actif ? "bg-olive-700 text-white" : "text-olive-100 hover:bg-olive-800"}`}
              >
                {l.label}
              </Link>
            );
          })}
        </nav>
      </aside>
      <div className="flex flex-1 flex-col">
        <header className="flex items-center justify-end gap-4 border-b border-stone-200 bg-white px-6 py-3 text-sm">
          <span className="text-stone-700">
            {user.nom} · <span className="text-stone-500">{ROLE_LABELS[user.role]}</span>
          </span>
          <button
            onClick={() => {
              logout();
              router.replace("/login");
            }}
            className="text-olive-700 hover:underline"
          >
            Se déconnecter
          </button>
        </header>
        <main className="flex-1 p-6">{children}</main>
      </div>
    </div>
  );
}

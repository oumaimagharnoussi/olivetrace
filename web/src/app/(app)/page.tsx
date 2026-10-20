"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { REFERENTIELS } from "@/lib/ressources";

export default function AccueilPage() {
  const { user } = useAuth();
  const [compteurs, setCompteurs] = useState<Record<string, number | null>>({});

  useEffect(() => {
    for (const [type, r] of Object.entries(REFERENTIELS)) {
      api<unknown[]>(r.endpoint)
        .then((items) => setCompteurs((c) => ({ ...c, [type]: items.length })))
        .catch(() => setCompteurs((c) => ({ ...c, [type]: null })));
    }
  }, []);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-stone-900">Bonjour {user?.nom}</h1>
        <p className="text-stone-500">Référentiels actifs de la plateforme.</p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Object.entries(REFERENTIELS).map(([type, r]) => (
          <Link
            key={type}
            href={`/referentiels/${type}`}
            className="rounded-lg border border-stone-200 bg-white p-5 hover:border-olive-600"
          >
            <div className="text-sm text-stone-500">{r.titre}</div>
            <div className="mt-1 text-3xl font-semibold text-olive-800">{compteurs[type] ?? "…"}</div>
          </Link>
        ))}
      </div>
    </div>
  );
}

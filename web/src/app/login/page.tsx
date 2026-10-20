"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth";

export default function LoginPage() {
  const { user, login } = useAuth();
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [erreur, setErreur] = useState<string | null>(null);
  const [envoi, setEnvoi] = useState(false);

  useEffect(() => {
    if (user) router.replace("/");
  }, [user, router]);

  async function soumettre(e: React.FormEvent) {
    e.preventDefault();
    setEnvoi(true);
    setErreur(null);
    try {
      await login(email, password);
    } catch (e) {
      setErreur((e as Error).message);
    } finally {
      setEnvoi(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-olive-50 px-4">
      <form onSubmit={soumettre} className="w-full max-w-sm space-y-5 rounded-xl border border-stone-200 bg-white p-8 shadow-sm">
        <div>
          <h1 className="text-2xl font-semibold text-olive-800">OliveTrace</h1>
          <p className="text-sm text-stone-500">Traçabilité de l&apos;huile d&apos;olive OLIVED</p>
        </div>
        <div>
          <label htmlFor="email" className="mb-1 block text-sm text-stone-700">
            Email
          </label>
          <input id="email" type="email" required autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} className="input" />
        </div>
        <div>
          <label htmlFor="password" className="mb-1 block text-sm text-stone-700">
            Mot de passe
          </label>
          <input
            id="password"
            type="password"
            required
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="input"
          />
        </div>
        {erreur && <p className="text-sm text-red-700">{erreur}</p>}
        <button type="submit" disabled={envoi} className="btn-primary w-full">
          {envoi ? "Connexion…" : "Se connecter"}
        </button>
      </form>
    </main>
  );
}

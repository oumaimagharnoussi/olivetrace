"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { AuthCard, Champ } from "@/components/AuthCard";
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
    <AuthCard
      titre="Traçabilité de l'huile d'olive OLIVED"
      onSubmit={soumettre}
      liens={[
        { href: "/register", label: "Créer un compte" },
        { href: "/forgot-password", label: "Mot de passe oublié ?" },
      ]}
    >
      <Champ id="email" label="Email" type="email" required autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} />
      <Champ
        id="password"
        label="Mot de passe"
        type="password"
        required
        autoComplete="current-password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
      />
      {erreur && <p className="text-sm text-red-700">{erreur}</p>}
      <button type="submit" disabled={envoi} className="btn-primary w-full">
        {envoi ? "Connexion…" : "Se connecter"}
      </button>
    </AuthCard>
  );
}

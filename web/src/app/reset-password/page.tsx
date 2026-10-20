"use client";

import { useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { AuthCard, Champ } from "@/components/AuthCard";
import { api } from "@/lib/api";

// Page ouverte depuis le lien reçu par e-mail : /reset-password?token=…
export default function ResetPasswordPage() {
  return (
    <Suspense>
      <Formulaire />
    </Suspense>
  );
}

function Formulaire() {
  const token = useSearchParams().get("token") ?? "";
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [erreur, setErreur] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [envoi, setEnvoi] = useState(false);

  async function soumettre(e: React.FormEvent) {
    e.preventDefault();
    if (password !== confirmation) {
      setErreur("Les deux mots de passe ne sont pas identiques");
      return;
    }
    setEnvoi(true);
    setErreur(null);
    try {
      const res = await api<{ message: string }>("/auth/reset-password", { method: "POST", body: { token, password } });
      setMessage(res.message);
    } catch (e) {
      setErreur((e as Error).message);
    } finally {
      setEnvoi(false);
    }
  }

  if (message || !token) {
    return (
      <AuthCard
        titre="Nouveau mot de passe"
        liens={[message ? { href: "/login", label: "Se connecter" } : { href: "/forgot-password", label: "Faire une nouvelle demande" }]}
      >
        <p className={`rounded-md px-4 py-3 text-sm ${message ? "bg-olive-50 text-olive-800" : "bg-red-50 text-red-700"}`}>
          {message ?? "Ce lien est incomplet. Ouvrez le lien reçu par e-mail ou faites une nouvelle demande."}
        </p>
      </AuthCard>
    );
  }

  return (
    <AuthCard titre="Nouveau mot de passe" onSubmit={soumettre} liens={[{ href: "/forgot-password", label: "Faire une nouvelle demande" }]}>
      <Champ
        id="password"
        label="Nouveau mot de passe (8 caractères min.)"
        type="password"
        required
        minLength={8}
        autoComplete="new-password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
      />
      <Champ
        id="confirmation"
        label="Confirmer le mot de passe"
        type="password"
        required
        minLength={8}
        autoComplete="new-password"
        value={confirmation}
        onChange={(e) => setConfirmation(e.target.value)}
      />
      {erreur && <p className="text-sm text-red-700">{erreur}</p>}
      <button type="submit" disabled={envoi} className="btn-primary w-full">
        {envoi ? "Enregistrement…" : "Changer le mot de passe"}
      </button>
    </AuthCard>
  );
}

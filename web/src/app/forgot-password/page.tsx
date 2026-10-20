"use client";

import { useState } from "react";
import { AuthCard, Champ } from "@/components/AuthCard";
import { api } from "@/lib/api";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [erreur, setErreur] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [envoi, setEnvoi] = useState(false);

  async function soumettre(e: React.FormEvent) {
    e.preventDefault();
    setEnvoi(true);
    setErreur(null);
    try {
      const res = await api<{ message: string }>("/auth/forgot-password", { method: "POST", body: { email } });
      setMessage(res.message);
    } catch (e) {
      setErreur((e as Error).message);
    } finally {
      setEnvoi(false);
    }
  }

  return (
    <AuthCard titre="Mot de passe oublié" onSubmit={message ? undefined : soumettre} liens={[{ href: "/login", label: "Retour à la connexion" }]}>
      {message ? (
        <p className="rounded-md bg-olive-50 px-4 py-3 text-sm text-olive-800">{message}</p>
      ) : (
        <>
          <p className="text-sm text-stone-600">Indiquez votre email : vous recevrez un lien pour choisir un nouveau mot de passe.</p>
          <Champ id="email" label="Email" type="email" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} />
          {erreur && <p className="text-sm text-red-700">{erreur}</p>}
          <button type="submit" disabled={envoi} className="btn-primary w-full">
            {envoi ? "Envoi…" : "Recevoir le lien"}
          </button>
        </>
      )}
    </AuthCard>
  );
}

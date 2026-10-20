"use client";

import { useState } from "react";
import { AuthCard, Champ } from "@/components/AuthCard";
import { api } from "@/lib/api";

// Le compte créé reste en attente : un administrateur lui attribue un rôle et l'active.
export default function RegisterPage() {
  const [nom, setNom] = useState("");
  const [email, setEmail] = useState("");
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
      const res = await api<{ message: string }>("/auth/register", { method: "POST", body: { nom, email, password } });
      setMessage(res.message);
    } catch (e) {
      setErreur((e as Error).message);
    } finally {
      setEnvoi(false);
    }
  }

  if (message) {
    return (
      <AuthCard titre="Créer un compte" liens={[{ href: "/login", label: "Retour à la connexion" }]}>
        <p className="rounded-md bg-olive-50 px-4 py-3 text-sm text-olive-800">{message}</p>
      </AuthCard>
    );
  }

  return (
    <AuthCard titre="Créer un compte" onSubmit={soumettre} liens={[{ href: "/login", label: "J'ai déjà un compte" }]}>
      <Champ id="nom" label="Nom complet" required autoComplete="name" value={nom} onChange={(e) => setNom(e.target.value)} />
      <Champ id="email" label="Email" type="email" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} />
      <Champ
        id="password"
        label="Mot de passe (8 caractères min.)"
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
        {envoi ? "Envoi…" : "Créer mon compte"}
      </button>
    </AuthCard>
  );
}

import Link from "next/link";
import { PasswordInput } from "./PasswordInput";

/** Cadre commun des pages publiques (connexion, inscription, mot de passe). */
export function AuthCard({
  titre,
  children,
  onSubmit,
  liens,
}: {
  titre: string;
  children: React.ReactNode;
  onSubmit?: (e: React.FormEvent) => void;
  liens?: { href: string; label: string }[];
}) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-olive-50 px-4">
      <div className="w-full max-w-sm space-y-4">
        <form onSubmit={onSubmit} className="space-y-5 rounded-xl border border-stone-200 bg-white p-8 shadow-sm">
          <div>
            <h1 className="text-2xl font-semibold text-olive-800">OliveTrace</h1>
            <p className="text-sm text-stone-500">{titre}</p>
          </div>
          {children}
        </form>
        {liens && (
          <div className="flex justify-between text-sm">
            {liens.map((l) => (
              <Link key={l.href} href={l.href} className="text-olive-700 hover:underline">
                {l.label}
              </Link>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}

export function Champ({
  id,
  label,
  ...props
}: { id: string; label: string } & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <div>
      <label htmlFor={id} className="mb-1 block text-sm text-stone-700">
        {label}
      </label>
      {props.type === "password" ? <PasswordInput id={id} {...props} /> : <input id={id} className="input" {...props} />}
    </div>
  );
}

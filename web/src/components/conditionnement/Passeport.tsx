"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { api, apiBlob, telecharger } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { type Passeport, ROLES_PASSEPORT } from "@/lib/passeport";
import { useApi } from "@/lib/useApi";
import { date } from "@/lib/vrac";
import { Carte, Champ, Erreur, Succes } from "../vrac/ui";

/** Image d'un QR code de l'API (la route demande la connexion : l'image est chargée avec le jeton). */
export function ImageQr({ chemin, className, alt }: { chemin: string; className?: string; alt: string }) {
  const [src, setSrc] = useState<string | null>(null);
  useEffect(() => {
    let url: string | null = null;
    let annule = false;
    apiBlob(chemin)
      .then((blob) => {
        if (annule) return;
        url = URL.createObjectURL(blob);
        setSrc(url);
      })
      .catch(() => setSrc(null));
    return () => {
      annule = true;
      if (url) URL.revokeObjectURL(url);
    };
  }, [chemin]);
  if (!src) return <div className={`${className} animate-pulse bg-stone-100`} />;
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={src} alt={alt} className={className} />;
}

/** Carte « Passeport produit » de la fiche d'un lot conditionné : QR code, adresse publique, réglages. */
export function CartePasseport({ lotId }: { lotId: number }) {
  const { can } = useAuth();
  const base = `/conditionnements/${lotId}/passeport`;
  const { data: passeport, erreur, recharger } = useApi<Passeport>(base);
  const [reglages, setReglages] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [erreurAction, setErreurAction] = useState<string | null>(null);

  if (erreur) return <Erreur message={erreur} />;
  if (!passeport) return null;

  const renouveler = async () => {
    if (!confirm("Les QR codes déjà imprimés pour ce lot ne fonctionneront plus. Continuer ?")) return;
    try {
      await api(`${base}/renouveler`, { method: "POST" });
      setMessage("Nouveau QR code créé : réimprimez les étiquettes.");
      recharger();
    } catch (e) {
      setErreurAction((e as Error).message);
    }
  };

  return (
    <Carte
      titre="Passeport produit (QR code)"
      actions={
        can(ROLES_PASSEPORT) &&
        !reglages && (
          <button className="btn-secondary" onClick={() => setReglages(true)}>
            Choisir ce qui est affiché
          </button>
        )
      }
    >
      <div className="space-y-4">
        <Succes message={message} />
        <Erreur message={erreurAction} />
        <div className="flex flex-col gap-6 sm:flex-row">
          {/* La clé change avec le jeton : l'image est rechargée après un renouvellement. */}
          <ImageQr key={passeport.jeton} chemin={`${base}/qr.svg`} alt={`QR code du lot ${passeport.code}`} className="h-44 w-44 shrink-0 rounded border border-stone-200" />
          <div className="space-y-3 text-sm">
            <p>
              {passeport.publie ? (
                <span className="rounded bg-olive-100 px-2 py-0.5 text-olive-800">Publié</span>
              ) : (
                <span className="rounded bg-stone-200 px-2 py-0.5 text-stone-700">Non publié : la page publique est indisponible</span>
              )}
            </p>
            <p className="text-stone-600">
              Page publique, sans connexion :{" "}
              <a href={passeport.url} target="_blank" rel="noreferrer" className="break-all text-olive-700 hover:underline">
                {passeport.url}
              </a>
            </p>
            <p className="text-stone-600">
              Consultée {passeport.consultations.toLocaleString("fr-FR")} fois
              {passeport.derniereConsultation && `, la dernière le ${date(passeport.derniereConsultation)}`}.
            </p>
            <div className="flex flex-wrap gap-2">
              <button className="btn-secondary" onClick={() => telecharger(`${base}/qr.png`, `qr-${passeport.code}.png`).catch((e) => setErreurAction(e.message))}>
                Télécharger (PNG)
              </button>
              <button className="btn-secondary" onClick={() => telecharger(`${base}/qr.svg`, `qr-${passeport.code}.svg`).catch((e) => setErreurAction(e.message))}>
                Télécharger (SVG)
              </button>
              <Link href={`/conditionnement/${lotId}/etiquettes`} className="btn-secondary">
                Imprimer les étiquettes
              </Link>
              {can(ROLES_PASSEPORT) && (
                <button className="btn-secondary" onClick={renouveler}>
                  Renouveler le QR code
                </button>
              )}
            </div>
            <p className="text-xs text-stone-500">
              Le QR code du lot mène au passeport ; les étiquettes de bouteille ajoutent un numéro de bouteille signé (1 à{" "}
              {passeport.nombreUnites.toLocaleString("fr-FR")}), vérifié à chaque scan.
            </p>
          </div>
        </div>

        {reglages && (
          <FormulaireReglages
            passeport={passeport}
            chemin={base}
            onAnnuler={() => setReglages(false)}
            onFin={() => {
              setReglages(false);
              setMessage("Passeport mis à jour.");
              recharger();
            }}
          />
        )}
      </div>
    </Carte>
  );
}

const RUBRIQUES = [
  ["afficherHuileries", "Huileries d'origine"],
  ["afficherAnalyses", "Résultats d'analyse"],
  ["afficherProcede", "Filtration et mise en bouteille"],
  ["afficherDestination", "Pays et marché de destination"],
  ["afficherBlockchain", "Preuves d'ancrage blockchain des étapes"],
] as const;

function FormulaireReglages({ passeport, chemin, onAnnuler, onFin }: { passeport: Passeport; chemin: string; onAnnuler: () => void; onFin: () => void }) {
  const [valeurs, setValeurs] = useState({
    publie: passeport.publie,
    nomProduit: passeport.nomProduit ?? "",
    description: passeport.description ?? "",
    certifications: passeport.certifications.join("\n"),
    afficherHuileries: passeport.afficherHuileries,
    afficherAnalyses: passeport.afficherAnalyses,
    afficherProcede: passeport.afficherProcede,
    afficherDestination: passeport.afficherDestination,
    afficherBlockchain: passeport.afficherBlockchain,
  });
  const [erreur, setErreur] = useState<string | null>(null);
  const [envoi, setEnvoi] = useState(false);

  const enregistrer = async (e: React.FormEvent) => {
    e.preventDefault();
    setEnvoi(true);
    setErreur(null);
    try {
      await api(chemin, { method: "PATCH", body: { ...valeurs, certifications: valeurs.certifications.split("\n") } });
      onFin();
    } catch (err) {
      setErreur((err as Error).message);
    } finally {
      setEnvoi(false);
    }
  };

  return (
    <form onSubmit={enregistrer} className="space-y-4 border-t border-stone-200 pt-4">
      <p className="text-sm text-stone-600">
        Le client, les quantités, les opérateurs et les notes internes ne sont jamais publiés. La conformité au règlement UE est ajoutée
        d&apos;office tant que le lot est conforme et non bloqué.
      </p>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" checked={valeurs.publie} onChange={(e) => setValeurs({ ...valeurs, publie: e.target.checked })} />
        Passeport publié (décoché : le QR code affiche « passeport indisponible »)
      </label>
      <div className="grid gap-4 sm:grid-cols-2">
        <Champ label="Nom du produit (laissé vide : Huile d'olive extra vierge)">
          <input className="input" maxLength={160} value={valeurs.nomProduit} onChange={(e) => setValeurs({ ...valeurs, nomProduit: e.target.value })} />
        </Champ>
        <Champ label="Certifications (une par ligne)">
          <textarea
            className="input"
            rows={3}
            placeholder={"Agriculture biologique UE\nIGP …"}
            value={valeurs.certifications}
            onChange={(e) => setValeurs({ ...valeurs, certifications: e.target.value })}
          />
        </Champ>
        <Champ label="Description" large>
          <textarea className="input" rows={3} maxLength={2000} value={valeurs.description} onChange={(e) => setValeurs({ ...valeurs, description: e.target.value })} />
        </Champ>
      </div>
      <fieldset className="space-y-2 text-sm">
        <legend className="mb-1 text-stone-700">Rubriques affichées</legend>
        {RUBRIQUES.map(([cle, libelle]) => (
          <label key={cle} className="flex items-center gap-2">
            <input type="checkbox" checked={valeurs[cle]} onChange={(e) => setValeurs({ ...valeurs, [cle]: e.target.checked })} />
            {libelle}
          </label>
        ))}
      </fieldset>
      <Erreur message={erreur} />
      <div className="flex gap-2">
        <button className="btn-primary" disabled={envoi}>
          Enregistrer
        </button>
        <button type="button" className="btn-secondary" onClick={onAnnuler}>
          Annuler
        </button>
      </div>
    </form>
  );
}

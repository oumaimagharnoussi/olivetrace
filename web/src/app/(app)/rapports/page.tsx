"use client";

import { useState } from "react";
import { BarresHorizontales, Colonnes, Indicateur } from "@/components/tableau-de-bord/graphiques";
import { Carte, Champ, Erreur } from "@/components/vrac/ui";
import { useAuth } from "@/lib/auth";
import { nomPays } from "@/lib/export";
import { type PointMensuel, ROLES_RAPPORTS, type Rapports, entier, libelleMois, litresTexte, telechargerCsv } from "@/lib/tableau-de-bord";
import { useApi } from "@/lib/useApi";
import { date, kg } from "@/lib/vrac";

const jour = (d: Date) => d.toISOString().slice(0, 10);

/** Campagne oléicole : du 1er octobre au 30 septembre. `decalage` -1 donne la campagne précédente. */
function campagne(decalage = 0) {
  const maintenant = new Date();
  const debut = (maintenant.getMonth() >= 9 ? maintenant.getFullYear() : maintenant.getFullYear() - 1) + decalage;
  return { du: `${debut}-10-01`, au: `${debut + 1}-09-30`, libelle: `${debut}/${debut + 1}` };
}

function moisEnCours() {
  const m = new Date();
  return { du: jour(new Date(Date.UTC(m.getFullYear(), m.getMonth(), 1))), au: jour(new Date(Date.UTC(m.getFullYear(), m.getMonth() + 1, 0))) };
}

export default function RapportsPage() {
  const { can } = useAuth();
  const [periode, setPeriode] = useState(() => campagne());
  const autorise = can(ROLES_RAPPORTS);
  const { data, erreur } = useApi<Rapports>(autorise && periode.du && periode.au ? `/rapports?du=${periode.du}&au=${periode.au}` : null);

  if (!autorise) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-semibold text-stone-900">Rapports</h1>
        <p className="text-stone-500">Les rapports sont réservés à la direction et aux administrateurs.</p>
      </div>
    );
  }

  const suffixe = `${periode.du}_${periode.au}`;
  const mensuel = (points: PointMensuel[]) => points.map((p) => ({ libelle: libelleMois(p.mois), valeur: p.valeur }));
  const csvMensuel = (nom: string, unite: string, points: PointMensuel[]) =>
    telechargerCsv(`${nom}_${suffixe}.csv`, ["Mois", unite], points.map((p) => [p.mois, p.valeur]));
  const boutonCsv = (action: () => void) => (
    <button onClick={action} className="text-sm text-olive-700 hover:underline print:hidden">
      CSV
    </button>
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-stone-900">Rapports</h1>
          <p className="text-stone-500">{data ? `Du ${date(data.du)} au ${date(data.au)}.` : "Réceptions, volumes et exports sur une période."}</p>
        </div>
        <button onClick={() => window.print()} className="btn-secondary print:hidden">
          Imprimer
        </button>
      </div>

      <div className="flex flex-wrap items-end gap-3 print:hidden">
        <Champ label="Du">
          <input type="date" className="input" value={periode.du} onChange={(e) => setPeriode((p) => ({ ...p, du: e.target.value }))} />
        </Champ>
        <Champ label="Au">
          <input type="date" className="input" value={periode.au} onChange={(e) => setPeriode((p) => ({ ...p, au: e.target.value }))} />
        </Champ>
        <button onClick={() => setPeriode(campagne())} className="btn-secondary">
          Campagne {campagne().libelle}
        </button>
        <button onClick={() => setPeriode(campagne(-1))} className="btn-secondary">
          Campagne {campagne(-1).libelle}
        </button>
        <button onClick={() => setPeriode({ ...moisEnCours(), libelle: "" })} className="btn-secondary">
          Mois en cours
        </button>
      </div>

      <Erreur message={erreur} />
      {!data ? (
        !erreur && <p className="text-stone-500">Chargement…</p>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
            <Indicateur libelle="Huile reçue" valeur={kg(data.volumes.recuKg)} detail={`${data.volumes.lotsRecus} lot(s) reçu(s)`} />
            <Indicateur libelle="Vendu en vrac" valeur={kg(data.volumes.venduVracKg)} />
            <Indicateur libelle="Mis en bouteille" valeur={kg(data.volumes.conditionneKg)} detail={`${entier(data.volumes.conditionneUnites)} unités, ${kg(data.volumes.filtreKg)} filtrés`} />
            <Indicateur libelle="Exporté" valeur={litresTexte(data.volumes.exporteLitres)} detail={`${entier(data.volumes.exporteUnites)} unités, ${data.volumes.expeditions} expédition(s)`} />
            <Indicateur libelle="Pertes" valeur={kg(data.volumes.pertesKg)} detail="sorties en perte et pertes de filtration" />
          </div>

          <div className="grid items-start gap-6 xl:grid-cols-2">
            <Carte
              titre="Réceptions par huilerie"
              actions={boutonCsv(() =>
                telechargerCsv(`receptions-huileries_${suffixe}.csv`, ["Huilerie", "Lots", "Quantité (kg)"], data.receptionsParHuilerie.map((r) => [r.cle, r.lots, r.kg])),
              )}
            >
              <BarresHorizontales lignes={data.receptionsParHuilerie.map((r) => ({ libelle: r.cle, valeur: r.kg, detail: `${r.lots} lot(s)` }))} format={kg} />
            </Carte>
            <Carte titre="Réceptions par mois" actions={boutonCsv(() => csvMensuel("receptions-mois", "Quantité (kg)", data.receptionsParMois))}>
              <Colonnes points={mensuel(data.receptionsParMois)} format={kg} />
            </Carte>
            <Carte
              titre="Réceptions par variété"
              actions={boutonCsv(() =>
                telechargerCsv(`receptions-varietes_${suffixe}.csv`, ["Variété", "Lots", "Quantité (kg)"], data.receptionsParVariete.map((r) => [r.cle, r.lots, r.kg])),
              )}
            >
              <BarresHorizontales lignes={data.receptionsParVariete.map((r) => ({ libelle: r.cle, valeur: r.kg, detail: `${r.lots} lot(s)` }))} format={kg} />
            </Carte>
            <Carte
              titre="Ventes en vrac par client"
              actions={boutonCsv(() => telechargerCsv(`ventes-vrac_${suffixe}.csv`, ["Client", "Quantité (kg)"], data.ventesVracParClient.map((r) => [r.cle, r.kg])))}
            >
              <BarresHorizontales lignes={data.ventesVracParClient.map((r) => ({ libelle: r.cle, valeur: r.kg }))} format={kg} />
            </Carte>
            <Carte
              titre="Mise en bouteille par format"
              actions={boutonCsv(() =>
                telechargerCsv(
                  `conditionnement-formats_${suffixe}.csv`,
                  ["Format", "Unités", "Litres", "Huile (kg)"],
                  data.conditionnementParFormat.map((r) => [r.cle, r.unites, r.litres, r.kg]),
                ),
              )}
            >
              <BarresHorizontales lignes={data.conditionnementParFormat.map((r) => ({ libelle: r.cle, valeur: r.litres, detail: `${entier(r.unites)} u.` }))} format={litresTexte} />
            </Carte>
            <Carte titre="Mise en bouteille par mois (huile, kg)" actions={boutonCsv(() => csvMensuel("conditionnement-mois", "Huile (kg)", data.conditionnementParMois))}>
              <Colonnes points={mensuel(data.conditionnementParMois)} format={kg} />
            </Carte>
            <Carte
              titre="Exports par pays"
              actions={boutonCsv(() =>
                telechargerCsv(
                  `exports-pays_${suffixe}.csv`,
                  ["Pays", "Code", "Expéditions", "Unités", "Litres"],
                  data.exportsParPays.map((r) => [nomPays(r.cle), r.cle, r.expeditions, r.unites, r.litres]),
                ),
              )}
            >
              <BarresHorizontales lignes={data.exportsParPays.map((r) => ({ libelle: nomPays(r.cle), valeur: r.litres, detail: `${r.expeditions} exp.` }))} format={litresTexte} />
            </Carte>
            <Carte titre="Exports par mois (litres)" actions={boutonCsv(() => csvMensuel("exports-mois", "Litres", data.exportsParMois))}>
              <Colonnes points={mensuel(data.exportsParMois)} format={litresTexte} />
            </Carte>
            <Carte
              titre="Exports par client"
              actions={boutonCsv(() =>
                telechargerCsv(`exports-clients_${suffixe}.csv`, ["Client", "Expéditions", "Litres"], data.exportsParClient.map((r) => [r.cle, r.expeditions, r.litres])),
              )}
            >
              <BarresHorizontales lignes={data.exportsParClient.map((r) => ({ libelle: r.cle, valeur: r.litres, detail: `${r.expeditions} exp.` }))} format={litresTexte} />
            </Carte>
          </div>
          <p className="text-xs text-stone-500">
            Les exports comptent les expéditions parties (expédiées ou livrées) dont la date de départ est dans la période ; les volumes vendus en vrac comptent les sorties de stock au motif « vente ».
          </p>
        </>
      )}
    </div>
  );
}

import { Injectable } from '@nestjs/common';
import { ConditionnementsService } from '../conditionnement/conditionnements.service.js';
import { litres } from '../conditionnement/regles.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { QualiteService } from '../qualite/qualite.service.js';
import { StockService } from '../vrac/stock.service.js';
import { moisDeLaPeriode, periode, regrouper, serieMensuelle } from './regles.js';

const arrondi = (v: number) => Math.round(v * 10) / 10;

/** Tableau de bord de la direction (état actuel) et rapports sur une période. Lecture seule. */
@Injectable()
export class TableauDeBordService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly stock: StockService,
    private readonly qualite: QualiteService,
    private readonly conditionnements: ConditionnementsService,
  ) {}

  /** État en temps réel : lots actifs, stock par cuve et en produits finis, alertes qualité, expéditions en cours. */
  async etat() {
    const [cuves, alertesStock, qualite, produitsFinis, nonConformites, expeditions] = await Promise.all([
      this.stock.etatCuves(),
      this.stock.alertes(),
      this.qualite.alertes(),
      this.conditionnements.stockProduitsFinis(),
      this.prisma.nonConformite.findMany({
        where: { statut: { not: 'CLOTUREE' } },
        orderBy: { createdAt: 'asc' },
        take: 10,
        include: { lot: { select: { id: true, code: true } } },
      }),
      this.prisma.expedition.findMany({
        where: { statut: { in: ['PREPAREE', 'EXPEDIEE'] } },
        orderBy: [{ datePrevue: 'asc' }, { id: 'asc' }],
        select: {
          id: true,
          code: true,
          statut: true,
          paysDestination: true,
          datePrevue: true,
          dateDepart: true,
          modeTransport: true,
          client: { select: { id: true, code: true, raisonSociale: true } },
          lignes: { select: { quantiteUnites: true, lotConditionne: { select: { format: { select: { contenanceMl: true } } } } } },
        },
      }),
    ]);

    const stockVracKg = cuves.reduce((s, c) => s + c.quantiteKg, 0);
    const capaciteKg = cuves.reduce((s, c) => s + c.capaciteKg, 0);
    const enCours = expeditions.map(({ lignes, ...e }) => ({
      ...e,
      unites: lignes.reduce((s, l) => s + l.quantiteUnites, 0),
      litres: arrondi(lignes.reduce((s, l) => s + litres(l.quantiteUnites, l.lotConditionne.format.contenanceMl), 0)),
    }));

    return {
      indicateurs: {
        lotsActifs: qualite.compteurs.lotsEnStock,
        lotsConditionnesEnStock: produitsFinis.lots.length,
        stockVracKg,
        capaciteKg,
        tauxRemplissage: capaciteKg ? arrondi((stockVracKg / capaciteKg) * 100) : 0,
        cuvesVides: cuves.filter((c) => !c.lot).length,
        cuves: cuves.length,
        produitsFinisUnites: produitsFinis.parFormat.reduce((s, f) => s + f.unites, 0),
        produitsFinisLitres: arrondi(produitsFinis.parFormat.reduce((s, f) => s + f.litres, 0)),
        nonConformitesOuvertes: qualite.compteurs.nonConformitesOuvertes,
        lotsBloques: qualite.compteurs.bloques,
        expeditionsEnCours: enCours.length,
      },
      cuves: cuves.map((c) => ({
        id: c.id,
        code: c.code,
        type: c.type,
        capaciteKg: c.capaciteKg,
        quantiteKg: c.quantiteKg,
        tauxRemplissage: c.tauxRemplissage,
        lot: c.lot && { id: c.lot.id, code: c.lot.code, variete: c.lot.variete, joursEnStock: c.lot.joursEnStock },
      })),
      produitsFinis: produitsFinis.parFormat.map((f) => ({ format: f.format, unites: f.unites, litres: arrondi(f.litres), lots: f.lots })),
      qualite: qualite.compteurs,
      alertes: [...qualite.alertes, ...alertesStock.alertes.filter((a) => a.type !== 'SANS_ANALYSE')].sort((a, b) =>
        a.niveau === b.niveau ? 0 : a.niveau === 'ALERTE' ? -1 : 1,
      ),
      nonConformites: nonConformites.map((nc) => ({
        id: nc.id,
        code: nc.code,
        statut: nc.statut,
        description: nc.description,
        createdAt: nc.createdAt,
        lot: nc.lot,
      })),
      expeditions: enCours,
      expeditionsParPays: regrouper(enCours, (e) => e.paysDestination, (e) => ({ expeditions: 1, unites: e.unites, litres: e.litres }), 'litres'),
    };
  }

  /** Rapports sur une période (par défaut la campagne en cours) : réceptions, volumes, exports. */
  async rapports(duTexte?: string, auTexte?: string) {
    const { du, au } = periode(duTexte, auTexte);
    const dates = { gte: du, lte: au };
    const [receptions, sorties, filtrations, conditionnements, expeditions] = await Promise.all([
      this.prisma.lot.findMany({
        where: { origine: 'RECEPTION', dateReception: dates },
        select: {
          dateReception: true,
          quantiteInitialeKg: true,
          huilerie: { select: { code: true, nom: true } },
          variete: { select: { nom: true } },
        },
      }),
      this.prisma.mouvement.findMany({
        where: { quantiteKg: { lt: 0 }, operation: { type: 'SORTIE', date: dates } },
        select: { quantiteKg: true, operation: { select: { date: true, motif: true, client: { select: { raisonSociale: true, pays: true } } } } },
      }),
      this.prisma.filtration.findMany({
        where: { operation: { date: dates } },
        select: { quantiteEntreeKg: true, quantiteSortieKg: true },
      }),
      this.prisma.lotConditionne.findMany({
        where: { operation: { date: dates } },
        select: { quantiteKg: true, nombreUnites: true, operation: { select: { date: true } }, format: { select: { code: true, nom: true, contenanceMl: true } } },
      }),
      this.prisma.expedition.findMany({
        where: { statut: { in: ['EXPEDIEE', 'LIVREE'] }, dateDepart: dates },
        select: {
          paysDestination: true,
          dateDepart: true,
          client: { select: { raisonSociale: true } },
          lignes: { select: { quantiteUnites: true, lotConditionne: { select: { format: { select: { contenanceMl: true } } } } } },
        },
      }),
    ]);

    const mois = moisDeLaPeriode(du, au);
    const ventes = sorties.filter((s) => s.operation.motif === 'VENTE');
    const pertes = sorties.filter((s) => s.operation.motif === 'PERTE');
    const exports = expeditions.map((e) => ({
      pays: e.paysDestination,
      client: e.client.raisonSociale,
      date: e.dateDepart!,
      unites: e.lignes.reduce((s, l) => s + l.quantiteUnites, 0),
      litres: arrondi(e.lignes.reduce((s, l) => s + litres(l.quantiteUnites, l.lotConditionne.format.contenanceMl), 0)),
    }));
    const kgPerdusFiltration = filtrations.reduce((s, f) => s + f.quantiteEntreeKg - f.quantiteSortieKg, 0);

    return {
      du,
      au,
      volumes: {
        recuKg: receptions.reduce((s, r) => s + r.quantiteInitialeKg, 0),
        lotsRecus: receptions.length,
        venduVracKg: -ventes.reduce((s, v) => s + v.quantiteKg, 0),
        filtreKg: filtrations.reduce((s, f) => s + f.quantiteSortieKg, 0),
        conditionneKg: conditionnements.reduce((s, c) => s + c.quantiteKg, 0),
        conditionneUnites: conditionnements.reduce((s, c) => s + c.nombreUnites, 0),
        exporteLitres: arrondi(exports.reduce((s, e) => s + e.litres, 0)),
        exporteUnites: exports.reduce((s, e) => s + e.unites, 0),
        expeditions: exports.length,
        pertesKg: -pertes.reduce((s, p) => s + p.quantiteKg, 0) + kgPerdusFiltration,
      },
      receptionsParHuilerie: regrouper(
        receptions,
        (r) => r.huilerie?.nom ?? 'Sans huilerie',
        (r) => ({ kg: r.quantiteInitialeKg, lots: 1 }),
        'kg',
      ),
      receptionsParVariete: regrouper(receptions, (r) => r.variete?.nom ?? 'Non précisée', (r) => ({ kg: r.quantiteInitialeKg, lots: 1 }), 'kg'),
      receptionsParMois: serieMensuelle(receptions, (r) => r.dateReception, (r) => r.quantiteInitialeKg, mois),
      ventesVracParClient: regrouper(ventes, (v) => v.operation.client?.raisonSociale ?? 'Sans client', (v) => ({ kg: -v.quantiteKg }), 'kg'),
      conditionnementParFormat: regrouper(
        conditionnements,
        (c) => c.format.nom,
        (c) => ({ unites: c.nombreUnites, litres: litres(c.nombreUnites, c.format.contenanceMl), kg: c.quantiteKg }),
        'litres',
      ).map((l) => ({ ...l, litres: arrondi(l.litres) })),
      conditionnementParMois: serieMensuelle(conditionnements, (c) => c.operation.date, (c) => c.quantiteKg, mois),
      exportsParPays: regrouper(exports, (e) => e.pays, (e) => ({ expeditions: 1, unites: e.unites, litres: e.litres }), 'litres').map((l) => ({
        ...l,
        litres: arrondi(l.litres),
      })),
      exportsParClient: regrouper(exports, (e) => e.client, (e) => ({ expeditions: 1, litres: e.litres }), 'litres').map((l) => ({
        ...l,
        litres: arrondi(l.litres),
      })),
      exportsParMois: serieMensuelle(exports, (e) => e.date, (e) => e.litres, mois),
    };
  }
}

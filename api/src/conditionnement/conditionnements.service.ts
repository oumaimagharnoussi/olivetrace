import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AuditService } from '../audit/audit.service.js';
import { Prisma } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { QualiteService } from '../qualite/qualite.service.js';
import { StockService } from '../vrac/stock.service.js';
import { prochainCode } from './codes.js';
import { ConditionnementDto, MouvementProduitDto } from './conditionnement.dto.js';
import { DENSITE_HUILE_KG_L, dluoParDefaut, kgPourUnites, litres, mouvementProduit } from './regles.js';

type Db = PrismaService | Prisma.TransactionClient;

const lotConditionneInclude = {
  format: true,
  lotVrac: {
    select: {
      id: true,
      code: true,
      origine: true,
      categorieVisee: true,
      statutQualite: true,
      bloque: true,
      campagne: true,
      variete: { select: { id: true, nom: true } },
      huilerie: { select: { id: true, nom: true } },
    },
  },
  client: { select: { id: true, code: true, raisonSociale: true } },
  operation: {
    select: {
      date: true,
      user: { select: { id: true, nom: true } },
      mouvements: { select: { quantiteKg: true, stockage: { select: { id: true, code: true } } } },
    },
  },
} satisfies Prisma.LotConditionneInclude;

const mouvementInclude = {
  lotConditionne: { select: { id: true, code: true, format: { select: { nom: true } } } },
  client: { select: { id: true, code: true, raisonSociale: true } },
  user: { select: { id: true, nom: true } },
} satisfies Prisma.MouvementProduitFiniInclude;

/** Mise en bouteille (lots conditionnés) et stock de produits finis, en unités. */
@Injectable()
export class ConditionnementsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly stock: StockService,
    private readonly qualite: QualiteService,
    private readonly audit: AuditService,
    private readonly config: ConfigService,
  ) {}

  private densite() {
    return Number(this.config.get('DENSITE_HUILE_KG_L', DENSITE_HUILE_KG_L));
  }

  /** Unités en stock de chaque lot conditionné. */
  async stockParLot(db: Db, ids?: number[]): Promise<Map<number, number>> {
    const groupes = await db.mouvementProduitFini.groupBy({
      by: ['lotConditionneId'],
      where: ids ? { lotConditionneId: { in: ids } } : {},
      _sum: { quantiteUnites: true },
    });
    return new Map(groupes.map((g) => [g.lotConditionneId, g._sum.quantiteUnites ?? 0]));
  }

  async findAll(filtres: { lotVracId?: number; enStock?: boolean }) {
    const [lots, stock] = await Promise.all([
      this.prisma.lotConditionne.findMany({
        where: { lotVracId: filtres.lotVracId },
        orderBy: [{ operation: { date: 'desc' } }, { id: 'desc' }],
        take: 500,
        include: lotConditionneInclude,
      }),
      this.stockParLot(this.prisma),
    ]);
    return lots
      .map((l) => ({ ...l, stockUnites: stock.get(l.id) ?? 0, litres: litres(l.nombreUnites, l.format.contenanceMl) }))
      .filter((l) => !filtres.enStock || l.stockUnites > 0);
  }

  /** Fiche d'un lot conditionné : mouvements de stock et remontée jusqu'aux lots reçus des huileries. */
  async findOne(id: number) {
    const lot = await this.prisma.lotConditionne.findUnique({
      where: { id },
      include: { ...lotConditionneInclude, mouvements: { orderBy: [{ date: 'desc' }, { id: 'desc' }], include: mouvementInclude } },
    });
    if (!lot) throw new NotFoundException('Lot conditionné introuvable');
    const stockUnites = lot.mouvements.reduce((s, m) => s + m.quantiteUnites, 0);
    return { ...lot, stockUnites, litres: litres(lot.nombreUnites, lot.format.contenanceMl), ascendance: await this.ascendance(lot.lotVracId) };
  }

  /** Lots vrac dont provient un lot, de proche en proche (filtrations, assemblages) jusqu'aux réceptions. */
  private async ascendance(lotId: number) {
    const vus = new Set<number>();
    const resultat: { id: number; code: string; origine: string; huilerie: string | null; variete: string | null; campagne: string | null; niveau: number }[] = [];
    let niveau = 0;
    let courants = [lotId];
    while (courants.length) {
      const lots = await this.prisma.lot.findMany({
        where: { id: { in: courants } },
        include: { huilerie: { select: { nom: true } }, variete: { select: { nom: true } }, origines: { select: { parentId: true } } },
        orderBy: { code: 'asc' },
      });
      const suivants: number[] = [];
      for (const l of lots) {
        vus.add(l.id);
        resultat.push({ id: l.id, code: l.code, origine: l.origine, huilerie: l.huilerie?.nom ?? null, variete: l.variete?.nom ?? null, campagne: l.campagne, niveau });
        for (const o of l.origines) if (!vus.has(o.parentId)) suivants.push(o.parentId);
      }
      courants = [...new Set(suivants)];
      niveau++;
    }
    return resultat;
  }

  /**
   * Mise en bouteille : l'huile sort de sa cuve et devient un lot conditionné, qui entre dans le stock de produits finis.
   * Seul un lot analysé, conforme et non bloqué (et conforme au cahier des charges du client, s'il y en a un) est accepté.
   */
  async creer(dto: ConditionnementDto, userId: number) {
    const format = await this.prisma.formatConditionnement.findUnique({ where: { id: dto.formatId } });
    if (!format) throw new NotFoundException('Format introuvable');
    if (!format.actif) throw new BadRequestException(`Le format ${format.nom} est désactivé.`);
    const controle = await this.qualite.controleExpedition(dto.lotId, dto.clientId, true);
    if (!controle.autorise) throw new BadRequestException(controle.blocages);

    const date = dto.date ? new Date(dto.date) : new Date();
    const quantiteKg = dto.quantiteKg ?? kgPourUnites(dto.nombreUnites, format.contenanceMl, this.densite());
    const dluo = dto.dluo ? new Date(dto.dluo) : dluoParDefaut(date, Number(this.config.get('DLUO_MOIS', 18)));
    const { lotId, stockageId, code, date: _date, dluo: _dluo, quantiteKg: _quantiteKg, ...donnees } = dto;

    const lot = await this.prisma.$transaction(async (tx) => {
      const operation = await this.stock.enregistrer(tx, { type: 'CONDITIONNEMENT', date, userId, clientId: dto.clientId, notes: dto.notes }, [
        { lotId, stockageId, quantiteKg: -quantiteKg },
      ]);
      return tx.lotConditionne.create({
        data: {
          ...donnees,
          code: code || (await prochainCode(tx, 'lotConditionne', 'C', date)),
          operationId: operation.id,
          lotVracId: lotId,
          quantiteKg,
          dluo,
          mouvements: { create: { type: 'CONDITIONNEMENT', date, quantiteUnites: dto.nombreUnites, userId } },
        },
      });
    });

    await this.audit.log({ userId, action: 'CREATE', entite: 'LotConditionne', entiteId: lot.id, donnees: { ...dto, code: lot.code, quantiteKg, dluo } });
    return { lot: await this.findOne(lot.id), avertissements: controle.avertissements };
  }

  // --- Stock de produits finis -----------------------------------------------------------------

  /** Stock par lot conditionné et totaux par format. */
  async stockProduitsFinis() {
    const lots = await this.findAll({ enStock: true });
    const parFormat = new Map<number, { format: (typeof lots)[number]['format']; unites: number; litres: number; lots: number }>();
    for (const l of lots) {
      const ligne = parFormat.get(l.formatId) ?? { format: l.format, unites: 0, litres: 0, lots: 0 };
      ligne.unites += l.stockUnites;
      ligne.litres += litres(l.stockUnites, l.format.contenanceMl);
      ligne.lots++;
      parFormat.set(l.formatId, ligne);
    }
    return { lots, parFormat: [...parFormat.values()].sort((a, b) => a.format.code.localeCompare(b.format.code)) };
  }

  mouvements(filtres: { lotConditionneId?: number }) {
    return this.prisma.mouvementProduitFini.findMany({
      where: { lotConditionneId: filtres.lotConditionneId },
      orderBy: [{ date: 'desc' }, { id: 'desc' }],
      take: 500,
      include: mouvementInclude,
    });
  }

  /** Expédition, casse ou ajustement d'inventaire d'un lot conditionné. */
  async mouvement(dto: MouvementProduitDto, userId: number) {
    if (dto.type === 'EXPEDITION' && !dto.clientId) throw new BadRequestException('Le client est obligatoire pour une expédition.');
    const lot = await this.prisma.lotConditionne.findUnique({ where: { id: dto.lotConditionneId }, select: { id: true, code: true, lotVracId: true } });
    if (!lot) throw new NotFoundException('Lot conditionné introuvable');
    // Avant une expédition : le lot vrac d'origine ne doit pas avoir été bloqué depuis, et le cahier des charges du client est vérifié.
    if (dto.type === 'EXPEDITION') {
      const controle = await this.qualite.controleExpedition(lot.lotVracId, dto.clientId);
      if (!controle.autorise) throw new BadRequestException(controle.blocages);
    }

    const mouvement = await this.prisma.$transaction(async (tx) => {
      // Verrou sur le lot conditionné : deux sorties simultanées sont traitées l'une après l'autre.
      await tx.$queryRaw`SELECT id FROM \`LotConditionne\` WHERE id = ${lot.id} FOR UPDATE`;
      const stock = (await this.stockParLot(tx, [lot.id])).get(lot.id) ?? 0;
      const { delta, erreurs } = mouvementProduit(dto.type, dto.quantiteUnites, stock, lot.code);
      if (erreurs.length) throw new BadRequestException(erreurs);
      return tx.mouvementProduitFini.create({
        data: {
          lotConditionneId: lot.id,
          type: dto.type,
          date: dto.date ? new Date(dto.date) : new Date(),
          quantiteUnites: delta,
          clientId: dto.clientId,
          reference: dto.reference,
          notes: dto.notes,
          userId,
        },
        include: mouvementInclude,
      });
    });
    await this.audit.log({ userId, action: 'CREATE', entite: 'MouvementProduitFini', entiteId: mouvement.id, donnees: { ...dto } });
    return mouvement;
  }
}

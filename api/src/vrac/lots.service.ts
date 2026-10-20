import { Injectable, NotFoundException } from '@nestjs/common';
import { AuditService } from '../audit/audit.service.js';
import { Prisma } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { StockService } from './stock.service.js';
import { AnalyseDto, ReceptionDto } from './vrac.dto.js';

/** Code de lot suivant pour l'année de la date : L2026-0001, L2026-0002… */
export async function prochainCodeLot(tx: Prisma.TransactionClient, date: Date) {
  const prefixe = `L${date.getFullYear()}-`;
  const dernier = await tx.lot.findFirst({
    where: { code: { startsWith: prefixe } },
    orderBy: { code: 'desc' },
    select: { code: true },
  });
  const numero = dernier ? Number(dernier.code.slice(prefixe.length)) || 0 : 0;
  return `${prefixe}${String(numero + 1).padStart(4, '0')}`;
}

export function analyseData({ dateAnalyse, ...dto }: AnalyseDto) {
  return { ...dto, dateAnalyse: new Date(dateAnalyse) };
}

@Injectable()
export class LotsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly stock: StockService,
    private readonly audit: AuditService,
  ) {}

  async findAll(enStockSeulement = false) {
    const [lots, stock] = await Promise.all([
      this.prisma.lot.findMany({
        orderBy: { dateReception: 'desc' },
        include: {
          huilerie: { select: { id: true, code: true, nom: true } },
          variete: { select: { id: true, code: true, nom: true } },
          analyses: { orderBy: { dateAnalyse: 'desc' }, take: 1 },
        },
      }),
      this.stock.stockParLot(this.prisma),
    ]);
    return lots
      .map(({ analyses, ...lot }) => ({ ...lot, stockKg: stock.get(lot.id) ?? 0, derniereAnalyse: analyses[0] ?? null }))
      .filter((lot) => !enStockSeulement || lot.stockKg > 0);
  }

  async findOne(id: number) {
    const lot = await this.prisma.lot.findUnique({
      where: { id },
      include: {
        huilerie: true,
        variete: true,
        analyses: { orderBy: { dateAnalyse: 'desc' } },
        origines: { include: { parent: { select: { id: true, code: true } } } },
        enfants: { include: { lot: { select: { id: true, code: true, dateReception: true } } } },
        mouvements: {
          orderBy: { operation: { date: 'desc' } },
          include: {
            stockage: { select: { id: true, code: true } },
            operation: { include: { client: { select: { id: true, raisonSociale: true } }, livraison: true } },
          },
        },
      },
    });
    if (!lot) throw new NotFoundException('Lot introuvable');

    // Stock du lot cuve par cuve.
    const parCuve = new Map<number, { stockageId: number; code: string; quantiteKg: number }>();
    for (const m of lot.mouvements) {
      const ligne = parCuve.get(m.stockageId) ?? { stockageId: m.stockageId, code: m.stockage.code, quantiteKg: 0 };
      ligne.quantiteKg += m.quantiteKg;
      parCuve.set(m.stockageId, ligne);
    }
    const cuves = [...parCuve.values()].filter((c) => c.quantiteKg !== 0);
    return { ...lot, cuves, stockKg: cuves.reduce((s, c) => s + c.quantiteKg, 0) };
  }

  /** Réception d'huile d'une huilerie : crée le lot, son analyse éventuelle et l'entrée en cuve(s). */
  async reception({ repartition, analyse, dateReception, ...dto }: ReceptionDto, userId: number) {
    const date = new Date(dateReception);
    const quantiteKg = repartition.reduce((s, r) => s + r.quantiteKg, 0);

    const lot = await this.prisma.$transaction(async (tx) => {
      const lot = await tx.lot.create({
        data: {
          ...dto,
          code: dto.code || (await prochainCodeLot(tx, date)),
          origine: 'RECEPTION',
          dateReception: date,
          quantiteInitialeKg: quantiteKg,
          analyses: analyse ? { create: analyseData(analyse) } : undefined,
        },
      });
      await this.stock.enregistrer(
        tx,
        { type: 'RECEPTION', date, userId, notes: dto.notes },
        repartition.map((r) => ({ lotId: lot.id, stockageId: r.stockageId, quantiteKg: r.quantiteKg })),
      );
      return lot;
    });

    await this.audit.log({ userId, action: 'CREATE', entite: 'Lot', entiteId: lot.id, donnees: { ...dto, code: lot.code, dateReception, repartition, analyse } });
    return lot;
  }

  async ajouterAnalyse(lotId: number, dto: AnalyseDto, userId: number) {
    const analyse = await this.prisma.analyse.create({ data: { ...analyseData(dto), lot: { connect: { id: lotId } } } });
    await this.audit.log({ userId, action: 'CREATE', entite: 'Analyse', entiteId: analyse.id, donnees: { lotId, ...dto } });
    return analyse;
  }
}

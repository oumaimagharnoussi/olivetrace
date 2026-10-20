import { BadRequestException, Injectable } from '@nestjs/common';
import { AuditService } from '../audit/audit.service.js';
import type { Prisma } from '../generated/prisma/client.js';
import type { TypeOperation } from '../generated/prisma/enums.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { rang } from '../qualite/regles.js';
import { QualiteService } from '../qualite/qualite.service.js';
import { prochainCodeLot } from './lots.service.js';
import { controlerAssemblage } from './regles.js';
import { StockService } from './stock.service.js';
import { AssemblageDto, SortieDto, TransfertDto } from './vrac.dto.js';

const operationInclude = {
  user: { select: { id: true, nom: true } },
  client: { select: { id: true, code: true, raisonSociale: true } },
  livraison: true,
  mouvements: {
    include: { lot: { select: { id: true, code: true } }, stockage: { select: { id: true, code: true } } },
  },
} satisfies Prisma.OperationInclude;

@Injectable()
export class OperationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly stock: StockService,
    private readonly qualite: QualiteService,
    private readonly audit: AuditService,
  ) {}

  findAll(filtres: { type?: TypeOperation; lotId?: number; stockageId?: number; limit?: number }) {
    const { type, lotId, stockageId } = filtres;
    return this.prisma.operation.findMany({
      where: {
        type,
        ...(lotId || stockageId ? { mouvements: { some: { lotId, stockageId } } } : {}),
      },
      orderBy: [{ date: 'desc' }, { id: 'desc' }],
      take: Math.min(filtres.limit ?? 200, 500),
      include: operationInclude,
    });
  }

  /** Transfert d'une quantité d'un lot d'une cuve vers une autre. */
  async transfert(dto: TransfertDto, userId: number) {
    if (dto.sourceId === dto.destinationId) throw new BadRequestException('La cuve de destination doit être différente de la source.');
    const operation = await this.prisma.$transaction((tx) =>
      this.stock.enregistrer(tx, { type: 'TRANSFERT', date: dto.date ? new Date(dto.date) : new Date(), userId, notes: dto.notes }, [
        { lotId: dto.lotId, stockageId: dto.sourceId, quantiteKg: -dto.quantiteKg },
        { lotId: dto.lotId, stockageId: dto.destinationId, quantiteKg: dto.quantiteKg },
      ]),
    );
    await this.audit.log({ userId, action: 'CREATE', entite: 'Operation', entiteId: operation.id, donnees: { type: 'TRANSFERT', ...dto } });
    return this.prisma.operation.findUniqueOrThrow({ where: { id: operation.id }, include: operationInclude });
  }

  /** Contrôles d'un assemblage sans l'enregistrer : acidité estimée et avertissements à confirmer. */
  async simulerAssemblage(dto: AssemblageDto) {
    const parLot = new Map<number, number>();
    for (const e of dto.entrees) parLot.set(e.lotId, (parLot.get(e.lotId) ?? 0) + e.quantiteKg);
    if (parLot.size < 2) throw new BadRequestException('Un assemblage demande au moins deux lots différents.');

    const lots = await this.prisma.lot.findMany({
      where: { id: { in: [...parLot.keys()] } },
      include: { variete: { select: { id: true, nom: true } }, analyses: { orderBy: [{ dateAnalyse: 'desc' }, { id: 'desc' }], take: 1 } },
    });
    if (lots.length !== parLot.size) throw new BadRequestException('Lot introuvable.');

    const controle = controlerAssemblage(
      lots.map((l) => ({
        code: l.code,
        quantiteKg: parLot.get(l.id)!,
        variete: l.variete?.nom ?? null,
        campagne: l.campagne,
        acidite: l.analyses[0]?.acidite == null ? null : Number(l.analyses[0].acidite),
      })),
    );
    const bloques = lots.filter((l) => l.bloque);
    if (bloques.length) {
      controle.avertissements.push(
        `Lot${bloques.length > 1 ? 's' : ''} bloqué${bloques.length > 1 ? 's' : ''} par une non-conformité (${bloques.map((l) => l.code).join(', ')}) : ` +
          "pensez à clôturer la non-conformité (décision « assemblage correctif ») et à analyser le nouveau lot.",
      );
    }
    return { ...controle, lots, parLot };
  }

  /** Assemblage : plusieurs lots sont mélangés dans une cuve et forment un nouveau lot. */
  async assemblage(dto: AssemblageDto, userId: number) {
    const { lots, parLot, ...controle } = await this.simulerAssemblage(dto);
    const date = dto.date ? new Date(dto.date) : new Date();
    const varietes = new Set(lots.map((l) => l.variete?.id ?? null));
    const campagnes = new Set(lots.map((l) => l.campagne));
    const huileries = new Set(lots.map((l) => l.huilerieId));

    const lot = await this.prisma.$transaction(async (tx) => {
      const lot = await tx.lot.create({
        data: {
          code: dto.code || (await prochainCodeLot(tx, date)),
          origine: 'ASSEMBLAGE',
          // Variété, campagne et huilerie sont gardées seulement si tous les lots d'origine les partagent.
          varieteId: varietes.size === 1 ? [...varietes][0] : null,
          campagne: campagnes.size === 1 ? [...campagnes][0] : null,
          huilerieId: huileries.size === 1 ? [...huileries][0] : null,
          // Par défaut, la moins bonne catégorie visée des lots d'origine. Le nouveau lot devra être analysé.
          categorieVisee: dto.categorieVisee ?? lots.map((l) => l.categorieVisee).sort((a, b) => rang(b) - rang(a))[0],
          dateReception: date,
          quantiteInitialeKg: controle.quantiteKg,
          notes: dto.notes,
          origines: { create: [...parLot].map(([parentId, quantiteKg]) => ({ parentId, quantiteKg })) },
        },
      });
      await this.stock.enregistrer(tx, { type: 'ASSEMBLAGE', date, userId, notes: dto.notes }, [
        ...dto.entrees.map((e) => ({ lotId: e.lotId, stockageId: e.stockageId, quantiteKg: -e.quantiteKg })),
        { lotId: lot.id, stockageId: dto.destinationId, quantiteKg: controle.quantiteKg },
      ]);
      return lot;
    });

    await this.audit.log({ userId, action: 'CREATE', entite: 'Lot', entiteId: lot.id, donnees: { type: 'ASSEMBLAGE', ...dto, code: lot.code, ...controle } });
    return { lot, ...controle };
  }

  /** Sortie de stock : vente en vrac (avec transport éventuel), envoi au conditionnement ou perte. */
  async sortie({ livraison, ...dto }: SortieDto, userId: number) {
    if (dto.motif === 'VENTE' && !dto.clientId) throw new BadRequestException('Le client est obligatoire pour une vente.');
    // Contrôle qualité avant une vente ou un envoi au conditionnement : lot bloqué, cahier des charges du client.
    if (dto.motif === 'VENTE' || dto.motif === 'CONDITIONNEMENT') {
      const controle = await this.qualite.controleExpedition(dto.lotId, dto.motif === 'VENTE' ? dto.clientId : undefined);
      if (!controle.autorise) throw new BadRequestException(controle.blocages);
    }
    const operation = await this.prisma.$transaction(async (tx) => {
      const operation = await this.stock.enregistrer(
        tx,
        {
          type: 'SORTIE',
          date: dto.date ? new Date(dto.date) : new Date(),
          userId,
          motif: dto.motif,
          clientId: dto.clientId,
          notes: dto.notes,
        },
        [{ lotId: dto.lotId, stockageId: dto.stockageId, quantiteKg: -dto.quantiteKg }],
      );
      if (livraison) {
        await tx.livraison.create({
          data: {
            ...livraison,
            operationId: operation.id,
            dateEnlevement: livraison.dateEnlevement ? new Date(livraison.dateEnlevement) : undefined,
            dateLivraisonPrevue: livraison.dateLivraisonPrevue ? new Date(livraison.dateLivraisonPrevue) : undefined,
          },
        });
      }
      return operation;
    });
    await this.audit.log({ userId, action: 'CREATE', entite: 'Operation', entiteId: operation.id, donnees: { type: 'SORTIE', ...dto, livraison } });
    return this.prisma.operation.findUniqueOrThrow({ where: { id: operation.id }, include: operationInclude });
  }
}

import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { AuditService } from '../audit/audit.service.js';
import type { Prisma } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { QualiteService } from '../qualite/qualite.service.js';
import { prochainCodeLot } from '../vrac/lots.service.js';
import { StockService } from '../vrac/stock.service.js';
import { prochainCode } from './codes.js';
import { FiltrationDto } from './conditionnement.dto.js';
import { controlerFiltration } from './regles.js';

const filtrationInclude = {
  lotEntree: { select: { id: true, code: true } },
  lotSortie: { select: { id: true, code: true, statutQualite: true, bloque: true } },
  operation: {
    select: {
      date: true,
      user: { select: { id: true, nom: true } },
      mouvements: { select: { quantiteKg: true, stockage: { select: { id: true, code: true } } } },
    },
  },
} satisfies Prisma.FiltrationInclude;

@Injectable()
export class FiltrationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly stock: StockService,
    private readonly qualite: QualiteService,
    private readonly audit: AuditService,
  ) {}

  findAll(lotId?: number) {
    return this.prisma.filtration.findMany({
      where: lotId ? { OR: [{ lotEntreeId: lotId }, { lotSortieId: lotId }] } : {},
      orderBy: [{ operation: { date: 'desc' } }, { id: 'desc' }],
      take: 500,
      include: filtrationInclude,
    });
  }

  /**
   * Filtration : l'huile du lot passe de la cuve de départ à la cuve d'arrivée et forme un nouveau lot, relié au lot filtré.
   * Seul un lot analysé, conforme et non bloqué peut être filtré.
   */
  async creer(dto: FiltrationDto, userId: number) {
    const { erreurs, avertissements, perteKg, tauxPerte } = controlerFiltration(dto.quantiteEntreeKg, dto.quantiteSortieKg);
    if (erreurs.length) throw new BadRequestException(erreurs);
    const controle = await this.qualite.controleExpedition(dto.lotId, undefined, true);
    if (!controle.autorise) throw new BadRequestException(controle.blocages);

    const entree = await this.prisma.lot.findUnique({ where: { id: dto.lotId } });
    if (!entree) throw new NotFoundException('Lot introuvable');
    const date = dto.date ? new Date(dto.date) : new Date();
    const { lotId, sourceId, destinationId, code, date: _date, ...parametres } = dto;

    const filtration = await this.prisma.$transaction(async (tx) => {
      // Le lot filtré garde l'origine du lot d'entrée et, tant qu'il n'a pas sa propre analyse, sa qualité.
      const sortie = await tx.lot.create({
        data: {
          code: code || (await prochainCodeLot(tx, date)),
          origine: 'FILTRATION',
          huilerieId: entree.huilerieId,
          varieteId: entree.varieteId,
          campagne: entree.campagne,
          categorieVisee: entree.categorieVisee,
          statutQualite: entree.statutQualite,
          dateReception: date,
          quantiteInitialeKg: dto.quantiteSortieKg,
          notes: dto.notes,
          origines: { create: { parentId: entree.id, quantiteKg: dto.quantiteEntreeKg } },
        },
      });
      const operation = await this.stock.enregistrer(tx, { type: 'FILTRATION', date, userId, notes: dto.notes }, [
        { lotId, stockageId: sourceId, quantiteKg: -dto.quantiteEntreeKg },
        { lotId: sortie.id, stockageId: destinationId, quantiteKg: dto.quantiteSortieKg },
      ]);
      return tx.filtration.create({
        data: {
          ...parametres,
          code: await prochainCode(tx, 'filtration', 'F', date),
          operationId: operation.id,
          lotEntreeId: lotId,
          lotSortieId: sortie.id,
        },
      });
    });

    await this.audit.log({ userId, action: 'CREATE', entite: 'Filtration', entiteId: filtration.id, donnees: { ...dto, code: filtration.code, perteKg } });
    return {
      filtration: await this.prisma.filtration.findUniqueOrThrow({ where: { id: filtration.id }, include: filtrationInclude }),
      perteKg,
      tauxPerte,
      avertissements: [...avertissements, ...controle.avertissements],
    };
  }
}

import { Injectable } from '@nestjs/common';
import { AuditService } from '../audit/audit.service.js';
import type { StatutLivraison } from '../generated/prisma/enums.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { UpdateLivraisonDto } from './vrac.dto.js';

const livraisonInclude = {
  operation: {
    include: {
      client: { select: { id: true, code: true, raisonSociale: true, pays: true, ville: true } },
      mouvements: { include: { lot: { select: { id: true, code: true } }, stockage: { select: { id: true, code: true } } } },
    },
  },
};

const DATES = ['dateEnlevement', 'dateLivraisonPrevue', 'dateLivraison'] as const;

@Injectable()
export class LivraisonsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  findAll(statut?: StatutLivraison) {
    return this.prisma.livraison.findMany({
      where: { statut },
      orderBy: { createdAt: 'desc' },
      include: livraisonInclude,
    });
  }

  async update(id: number, dto: UpdateLivraisonDto, userId: number) {
    const data: Record<string, unknown> = { ...dto };
    for (const champ of DATES) if (dto[champ]) data[champ] = new Date(dto[champ]);
    // Marquée livrée sans date : on prend la date du jour.
    if (dto.statut === 'LIVREE' && !dto.dateLivraison) data.dateLivraison = new Date();

    const livraison = await this.prisma.livraison.update({ where: { id }, data, include: livraisonInclude });
    await this.audit.log({ userId, action: 'UPDATE', entite: 'Livraison', entiteId: id, donnees: dto });
    return livraison;
  }
}

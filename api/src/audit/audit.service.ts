import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';

export type AuditAction = 'CREATE' | 'UPDATE' | 'DELETE' | 'LOGIN' | 'REGISTER' | 'PASSWORD_RESET';

@Injectable()
export class AuditService {
  constructor(private readonly prisma: PrismaService) {}

  async log(params: {
    userId?: number;
    action: AuditAction;
    entite: string;
    entiteId: string | number;
    donnees?: unknown;
  }) {
    await this.prisma.auditLog.create({
      data: {
        userId: params.userId,
        action: params.action,
        entite: params.entite,
        entiteId: String(params.entiteId),
        donnees: params.donnees === undefined ? undefined : JSON.parse(JSON.stringify(params.donnees)),
      },
    });
  }

  list(limit = 100) {
    return this.prisma.auditLog.findMany({
      orderBy: { createdAt: 'desc' },
      take: Math.min(limit, 500),
      include: { user: { select: { id: true, nom: true, email: true } }, ancrage: { select: { id: true, statut: true } } },
    });
  }
}

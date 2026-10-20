import { NotFoundException } from '@nestjs/common';
import { AuditService } from '../audit/audit.service.js';

// Sous-ensemble commun aux délégués Prisma des référentiels (huilerie, variete, stockage, client).
interface Delegate {
  findMany(args: object): Promise<unknown[]>;
  findUnique(args: { where: { id: number } }): Promise<unknown>;
  create(args: { data: object }): Promise<{ id: number }>;
  update(args: { where: { id: number }; data: object }): Promise<{ id: number }>;
}

/**
 * Logique partagée des référentiels : liste, détail, création, modification, désactivation.
 * Un élément n'est jamais supprimé physiquement (il pourra être lié à des lots) : il est désactivé.
 */
export abstract class ReferentielService<CreateDto extends object, UpdateDto extends object> {
  protected constructor(
    private readonly delegate: Delegate,
    private readonly audit: AuditService,
    private readonly entite: string,
  ) {}

  findAll(inclureInactifs = false) {
    return this.delegate.findMany({
      where: inclureInactifs ? {} : { actif: true },
      orderBy: { code: 'asc' },
    });
  }

  async findOne(id: number) {
    const item = await this.delegate.findUnique({ where: { id } });
    if (!item) throw new NotFoundException('Élément introuvable');
    return item;
  }

  async create(dto: CreateDto, userId: number) {
    const item = await this.delegate.create({ data: dto });
    await this.audit.log({ userId, action: 'CREATE', entite: this.entite, entiteId: item.id, donnees: dto });
    return item;
  }

  async update(id: number, dto: UpdateDto, userId: number) {
    const item = await this.delegate.update({ where: { id }, data: dto });
    await this.audit.log({ userId, action: 'UPDATE', entite: this.entite, entiteId: id, donnees: dto });
    return item;
  }

  async deactivate(id: number, userId: number) {
    const item = await this.delegate.update({ where: { id }, data: { actif: false } });
    await this.audit.log({ userId, action: 'DELETE', entite: this.entite, entiteId: id });
    return item;
  }
}

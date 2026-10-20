import { Injectable, NotFoundException } from '@nestjs/common';
import bcrypt from 'bcryptjs';
import { AuditService } from '../audit/audit.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { CreateUserDto, UpdateUserDto } from './users.dto.js';

// Champs renvoyés par l'API : jamais le hash du mot de passe.
const publicFields = { id: true, email: true, nom: true, role: true, actif: true, createdAt: true, updatedAt: true };

@Injectable()
export class UsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  findAll() {
    return this.prisma.user.findMany({ select: publicFields, orderBy: { nom: 'asc' } });
  }

  async findOne(id: number) {
    const user = await this.prisma.user.findUnique({ where: { id }, select: publicFields });
    if (!user) throw new NotFoundException('Utilisateur introuvable');
    return user;
  }

  async create({ password, ...dto }: CreateUserDto, byUserId: number) {
    const user = await this.prisma.user.create({
      data: { ...dto, email: dto.email.toLowerCase(), passwordHash: await bcrypt.hash(password, 10) },
      select: publicFields,
    });
    await this.audit.log({ userId: byUserId, action: 'CREATE', entite: 'User', entiteId: user.id, donnees: dto });
    return user;
  }

  async update(id: number, { password, ...dto }: UpdateUserDto, byUserId: number) {
    const user = await this.prisma.user.update({
      where: { id },
      data: {
        ...dto,
        email: dto.email?.toLowerCase(),
        passwordHash: password ? await bcrypt.hash(password, 10) : undefined,
      },
      select: publicFields,
    });
    await this.audit.log({
      userId: byUserId,
      action: 'UPDATE',
      entite: 'User',
      entiteId: id,
      donnees: { ...dto, motDePasseModifie: Boolean(password) },
    });
    return user;
  }
}

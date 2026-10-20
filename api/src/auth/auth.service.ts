import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import bcrypt from 'bcryptjs';
import { AuditService } from '../audit/audit.service.js';
import { PrismaService } from '../prisma/prisma.service.js';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly audit: AuditService,
  ) {}

  async login(email: string, password: string) {
    const user = await this.prisma.user.findUnique({ where: { email: email.toLowerCase() } });
    if (!user || !user.actif || !(await bcrypt.compare(password, user.passwordHash))) {
      throw new UnauthorizedException('Email ou mot de passe incorrect');
    }
    await this.audit.log({ userId: user.id, action: 'LOGIN', entite: 'User', entiteId: user.id });
    return {
      accessToken: await this.jwt.signAsync({ sub: user.id, role: user.role }),
      user: { id: user.id, email: user.email, nom: user.nom, role: user.role },
    };
  }
}

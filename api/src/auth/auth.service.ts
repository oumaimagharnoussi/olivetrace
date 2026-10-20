import { BadRequestException, ConflictException, Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import bcrypt from 'bcryptjs';
import { createHash, randomBytes } from 'node:crypto';
import { AuditService } from '../audit/audit.service.js';
import { MailService } from '../mail/mail.service.js';
import { PrismaService } from '../prisma/prisma.service.js';

const RESET_VALIDITE_MS = 60 * 60 * 1000; // lien valable 1 heure

const sha256 = (valeur: string) => createHash('sha256').update(valeur).digest('hex');

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly audit: AuditService,
    private readonly mail: MailService,
    private readonly config: ConfigService,
  ) {}

  async login(email: string, password: string) {
    const user = await this.prisma.user.findUnique({ where: { email: email.toLowerCase() } });
    if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
      throw new UnauthorizedException('Email ou mot de passe incorrect');
    }
    // Le mot de passe est juste : on peut dire pourquoi le compte ne peut pas encore se connecter.
    if (!user.role) {
      throw new UnauthorizedException('Votre compte est en attente de validation par un administrateur');
    }
    if (!user.actif) throw new UnauthorizedException('Votre compte est désactivé');

    await this.audit.log({ userId: user.id, action: 'LOGIN', entite: 'User', entiteId: user.id });
    return {
      accessToken: await this.jwt.signAsync({ sub: user.id, role: user.role }),
      user: { id: user.id, email: user.email, nom: user.nom, role: user.role },
    };
  }

  /** Inscription : le compte est créé inactif et sans rôle, un administrateur le valide. */
  async register(nom: string, email: string, password: string) {
    const existe = await this.prisma.user.findUnique({ where: { email: email.toLowerCase() } });
    if (existe) throw new ConflictException('Un compte existe déjà avec cet email');

    const user = await this.prisma.user.create({
      data: { nom, email: email.toLowerCase(), passwordHash: await bcrypt.hash(password, 10), actif: false },
    });
    await this.audit.log({ userId: user.id, action: 'REGISTER', entite: 'User', entiteId: user.id, donnees: { nom, email } });

    const admins = await this.prisma.user.findMany({ where: { role: 'ADMIN', actif: true }, select: { email: true } });
    for (const admin of admins) {
      await this.mail
        .send(
          admin.email,
          'OliveTrace : nouvelle inscription à valider',
          `${nom} (${user.email}) a demandé un compte.\n\nOuvrez l'écran Utilisateurs pour lui attribuer un rôle et l'activer :\n${this.webUrl()}/utilisateurs`,
        )
        .catch((e: Error) => this.logger.error(`Envoi à ${admin.email} impossible : ${e.message}`));
    }
    return { message: 'Inscription enregistrée. Un administrateur doit valider votre compte avant la première connexion.' };
  }

  /** Envoie un lien de réinitialisation. La réponse est la même que l'email existe ou non. */
  async forgotPassword(email: string) {
    const user = await this.prisma.user.findUnique({ where: { email: email.toLowerCase() } });
    if (user) {
      const token = randomBytes(32).toString('hex');
      await this.prisma.passwordResetToken.create({
        data: { userId: user.id, tokenHash: sha256(token), expiresAt: new Date(Date.now() + RESET_VALIDITE_MS) },
      });
      await this.mail
        .send(
          user.email,
          'OliveTrace : réinitialisation du mot de passe',
          `Bonjour ${user.nom},\n\nPour choisir un nouveau mot de passe, ouvrez ce lien (valable 1 heure) :\n${this.webUrl()}/reset-password?token=${token}\n\nSi vous n'êtes pas à l'origine de cette demande, ignorez ce message.`,
        )
        .catch((e: Error) => this.logger.error(`Envoi à ${user.email} impossible : ${e.message}`));
    }
    return { message: 'Si un compte existe avec cet email, un lien de réinitialisation vient d’être envoyé.' };
  }

  async resetPassword(token: string, password: string) {
    const reset = await this.prisma.passwordResetToken.findUnique({ where: { tokenHash: sha256(token) } });
    if (!reset || reset.usedAt || reset.expiresAt < new Date()) {
      throw new BadRequestException('Lien invalide ou expiré. Faites une nouvelle demande.');
    }
    await this.prisma.$transaction([
      this.prisma.user.update({ where: { id: reset.userId }, data: { passwordHash: await bcrypt.hash(password, 10) } }),
      // Le lien utilisé et toutes les autres demandes en cours de ce compte deviennent inutilisables.
      this.prisma.passwordResetToken.updateMany({ where: { userId: reset.userId, usedAt: null }, data: { usedAt: new Date() } }),
    ]);
    await this.audit.log({ userId: reset.userId, action: 'PASSWORD_RESET', entite: 'User', entiteId: reset.userId });
    return { message: 'Mot de passe modifié. Vous pouvez vous connecter.' };
  }

  private webUrl() {
    return this.config.get<string>('WEB_URL', 'http://localhost:3000').replace(/\/$/, '');
  }
}

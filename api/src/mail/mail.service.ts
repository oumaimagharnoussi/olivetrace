import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import nodemailer, { type Transporter } from 'nodemailer';

/**
 * Envoi des e-mails. Sans SMTP_HOST dans .env (développement), le message est
 * écrit dans la console de l'API au lieu d'être envoyé.
 */
@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  private readonly transporter: Transporter | null;
  private readonly from: string;

  constructor(config: ConfigService) {
    const host = config.get<string>('SMTP_HOST');
    this.from = config.get<string>('SMTP_FROM', 'OliveTrace <no-reply@olivetrace.local>');
    this.transporter = host
      ? nodemailer.createTransport({
          host,
          port: Number(config.get('SMTP_PORT', 587)),
          secure: config.get('SMTP_SECURE') === 'true',
          auth: config.get('SMTP_USER') ? { user: config.get('SMTP_USER'), pass: config.get('SMTP_PASSWORD') } : undefined,
        })
      : null;
  }

  async send(to: string, subject: string, text: string) {
    if (!this.transporter) {
      this.logger.warn(`SMTP non configuré, e-mail non envoyé.\nÀ : ${to}\nObjet : ${subject}\n\n${text}`);
      return;
    }
    await this.transporter.sendMail({ from: this.from, to, subject, text });
  }
}

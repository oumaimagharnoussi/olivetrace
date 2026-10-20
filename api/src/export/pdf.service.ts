import { existsSync } from 'node:fs';
import { Injectable, Logger, OnModuleDestroy, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Browser } from 'puppeteer';

/**
 * Navigateurs déjà installés sur le poste, essayés si le Chrome téléchargé par Puppeteer manque
 * (installation hors ligne, proxy d'entreprise) : Edge est présent sur tous les Windows 10 et 11.
 */
const NAVIGATEURS_DU_SYSTEME = [
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/usr/bin/chromium',
  '/usr/bin/chromium-browser',
  '/usr/bin/google-chrome',
];

/**
 * Génération des PDF avec Puppeteer : une page HTML est imprimée par un Chrome sans fenêtre.
 * Le navigateur est lancé à la première demande puis gardé ouvert pour les suivantes.
 */
@Injectable()
export class PdfService implements OnModuleDestroy {
  private readonly logger = new Logger(PdfService.name);
  private navigateur: Promise<Browser> | null = null;

  constructor(private readonly config: ConfigService) {}

  /** Chemin du navigateur : CHROME_PATH dans api/.env, sinon le Chrome de Puppeteer, sinon Edge ou Chrome installé. */
  private async cheminNavigateur(): Promise<string | undefined> {
    const configure = this.config.get<string>('CHROME_PATH');
    if (configure) return configure;
    const { default: puppeteer } = await import('puppeteer');
    try {
      const chemin = await puppeteer.executablePath();
      if (existsSync(chemin)) return chemin;
    } catch {
      // Chrome de Puppeteer non téléchargé : on cherche un navigateur du système.
    }
    return NAVIGATEURS_DU_SYSTEME.find((c) => existsSync(c));
  }

  private async lancer(): Promise<Browser> {
    const { default: puppeteer } = await import('puppeteer');
    const executablePath = await this.cheminNavigateur();
    if (!executablePath) {
      throw new ServiceUnavailableException(
        'Aucun navigateur pour générer les PDF. Dans le dossier api : npx puppeteer browsers install chrome, ' +
          'ou indiquez CHROME_PATH dans api/.env (ex. le chemin de msedge.exe), puis redémarrez l\'API.',
      );
    }
    this.logger.log(`PDF : navigateur ${executablePath}`);
    // Dans un conteneur Linux lancé en root, Chrome refuse de démarrer avec son bac à sable.
    const root = process.platform === 'linux' && process.getuid?.() === 0;
    const browser = await puppeteer.launch({ executablePath, headless: true, args: root ? ['--no-sandbox'] : [] });
    browser.on('disconnected', () => (this.navigateur = null));
    return browser;
  }

  private obtenirNavigateur() {
    if (!this.navigateur) {
      this.navigateur = this.lancer().catch((e) => {
        this.navigateur = null;
        if (e instanceof ServiceUnavailableException) throw e;
        this.logger.error(e);
        throw new ServiceUnavailableException(
          `Le navigateur des PDF n'a pas démarré (${(e as Error).message}). Indiquez CHROME_PATH dans api/.env puis redémarrez l'API.`,
        );
      });
    }
    return this.navigateur;
  }

  /** Imprime une page HTML complète en PDF A4, avec le pied de page donné (numéros de page ajoutés). */
  async genererPdf(contenuHtml: string, piedDePage: string): Promise<Buffer> {
    const browser = await this.obtenirNavigateur();
    const page = await browser.newPage();
    try {
      await page.setContent(contenuHtml, { waitUntil: 'load' });
      const pdf = await page.pdf({
        format: 'A4',
        printBackground: true,
        margin: { top: '15mm', bottom: '18mm', left: '14mm', right: '14mm' },
        displayHeaderFooter: true,
        headerTemplate: '<span></span>',
        footerTemplate:
          '<div style="font-size:8px;color:#78716c;width:100%;padding:0 14mm;display:flex;justify-content:space-between;font-family:Arial,sans-serif">' +
          `<span>${piedDePage}</span><span>Page <span class="pageNumber"></span> / <span class="totalPages"></span></span></div>`,
      });
      return Buffer.from(pdf);
    } finally {
      await page.close();
    }
  }

  async onModuleDestroy() {
    if (this.navigateur) await (await this.navigateur.catch(() => null))?.close();
  }
}

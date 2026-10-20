import { Injectable, Logger, NotFoundException, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JsonRpcProvider, Wallet, formatEther } from 'ethers';
import type { Ancrage } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import {
  RESEAUX,
  donneesTransaction,
  empreinteAncrage,
  empreinteEvenement,
  lireDonneesTransaction,
  preuveMerkle,
  racineMerkle,
  verifierPreuve,
} from './regles.js';

/** Un événement n'est scellé qu'après ce délai : une écriture encore en cours ne doit pas être oubliée. */
const DELAI_SCELLEMENT_MS = 5_000;
/** Événements au plus par ancrage. */
const TAILLE_MAX_ANCRAGE = 5_000;
/** Attente maximale de la confirmation d'une transaction ; au-delà, elle est relue au passage suivant. */
const ATTENTE_CONFIRMATION_MS = 120_000;

const selectEvenement = { id: true, userId: true, action: true, entite: true, entiteId: true, donnees: true, createdAt: true, hash: true } as const;

/**
 * Blockchain (option) : scelle le journal d'audit par lots (ancrages) et inscrit l'empreinte de chaque ancrage
 * dans une transaction Polygon. Sans BLOCKCHAIN_RPC_URL ni BLOCKCHAIN_CLE_PRIVEE, les ancrages sont seulement scellés
 * dans la base : la vérification d'intégrité marche, sans la preuve publique horodatée.
 */
@Injectable()
export class BlockchainService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger('Blockchain');
  private minuterie: NodeJS.Timeout | null = null;
  private enCours: Promise<unknown> | null = null;

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  onModuleInit() {
    const minutes = Number(this.config.get('BLOCKCHAIN_INTERVALLE_MINUTES', 60));
    if (minutes > 0) {
      this.minuterie = setInterval(() => this.ancrer().catch((e: Error) => this.logger.error(e.message)), minutes * 60_000);
      this.minuterie.unref();
    }
  }

  onModuleDestroy() {
    if (this.minuterie) clearInterval(this.minuterie);
  }

  private configuration() {
    const url = this.config.get<string>('BLOCKCHAIN_RPC_URL') || '';
    const cle = this.config.get<string>('BLOCKCHAIN_CLE_PRIVEE') || '';
    return { url, cle, active: Boolean(url && cle), confirmations: Number(this.config.get('BLOCKCHAIN_CONFIRMATIONS', 1)) };
  }

  private portefeuille() {
    const { url, cle } = this.configuration();
    const fournisseur = new JsonRpcProvider(url);
    return { fournisseur, portefeuille: new Wallet(cle, fournisseur) };
  }

  /** Scelle les nouveaux événements, envoie les ancrages en attente et relit les transactions non confirmées. */
  ancrer() {
    // Un seul passage à la fois (minuterie et bouton « Ancrer maintenant »).
    this.enCours ??= this.passage().finally(() => (this.enCours = null));
    return this.enCours as Promise<Awaited<ReturnType<BlockchainService['passage']>>>;
  }

  private async passage() {
    const ancrage = await this.sceller();
    const { active } = this.configuration();
    if (active) {
      const aTraiter = await this.prisma.ancrage.findMany({ where: { statut: { in: ['SCELLE', 'ERREUR', 'ENVOYE'] } }, orderBy: { id: 'asc' } });
      for (const a of aTraiter) await (a.statut === 'ENVOYE' ? this.confirmer(a) : this.envoyer(a));
    }
    return { ancrage: ancrage && (await this.prisma.ancrage.findUnique({ where: { id: ancrage.id } })) };
  }

  /** Crée un ancrage avec les événements pas encore scellés : empreinte de chacun, racine de Merkle, chaînage. */
  async sceller(): Promise<Ancrage | null> {
    return this.prisma.$transaction(
      async (tx) => {
        const evenements = await tx.auditLog.findMany({
          where: { ancrageId: null, createdAt: { lt: new Date(Date.now() - DELAI_SCELLEMENT_MS) } },
          orderBy: { id: 'asc' },
          take: TAILLE_MAX_ANCRAGE,
          select: selectEvenement,
        });
        if (!evenements.length) return null;
        const empreintes = evenements.map(empreinteEvenement);
        const racine = racineMerkle(empreintes);
        const precedent = await tx.ancrage.findFirst({ orderBy: { id: 'desc' }, select: { empreinte: true } });
        const ancrage = await tx.ancrage.create({
          data: {
            racineMerkle: racine,
            empreinte: empreinteAncrage(precedent?.empreinte ?? null, racine, evenements.length),
            empreintePrecedente: precedent?.empreinte ?? null,
            nombreEvenements: evenements.length,
            premierAuditId: evenements[0].id,
            dernierAuditId: evenements[evenements.length - 1].id,
          },
        });
        for (const [i, e] of evenements.entries()) {
          await tx.auditLog.update({ where: { id: e.id }, data: { hash: empreintes[i], ancrageId: ancrage.id } });
        }
        this.logger.log(`Ancrage ${ancrage.id} : ${evenements.length} événement(s) scellé(s), empreinte ${ancrage.empreinte}`);
        return ancrage;
      },
      { timeout: 60_000 },
    );
  }

  /** Inscrit l'empreinte de l'ancrage dans une transaction (vers son propre portefeuille, montant nul). */
  private async envoyer(ancrage: Ancrage) {
    try {
      const { fournisseur, portefeuille } = this.portefeuille();
      const { chainId } = await fournisseur.getNetwork();
      const transaction = await portefeuille.sendTransaction({ to: portefeuille.address, value: 0n, data: donneesTransaction(ancrage.empreinte) });
      const envoye = await this.prisma.ancrage.update({
        where: { id: ancrage.id },
        data: {
          statut: 'ENVOYE',
          txHash: transaction.hash,
          chainId: Number(chainId),
          reseau: RESEAUX[Number(chainId)]?.nom ?? `chaine-${chainId}`,
          erreur: null,
        },
      });
      await this.confirmer(envoye, true);
    } catch (e) {
      const message = (e as { shortMessage?: string }).shortMessage ?? (e as Error).message;
      this.logger.error(`Ancrage ${ancrage.id} : ${message}`);
      await this.prisma.ancrage.update({ where: { id: ancrage.id }, data: { statut: 'ERREUR', erreur: message.slice(0, 2000) } });
    }
  }

  private async confirmer(ancrage: Ancrage, attendre = false) {
    if (!ancrage.txHash) return;
    const { fournisseur } = this.portefeuille();
    const { confirmations } = this.configuration();
    const recu = attendre
      ? await fournisseur.waitForTransaction(ancrage.txHash, confirmations, ATTENTE_CONFIRMATION_MS).catch(() => null)
      : await fournisseur.getTransactionReceipt(ancrage.txHash);
    if (!recu || (await recu.confirmations()) < confirmations) return;
    if (recu.status === 0) {
      await this.prisma.ancrage.update({ where: { id: ancrage.id }, data: { statut: 'ERREUR', erreur: 'Transaction rejetée par le réseau.' } });
      return;
    }
    const bloc = await fournisseur.getBlock(recu.blockNumber);
    await this.prisma.ancrage.update({
      where: { id: ancrage.id },
      data: { statut: 'CONFIRME', blocNumero: recu.blockNumber, blocDate: bloc ? new Date(bloc.timestamp * 1000) : null },
    });
  }

  private lienTransaction(a: Pick<Ancrage, 'chainId' | 'txHash'>) {
    const explorateur = a.chainId ? RESEAUX[a.chainId]?.explorateur : null;
    return explorateur && a.txHash ? `${explorateur}/tx/${a.txHash}` : null;
  }

  /** Configuration, portefeuille et derniers ancrages. */
  async etat() {
    const config = this.configuration();
    let portefeuille: { adresse: string; reseau: string; chainId: number; solde: string } | { erreur: string } | null = null;
    if (config.active) {
      try {
        const { fournisseur, portefeuille: p } = this.portefeuille();
        const [{ chainId }, solde] = await Promise.all([fournisseur.getNetwork(), fournisseur.getBalance(p.address)]);
        portefeuille = { adresse: p.address, chainId: Number(chainId), reseau: RESEAUX[Number(chainId)]?.nom ?? `chaine-${chainId}`, solde: formatEther(solde) };
      } catch (e) {
        portefeuille = { erreur: (e as { shortMessage?: string }).shortMessage ?? (e as Error).message };
      }
    }
    const [nonScelles, scelles, ancrages] = await Promise.all([
      this.prisma.auditLog.count({ where: { ancrageId: null } }),
      this.prisma.auditLog.count({ where: { ancrageId: { not: null } } }),
      this.prisma.ancrage.findMany({ orderBy: { id: 'desc' }, take: 50 }),
    ]);
    return {
      active: config.active,
      intervalleMinutes: Number(this.config.get('BLOCKCHAIN_INTERVALLE_MINUTES', 60)),
      portefeuille,
      evenements: { nonScelles, scelles },
      ancrages: ancrages.map((a) => ({ ...a, premierAuditId: String(a.premierAuditId), dernierAuditId: String(a.dernierAuditId), lien: this.lienTransaction(a) })),
    };
  }

  /**
   * Vérification d'intégrité : chaque événement scellé est relu et son empreinte recalculée, chaque racine et chaque
   * empreinte d'ancrage aussi ; pour un ancrage envoyé, la transaction est relue sur la blockchain.
   */
  async verifier() {
    const ancrages = await this.prisma.ancrage.findMany({ orderBy: { id: 'asc' } });
    const config = this.configuration();
    const fournisseur = config.active ? this.portefeuille().fournisseur : null;
    const resultats = [];
    let precedente: string | null = null;
    let evenementsVerifies = 0;
    for (const a of ancrages) {
      const problemes: string[] = [];
      const evenements = await this.prisma.auditLog.findMany({ where: { ancrageId: a.id }, orderBy: { id: 'asc' }, select: selectEvenement });
      evenementsVerifies += evenements.length;
      const empreintes = evenements.map(empreinteEvenement);
      evenements.forEach((e, i) => {
        if (e.hash !== empreintes[i]) problemes.push(`Événement ${e.id} (${e.entite} ${e.entiteId}) modifié après son scellement.`);
      });
      if (evenements.length !== a.nombreEvenements) {
        problemes.push(`${a.nombreEvenements} événement(s) scellé(s), ${evenements.length} retrouvé(s) : des événements ont été supprimés.`);
      }
      if (evenements.length && racineMerkle(empreintes) !== a.racineMerkle && !problemes.length) {
        problemes.push("La racine de Merkle ne correspond plus aux empreintes des événements.");
      }
      if (a.empreintePrecedente !== precedente || empreinteAncrage(a.empreintePrecedente, a.racineMerkle, a.nombreEvenements) !== a.empreinte) {
        problemes.push("La chaîne des ancrages est rompue (empreinte de l'ancrage modifiée ou ancrage supprimé).");
      }
      let surBlockchain: boolean | null = null;
      if (a.txHash && fournisseur) {
        try {
          const transaction = await fournisseur.getTransaction(a.txHash);
          surBlockchain = transaction ? lireDonneesTransaction(transaction.data) === a.empreinte : false;
          if (!surBlockchain) problemes.push("L'empreinte inscrite sur la blockchain ne correspond pas à celle de la base.");
        } catch (e) {
          problemes.push(`Blockchain injoignable : ${(e as Error).message}`);
        }
      }
      resultats.push({ id: a.id, statut: a.statut, nombreEvenements: a.nombreEvenements, ok: problemes.length === 0, surBlockchain, problemes, lien: this.lienTransaction(a) });
      precedente = a.empreinte;
    }
    return { ok: resultats.every((r) => r.ok), verifieLe: new Date(), evenementsVerifies, ancrages: resultats };
  }

  /**
   * Preuves publiques (page du QR code) : pour chaque événement demandé, s'il est intact (empreinte recalculée côté serveur),
   * son état de scellement et la transaction qui l'ancre. Ni le contenu ni l'empreinte de l'événement : une empreinte publique
   * permettrait de tester des hypothèses sur le contenu (quantité, client). Seule l'empreinte de l'ancrage, déjà publique
   * dans la transaction, est donnée.
   */
  async preuvesPubliques(references: { entite: string; entiteId: number }[]) {
    if (!references.length) return [];
    const evenements = await this.prisma.auditLog.findMany({
      where: { action: 'CREATE', OR: references.map((r) => ({ entite: r.entite, entiteId: String(r.entiteId) })) },
      orderBy: { id: 'asc' },
      select: { ...selectEvenement, ancrage: { select: { id: true, statut: true, empreinte: true, chainId: true, txHash: true, blocNumero: true, blocDate: true, reseau: true } } },
    });
    return evenements.map(({ ancrage, ...e }) => {
      const empreinte = empreinteEvenement(e);
      const ancre = ancrage?.statut === 'CONFIRME';
      return {
        entite: e.entite,
        entiteId: Number(e.entiteId),
        date: e.createdAt.toISOString().slice(0, 10),
        // Une empreinte recalculée différente de celle du scellement : l'événement a été modifié depuis.
        intact: e.hash === null || e.hash === empreinte,
        scelle: Boolean(ancrage),
        ancre,
        reseau: ancre ? ancrage.reseau : null,
        bloc: ancre ? { numero: ancrage.blocNumero, date: ancrage.blocDate } : null,
        empreinteAncrage: ancre ? ancrage.empreinte : null,
        txHash: ancre ? ancrage.txHash : null,
        lien: ancre ? this.lienTransaction(ancrage) : null,
      };
    });
  }

  /** Preuve d'un événement : son empreinte, son chemin de Merkle jusqu'à la racine, et la transaction qui l'ancre. */
  async preuve(auditId: bigint) {
    const evenement = await this.prisma.auditLog.findUnique({ where: { id: auditId }, select: { ...selectEvenement, ancrage: true } });
    if (!evenement) throw new NotFoundException('Événement introuvable');
    const { ancrage, ...e } = evenement;
    const empreinte = empreinteEvenement(e);
    const base = { evenement: { ...e, id: String(e.id) }, empreinte, intact: e.hash === null || e.hash === empreinte };
    if (!ancrage) return { ...base, ancrage: null, chemin: [], racineRecalculee: null };
    const feuilles = (await this.prisma.auditLog.findMany({ where: { ancrageId: ancrage.id }, orderBy: { id: 'asc' }, select: { id: true, hash: true } })).map(
      (f) => ({ id: f.id, hash: f.hash! }),
    );
    const chemin = preuveMerkle(
      feuilles.map((f) => f.hash),
      feuilles.findIndex((f) => f.id === e.id),
    );
    const racineRecalculee = verifierPreuve(empreinte, chemin);
    return {
      ...base,
      chemin,
      racineRecalculee,
      intact: base.intact && racineRecalculee === ancrage.racineMerkle,
      ancrage: { ...ancrage, premierAuditId: String(ancrage.premierAuditId), dernierAuditId: String(ancrage.dernierAuditId), lien: this.lienTransaction(ancrage) },
    };
  }
}

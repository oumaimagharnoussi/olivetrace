import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AuditService } from '../audit/audit.service.js';
import { Prisma } from '../generated/prisma/client.js';
import { PdfService } from '../pdf/pdf.service.js';
import { societe } from '../pdf/societe.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { LIBELLES_CATEGORIE, QualiteService } from '../qualite/qualite.service.js';
import { PARAMETRES } from '../qualite/regles.js';
import { type BonReception, pageBonReception } from './bon-reception.js';
import { controlerArrivee } from './regles.js';
import { StockService } from './stock.service.js';
import { AnalyseDto, ReceptionDto, TransportReceptionDto } from './vrac.dto.js';

const LIBELLES_RESULTAT: Record<string, string> = {
  NON_ANALYSE: 'non analysé',
  CONFORME: 'conforme',
  INCOMPLET: 'incomplet',
  NON_CONFORME: 'non conforme',
};

/** Code de lot suivant pour l'année de la date : L2026-0001, L2026-0002… */
export async function prochainCodeLot(tx: Prisma.TransactionClient, date: Date) {
  const prefixe = `L${date.getFullYear()}-`;
  const dernier = await tx.lot.findFirst({
    where: { code: { startsWith: prefixe } },
    orderBy: { code: 'desc' },
    select: { code: true },
  });
  const numero = dernier ? Number(dernier.code.slice(prefixe.length)) || 0 : 0;
  return `${prefixe}${String(numero + 1).padStart(4, '0')}`;
}

/** Numéro de bon de réception suivant pour l'année de la date : BR2026-0001… */
async function prochainNumeroBon(tx: Prisma.TransactionClient, date: Date) {
  const prefixe = `BR${date.getFullYear()}-`;
  const dernier = await tx.transportReception.findFirst({
    where: { numeroBon: { startsWith: prefixe } },
    orderBy: { numeroBon: 'desc' },
    select: { numeroBon: true },
  });
  const numero = dernier ? Number(dernier.numeroBon.slice(prefixe.length)) || 0 : 0;
  return `${prefixe}${String(numero + 1).padStart(4, '0')}`;
}

/** Champs du transport tels qu'enregistrés : dates converties, champs laissés vides effacés (la saisie remplace tout). */
function donneesTransport(dto: TransportReceptionDto) {
  return {
    transporteur: dto.transporteur,
    immatriculation: dto.immatriculation ?? null,
    chauffeur: dto.chauffeur ?? null,
    numeroBl: dto.numeroBl ?? null,
    conditionsLivraison: dto.conditionsLivraison ?? null,
    dateEnlevement: dto.dateEnlevement ? new Date(dto.dateEnlevement) : null,
    dateArrivee: dto.dateArrivee ? new Date(dto.dateArrivee) : null,
    quantiteAnnonceeKg: dto.quantiteAnnonceeKg ?? null,
    temperatureC: dto.temperatureC ?? null,
    citerneConforme: dto.citerneConforme ?? null,
    plombsIntacts: dto.plombsIntacts ?? null,
    numeroPlomb: dto.numeroPlomb ?? null,
    receptionnePar: dto.receptionnePar ?? null,
    observations: dto.observations ?? null,
  };
}

@Injectable()
export class LotsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly stock: StockService,
    private readonly qualite: QualiteService,
    private readonly audit: AuditService,
    private readonly pdf: PdfService,
    private readonly config: ConfigService,
  ) {}

  async findAll(enStockSeulement = false) {
    const [lots, stock] = await Promise.all([
      this.prisma.lot.findMany({
        orderBy: { dateReception: 'desc' },
        include: {
          huilerie: { select: { id: true, code: true, nom: true } },
          variete: { select: { id: true, code: true, nom: true } },
          analyses: { orderBy: [{ dateAnalyse: 'desc' }, { id: 'desc' }], take: 1 },
        },
      }),
      this.stock.stockParLot(this.prisma),
    ]);
    return lots
      .map(({ analyses, ...lot }) => ({ ...lot, stockKg: stock.get(lot.id) ?? 0, derniereAnalyse: analyses[0] ?? null }))
      .filter((lot) => !enStockSeulement || lot.stockKg > 0);
  }

  async findOne(id: number) {
    const lot = await this.prisma.lot.findUnique({
      where: { id },
      include: {
        huilerie: true,
        variete: true,
        analyses: { orderBy: [{ dateAnalyse: 'desc' }, { id: 'desc' }] },
        nonConformites: { orderBy: { createdAt: 'desc' }, include: { ouvertePar: { select: { nom: true } }, clotureePar: { select: { nom: true } } } },
        origines: { include: { parent: { select: { id: true, code: true } } } },
        enfants: { include: { lot: { select: { id: true, code: true, origine: true, dateReception: true } } } },
        filtration: { include: { lotEntree: { select: { id: true, code: true } } } },
        transport: true,
        filtrations: { include: { lotSortie: { select: { id: true, code: true } } }, orderBy: { id: 'desc' } },
        lotsConditionnes: { include: { format: { select: { nom: true, contenanceMl: true } } }, orderBy: { id: 'desc' } },
        mouvements: {
          orderBy: [{ operation: { date: 'desc' } }, { id: 'desc' }],
          include: {
            stockage: { select: { id: true, code: true } },
            operation: { include: { client: { select: { id: true, raisonSociale: true } }, livraison: true } },
          },
        },
      },
    });
    if (!lot) throw new NotFoundException('Lot introuvable');

    // Stock du lot cuve par cuve.
    const parCuve = new Map<number, { stockageId: number; code: string; quantiteKg: number }>();
    for (const m of lot.mouvements) {
      const ligne = parCuve.get(m.stockageId) ?? { stockageId: m.stockageId, code: m.stockage.code, quantiteKg: 0 };
      ligne.quantiteKg += m.quantiteKg;
      parCuve.set(m.stockageId, ligne);
    }
    const cuves = [...parCuve.values()].filter((c) => c.quantiteKg !== 0);
    const controleArrivee = lot.transport ? controlerArrivee(this.arrivee(lot, lot.transport)) : null;
    return { ...lot, cuves, stockKg: cuves.reduce((s, c) => s + c.quantiteKg, 0), controleArrivee };
  }

  private arrivee(
    lot: { quantiteInitialeKg: number },
    t: { quantiteAnnonceeKg: number | null; temperatureC: Prisma.Decimal | null; citerneConforme: boolean | null; plombsIntacts: boolean | null },
  ) {
    return {
      quantiteRecueKg: lot.quantiteInitialeKg,
      quantiteAnnonceeKg: t.quantiteAnnonceeKg,
      temperatureC: t.temperatureC === null ? null : Number(t.temperatureC),
      citerneConforme: t.citerneConforme,
      plombsIntacts: t.plombsIntacts,
    };
  }

  /** Réception d'huile d'une huilerie : crée le lot, son analyse éventuelle et l'entrée en cuve(s). */
  async reception({ repartition, analyse, transport, dateReception, ...dto }: ReceptionDto, userId: number) {
    const date = new Date(dateReception);
    const quantiteKg = repartition.reduce((s, r) => s + r.quantiteKg, 0);

    const lot = await this.prisma.$transaction(async (tx) => {
      const lot = await tx.lot.create({
        data: {
          ...dto,
          code: dto.code || (await prochainCodeLot(tx, date)),
          origine: 'RECEPTION',
          dateReception: date,
          quantiteInitialeKg: quantiteKg,
        },
      });
      await this.stock.enregistrer(
        tx,
        { type: 'RECEPTION', date, userId, notes: dto.notes },
        repartition.map((r) => ({ lotId: lot.id, stockageId: r.stockageId, quantiteKg: r.quantiteKg })),
      );
      if (transport) {
        await tx.transportReception.create({ data: { ...donneesTransport(transport), lotId: lot.id, numeroBon: await prochainNumeroBon(tx, date) } });
      }
      // L'analyse est comparée aux critères : si elle n'est pas conforme, le lot est reçu mais bloqué.
      if (!analyse) return { ...lot, nonConformite: null };
      const { nonConformite } = await this.qualite.enregistrerAnalyse(tx, lot.id, analyse, userId);
      return { ...(await tx.lot.findUniqueOrThrow({ where: { id: lot.id } })), nonConformite };
    });

    await this.audit.log({ userId, action: 'CREATE', entite: 'Lot', entiteId: lot.id, donnees: { ...dto, code: lot.code, dateReception, repartition, analyse, transport } });
    return lot;
  }

  /** Saisit ou corrige le transport d'un lot reçu ; le numéro du bon de réception est gardé. */
  async enregistrerTransport(lotId: number, dto: TransportReceptionDto, userId: number) {
    const lot = await this.prisma.lot.findUnique({ where: { id: lotId }, include: { transport: true } });
    if (!lot) throw new NotFoundException('Lot introuvable');
    if (lot.origine !== 'RECEPTION') throw new BadRequestException("Seul un lot reçu d'une huilerie a un transport de réception.");
    const transport = await this.prisma.$transaction(async (tx) =>
      lot.transport
        ? tx.transportReception.update({ where: { lotId }, data: donneesTransport(dto) })
        : tx.transportReception.create({ data: { ...donneesTransport(dto), lotId, numeroBon: await prochainNumeroBon(tx, lot.dateReception) } }),
    );
    await this.audit.log({ userId, action: lot.transport ? 'UPDATE' : 'CREATE', entite: 'TransportReception', entiteId: transport.id, donnees: { lotId, ...dto } });
    return { ...transport, controleArrivee: controlerArrivee(this.arrivee(lot, transport)) };
  }

  /** Données du bon de réception numérique d'un lot. */
  async bonReception(lotId: number): Promise<BonReception> {
    const lot = await this.prisma.lot.findUnique({
      where: { id: lotId },
      include: {
        huilerie: true,
        variete: true,
        transport: true,
        analyses: { orderBy: [{ dateAnalyse: 'asc' }, { id: 'asc' }], take: 1 },
        mouvements: { where: { operation: { type: 'RECEPTION' } }, include: { stockage: true } },
      },
    });
    if (!lot) throw new NotFoundException('Lot introuvable');
    if (!lot.transport) throw new BadRequestException("Saisissez d'abord le transport de la réception pour éditer le bon de réception.");
    const analyse = lot.analyses[0];
    const champs = ['ACIDITE', 'PEROXYDE', 'K232', 'K270', 'POLYPHENOLS'] as const;
    return {
      societe: societe(this.config),
      numeroBon: lot.transport.numeroBon,
      lot: { code: lot.code, dateReception: lot.dateReception, campagne: lot.campagne, categorieVisee: LIBELLES_CATEGORIE[lot.categorieVisee], numeroBon: lot.numeroBon },
      huilerie: lot.huilerie ? { code: lot.huilerie.code, nom: lot.huilerie.nom, region: lot.huilerie.region, agrement: lot.huilerie.agrement } : null,
      variete: lot.variete?.nom ?? null,
      cuves: lot.mouvements.map((m) => ({ code: m.stockage.code, type: m.stockage.type, quantiteKg: m.quantiteKg })),
      quantiteRecueKg: lot.quantiteInitialeKg,
      transport: { ...lot.transport, temperatureC: lot.transport.temperatureC === null ? null : Number(lot.transport.temperatureC) },
      controle: controlerArrivee(this.arrivee(lot, lot.transport)),
      analyse: analyse
        ? {
            date: analyse.dateAnalyse,
            laboratoire: analyse.laboratoire,
            reference: analyse.reference,
            valeurs: champs
              .filter((p) => analyse[PARAMETRES[p].champ] != null)
              .map((p) => ({
                libelle: PARAMETRES[p].libelle,
                valeur: `${Number(analyse[PARAMETRES[p].champ]).toLocaleString('fr-FR')}${PARAMETRES[p].unite ? ` ${PARAMETRES[p].unite}` : ''}`,
              })),
            resultat: LIBELLES_RESULTAT[analyse.resultat ?? 'NON_ANALYSE'],
          }
        : null,
      genereLe: new Date(),
    };
  }

  async bonReceptionPdf(lotId: number) {
    const bon = await this.bonReception(lotId);
    const pdf = await this.pdf.genererPdf(pageBonReception(bon), `${bon.societe.raisonSociale.replace(/[<>&"]/g, '')} · Bon de réception ${bon.numeroBon}`);
    return { pdf, nomFichier: `${bon.numeroBon}_${bon.lot.code}.pdf` };
  }

  ajouterAnalyse(lotId: number, dto: AnalyseDto, userId: number) {
    return this.qualite.ajouterAnalyse(lotId, dto, userId);
  }
}

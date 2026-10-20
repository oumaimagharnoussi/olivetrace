import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import QRCode from 'qrcode';
import { AuditService } from '../audit/audit.service.js';
import type { ParametreAnalyse } from '../generated/prisma/enums.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { PARAMETRES } from '../qualite/regles.js';
import { LIBELLES_CATEGORIE, QualiteService } from '../qualite/qualite.service.js';
import { PasseportDto } from './passeport.dto.js';
import { lireBouteille, nettoyerCertifications, nouveauJeton, parametreBouteille, plageEtiquettes, urlPasseport } from './regles.js';

/** Toutes les huileries d'OLIVED sont en Tunisie : c'est l'origine affichée sur le passeport. */
const PAYS_ORIGINE = 'Tunisie';

const NOMS_PAYS = new Intl.DisplayNames(['fr'], { type: 'region' });

function nomPays(code: string | null) {
  if (!code) return null;
  try {
    return NOMS_PAYS.of(code) ?? code;
  } catch {
    return code;
  }
}

/**
 * Passeport produit : QR code d'un lot conditionné ou d'une bouteille, et page publique.
 * La page publique est construite ici, champ par champ : rien d'autre que ce qui est listé n'en sort.
 */
@Injectable()
export class PasseportService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly qualite: QualiteService,
    private readonly audit: AuditService,
    private readonly config: ConfigService,
  ) {}

  private secret() {
    return String(this.config.get('PASSEPORT_SECRET') || this.config.get('JWT_SECRET') || 'olivetrace');
  }

  /** Adresse du site public, celle que le téléphone ouvre en scannant le QR code. */
  private baseUrl() {
    return String(this.config.get('PASSEPORT_WEB_URL') || this.config.get('WEB_URL') || 'http://localhost:3000');
  }

  /** Passeport d'un lot conditionné ; il est créé à la première demande, avec un jeton tiré au hasard. */
  private async obtenir(lotConditionneId: number) {
    const lot = await this.prisma.lotConditionne.findUnique({ where: { id: lotConditionneId }, select: { id: true, code: true, nombreUnites: true } });
    if (!lot) throw new NotFoundException('Lot conditionné introuvable');
    const passeport = await this.prisma.passeport.upsert({
      where: { lotConditionneId },
      create: { lotConditionneId, jeton: nouveauJeton() },
      update: {},
    });
    return { lot, passeport };
  }

  /** Passeport vu depuis l'application : réglages, adresse publique et statistiques de consultation. */
  async fiche(lotConditionneId: number) {
    const { lot, passeport } = await this.obtenir(lotConditionneId);
    return {
      ...passeport,
      certifications: (passeport.certifications as string[] | null) ?? [],
      url: urlPasseport(this.baseUrl(), passeport.jeton),
      nombreUnites: lot.nombreUnites,
      code: lot.code,
    };
  }

  async modifier(lotConditionneId: number, dto: PasseportDto, userId: number) {
    const { passeport } = await this.obtenir(lotConditionneId);
    const { certifications, ...reste } = dto;
    await this.prisma.passeport.update({
      where: { id: passeport.id },
      data: { ...reste, ...(certifications ? { certifications: nettoyerCertifications(certifications) } : {}) },
    });
    await this.audit.log({ userId, action: 'UPDATE', entite: 'Passeport', entiteId: passeport.id, donnees: { lotConditionneId, ...dto } });
    return this.fiche(lotConditionneId);
  }

  /** Nouveau jeton : les QR codes déjà imprimés ne mènent plus au passeport (QR code perdu ou copié). */
  async renouvelerJeton(lotConditionneId: number, userId: number) {
    const { passeport } = await this.obtenir(lotConditionneId);
    await this.prisma.passeport.update({ where: { id: passeport.id }, data: { jeton: nouveauJeton() } });
    await this.audit.log({ userId, action: 'UPDATE', entite: 'Passeport', entiteId: passeport.id, donnees: { lotConditionneId, jeton: 'renouvelé' } });
    return this.fiche(lotConditionneId);
  }

  // --- QR codes --------------------------------------------------------------------------------

  /** Adresse encodée dans le QR code : celle du lot, ou celle d'une bouteille (numéro signé). */
  private async adresse(lotConditionneId: number, unite?: number) {
    const { lot, passeport } = await this.obtenir(lotConditionneId);
    if (unite !== undefined && (unite < 1 || unite > lot.nombreUnites)) {
      throw new BadRequestException(`Le numéro de bouteille doit être entre 1 et ${lot.nombreUnites}.`);
    }
    const bouteille = unite === undefined ? undefined : parametreBouteille(this.secret(), passeport.jeton, unite);
    return { lot, url: urlPasseport(this.baseUrl(), passeport.jeton, bouteille) };
  }

  async qrSvg(lotConditionneId: number, unite?: number) {
    const { lot, url } = await this.adresse(lotConditionneId, unite);
    return { code: lot.code, svg: await QRCode.toString(url, { type: 'svg', errorCorrectionLevel: 'M', margin: 1 }) };
  }

  async qrPng(lotConditionneId: number, unite?: number) {
    const { lot, url } = await this.adresse(lotConditionneId, unite);
    return { code: lot.code, png: await QRCode.toBuffer(url, { type: 'png', errorCorrectionLevel: 'M', margin: 2, width: 1024 }) };
  }

  /** QR codes des bouteilles de..a, pour une planche d'étiquettes. */
  async etiquettes(lotConditionneId: number, de?: number, a?: number) {
    const { lot, passeport } = await this.obtenir(lotConditionneId);
    const { debut, fin, erreurs } = plageEtiquettes(de, a, lot.nombreUnites);
    if (erreurs.length) throw new BadRequestException(erreurs);
    const etiquettes = [];
    for (let numero = debut; numero <= fin; numero++) {
      const url = urlPasseport(this.baseUrl(), passeport.jeton, parametreBouteille(this.secret(), passeport.jeton, numero));
      etiquettes.push({ numero, url, svg: await QRCode.toString(url, { type: 'svg', errorCorrectionLevel: 'M', margin: 1 }) });
    }
    return { code: lot.code, nombreUnites: lot.nombreUnites, debut, fin, etiquettes };
  }

  // --- Page publique ---------------------------------------------------------------------------

  /** Passeport public d'un jeton scanné. `b` est le numéro signé de la bouteille, s'il y en a un. */
  async public(jeton: string, b?: string) {
    const passeport = await this.prisma.passeport.findUnique({
      where: { jeton },
      include: {
        lotConditionne: {
          include: {
            format: { select: { nom: true, contenanceMl: true, materiau: true } },
            operation: { select: { date: true } },
            lotVrac: { select: { id: true, categorieVisee: true, statutQualite: true, bloque: true } },
          },
        },
      },
    });
    if (!passeport?.publie) throw new NotFoundException("Ce passeport produit n'est pas disponible.");
    const lot = passeport.lotConditionne;

    const [ascendance, qualite, criteres] = await Promise.all([
      this.ascendance(lot.lotVracId),
      passeport.afficherAnalyses ? this.qualite.sourceQualite(this.prisma, lot.lotVracId) : null,
      passeport.afficherAnalyses ? this.qualite.criteresParCategorie(this.prisma) : null,
    ]);
    await this.prisma.passeport.update({
      where: { id: passeport.id },
      data: { consultations: { increment: 1 }, derniereConsultation: new Date() },
    });

    const categorie = lot.lotVrac.categorieVisee;
    // La conformité n'est affichée que si le lot vrac est conforme aujourd'hui et n'est pas bloqué.
    const conforme = lot.lotVrac.statutQualite === 'CONFORME' && !lot.lotVrac.bloque;
    const certifications = [
      ...(conforme ? [`Conforme au règlement délégué (UE) 2022/2104 : huile d'olive ${LIBELLES_CATEGORIE[categorie]}`] : []),
      ...((passeport.certifications as string[] | null) ?? []),
    ];

    const analyse = qualite?.analyse;
    const limites = new Map((criteres?.[categorie] ?? []).map((c) => [c.parametre, c]));

    return {
      code: lot.code,
      producteur: String(this.config.get('PASSEPORT_PRODUCTEUR') || 'OLIVED'),
      produit: {
        nom: passeport.nomProduit || `Huile d'olive ${LIBELLES_CATEGORIE[categorie]}`,
        description: passeport.description,
        categorie: LIBELLES_CATEGORIE[categorie],
        format: lot.format,
      },
      dateConditionnement: lot.operation.date,
      dluo: lot.dluo,
      bouteille: lireBouteille(this.secret(), jeton, lot.nombreUnites, b),
      nombreUnites: lot.nombreUnites,
      origine: {
        pays: PAYS_ORIGINE,
        huileries: passeport.afficherHuileries ? ascendance.huileries : [],
        varietes: ascendance.varietes,
        campagnes: ascendance.campagnes,
        assemblage: ascendance.assemblage,
      },
      analyse:
        analyse && passeport.afficherAnalyses
          ? {
              date: analyse.dateAnalyse,
              laboratoire: analyse.laboratoire,
              categorie: analyse.categorie ? LIBELLES_CATEGORIE[analyse.categorie] : null,
              valeurs: (Object.keys(PARAMETRES) as ParametreAnalyse[])
                .filter((p) => analyse[PARAMETRES[p].champ] != null)
                .map((p) => ({
                  parametre: p,
                  libelle: PARAMETRES[p].libelle,
                  unite: PARAMETRES[p].unite,
                  valeur: Number(analyse[PARAMETRES[p].champ]),
                  min: limites.get(p)?.min ?? null,
                  max: limites.get(p)?.max ?? null,
                })),
            }
          : null,
      procede: passeport.afficherProcede
        ? {
            filtrations: ascendance.filtrations,
            conditionnement: { date: lot.operation.date, format: lot.format.nom, materiau: lot.format.materiau },
          }
        : null,
      destination:
        passeport.afficherDestination && (lot.paysDestination || lot.destination)
          ? { pays: nomPays(lot.paysDestination), codePays: lot.paysDestination, marche: lot.destination }
          : null,
      certifications,
    };
  }

  /** Remonte les lots vrac (filtrations, assemblages) jusqu'aux réceptions : huileries, variétés, campagnes, filtrations. */
  private async ascendance(lotId: number) {
    const huileries = new Map<string, { nom: string; region: string | null }>();
    const varietes = new Set<string>();
    const campagnes = new Set<string>();
    const filtrations: { date: Date; typeFiltre: string | null; porositeMicrons: number | null }[] = [];
    let assemblage = false;
    const vus = new Set<number>();
    let courants = [lotId];
    while (courants.length) {
      const lots = await this.prisma.lot.findMany({
        where: { id: { in: courants } },
        select: {
          id: true,
          origine: true,
          campagne: true,
          huilerie: { select: { nom: true, region: true } },
          variete: { select: { nom: true } },
          origines: { select: { parentId: true } },
          filtration: { select: { typeFiltre: true, porositeMicrons: true, operation: { select: { date: true } } } },
        },
      });
      const suivants: number[] = [];
      for (const l of lots) {
        vus.add(l.id);
        if (l.origine === 'ASSEMBLAGE') assemblage = true;
        if (l.huilerie) huileries.set(l.huilerie.nom, l.huilerie);
        if (l.variete) varietes.add(l.variete.nom);
        if (l.campagne) campagnes.add(l.campagne);
        if (l.filtration) {
          filtrations.push({
            date: l.filtration.operation.date,
            typeFiltre: l.filtration.typeFiltre,
            porositeMicrons: l.filtration.porositeMicrons == null ? null : Number(l.filtration.porositeMicrons),
          });
        }
        for (const o of l.origines) if (!vus.has(o.parentId)) suivants.push(o.parentId);
      }
      courants = [...new Set(suivants)];
    }
    return {
      huileries: [...huileries.values()].sort((x, y) => x.nom.localeCompare(y.nom)),
      varietes: [...varietes].sort(),
      campagnes: [...campagnes].sort(),
      assemblage,
      filtrations: filtrations.sort((x, y) => x.date.getTime() - y.date.getTime()),
    };
  }
}

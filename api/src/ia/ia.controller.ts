import { Controller, Get, ParseIntPipe, Query } from '@nestjs/common';
import { IaService } from './ia.service.js';

// Lecture seule, tout utilisateur connecté : ce sont des aides à la décision calculées sur les données de la plateforme.

@Controller('ia')
export class IaController {
  constructor(private readonly ia: IaService) {}

  /** Qualité attendue d'un lot à sa réception, d'après l'historique de l'huilerie (et de la variété). */
  @Get('prevision')
  prevision(
    @Query('huilerieId', ParseIntPipe) huilerieId: number,
    @Query('varieteId', new ParseIntPipe({ optional: true })) varieteId?: number,
  ) {
    return this.ia.prevision(huilerieId, varieteId);
  }

  /** Huileries classées par risque de livrer une huile non extra vierge. */
  @Get('huileries')
  huileries() {
    return this.ia.huileries();
  }

  /** Évolution de la qualité des lots en stock et dépassements prévus. */
  @Get('evolution')
  evolution() {
    return this.ia.evolution();
  }

  /** Lots et formats recommandés pour une commande d'un client. */
  @Get('recommandations')
  recommandations(@Query('clientId', ParseIntPipe) clientId: number) {
    return this.ia.recommandations(clientId);
  }

  /** Anomalies des `jours` derniers jours (90 par défaut). */
  @Get('anomalies')
  anomalies(@Query('jours', new ParseIntPipe({ optional: true })) jours?: number) {
    return this.ia.anomalies(Math.min(Math.max(jours ?? 90, 1), 3650));
  }
}

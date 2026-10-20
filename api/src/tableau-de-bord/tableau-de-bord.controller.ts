import { Controller, Get, Query } from '@nestjs/common';
import { Roles } from '../auth/decorators.js';
import { Role } from '../generated/prisma/enums.js';
import { RapportsQueryDto } from './tableau-de-bord.dto.js';
import { TableauDeBordService } from './tableau-de-bord.service.js';

// Tableau de bord : tout utilisateur connecté (ce sont les mêmes informations que les écrans stock, qualité et export).
// Rapports (volumes, ventes, exports par pays et par client) : ADMIN et DIRECTION.

@Controller()
export class TableauDeBordController {
  constructor(private readonly tableau: TableauDeBordService) {}

  @Get('tableau-de-bord')
  etat() {
    return this.tableau.etat();
  }

  @Get('rapports')
  @Roles(Role.DIRECTION)
  rapports(@Query() query: RapportsQueryDto) {
    return this.tableau.rapports(query.du, query.au);
  }
}

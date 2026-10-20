import { Body, Controller, Get, Param, ParseBoolPipe, ParseIntPipe, Post, Query } from '@nestjs/common';
import { type AuthUser, CurrentUser, Roles } from '../auth/decorators.js';
import { Role } from '../generated/prisma/enums.js';
import { ConditionnementDto, FiltrationDto, MouvementProduitDto } from './conditionnement.dto.js';
import { ConditionnementsService } from './conditionnements.service.js';
import { FiltrationsService } from './filtrations.service.js';

// Lecture : tout utilisateur connecté. Filtration et mise en bouteille : ADMIN, DIRECTION, PRODUCTION.
// Mouvements de produits finis : ADMIN, DIRECTION, PRODUCTION, STOCK, EXPORT.

@Controller('filtrations')
export class FiltrationsController {
  constructor(private readonly filtrations: FiltrationsService) {}

  @Get()
  findAll(@Query('lotId', new ParseIntPipe({ optional: true })) lotId?: number) {
    return this.filtrations.findAll(lotId);
  }

  @Post()
  @Roles(Role.DIRECTION, Role.PRODUCTION)
  creer(@Body() dto: FiltrationDto, @CurrentUser() user: AuthUser) {
    return this.filtrations.creer(dto, user.id);
  }
}

@Controller('conditionnements')
export class ConditionnementsController {
  constructor(private readonly conditionnements: ConditionnementsService) {}

  @Get()
  findAll(
    @Query('lotVracId', new ParseIntPipe({ optional: true })) lotVracId?: number,
    @Query('enStock', new ParseBoolPipe({ optional: true })) enStock?: boolean,
  ) {
    return this.conditionnements.findAll({ lotVracId, enStock });
  }

  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.conditionnements.findOne(id);
  }

  @Post()
  @Roles(Role.DIRECTION, Role.PRODUCTION)
  creer(@Body() dto: ConditionnementDto, @CurrentUser() user: AuthUser) {
    return this.conditionnements.creer(dto, user.id);
  }
}

@Controller('produits-finis')
export class ProduitsFinisController {
  constructor(private readonly conditionnements: ConditionnementsService) {}

  /** Stock de produits finis : lots conditionnés en stock et totaux par format. */
  @Get()
  stock() {
    return this.conditionnements.stockProduitsFinis();
  }

  @Get('mouvements')
  mouvements(@Query('lotConditionneId', new ParseIntPipe({ optional: true })) lotConditionneId?: number) {
    return this.conditionnements.mouvements({ lotConditionneId });
  }

  @Post('mouvements')
  @Roles(Role.DIRECTION, Role.PRODUCTION, Role.STOCK, Role.EXPORT)
  mouvement(@Body() dto: MouvementProduitDto, @CurrentUser() user: AuthUser) {
    return this.conditionnements.mouvement(dto, user.id);
  }
}

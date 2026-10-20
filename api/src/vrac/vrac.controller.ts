import { Body, Controller, Get, Param, ParseBoolPipe, ParseEnumPipe, ParseIntPipe, Patch, Post, Query } from '@nestjs/common';
import { type AuthUser, CurrentUser, Roles } from '../auth/decorators.js';
import { Role, StatutLivraison, TypeOperation } from '../generated/prisma/enums.js';
import { LivraisonsService } from './livraisons.service.js';
import { LotsService } from './lots.service.js';
import { OperationsService } from './operations.service.js';
import { StockService } from './stock.service.js';
import { AnalyseDto, AssemblageDto, ReceptionDto, SortieDto, TransfertDto, UpdateLivraisonDto } from './vrac.dto.js';

// Lecture : tout utilisateur connecté. Mouvements de stock : ADMIN, DIRECTION, STOCK.

@Controller('stock')
export class StockController {
  constructor(private readonly stock: StockService) {}

  /** État des cuves et citernes : lot contenu, quantité, remplissage. */
  @Get()
  etat() {
    return this.stock.etatCuves();
  }

  @Get('alertes')
  alertes() {
    return this.stock.alertes();
  }
}

@Controller('lots')
export class LotsController {
  constructor(private readonly lots: LotsService) {}

  @Get()
  findAll(@Query('enStock', new ParseBoolPipe({ optional: true })) enStock?: boolean) {
    return this.lots.findAll(enStock);
  }

  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.lots.findOne(id);
  }

  @Post('reception')
  @Roles(Role.DIRECTION, Role.STOCK)
  reception(@Body() dto: ReceptionDto, @CurrentUser() user: AuthUser) {
    return this.lots.reception(dto, user.id);
  }

  @Post(':id/analyses')
  @Roles(Role.DIRECTION, Role.STOCK, Role.QUALITE)
  ajouterAnalyse(@Param('id', ParseIntPipe) id: number, @Body() dto: AnalyseDto, @CurrentUser() user: AuthUser) {
    return this.lots.ajouterAnalyse(id, dto, user.id);
  }
}

@Controller('operations')
export class OperationsController {
  constructor(private readonly operations: OperationsService) {}

  @Get()
  findAll(
    @Query('type', new ParseEnumPipe(TypeOperation, { optional: true })) type?: TypeOperation,
    @Query('lotId', new ParseIntPipe({ optional: true })) lotId?: number,
    @Query('stockageId', new ParseIntPipe({ optional: true })) stockageId?: number,
    @Query('limit', new ParseIntPipe({ optional: true })) limit?: number,
  ) {
    return this.operations.findAll({ type, lotId, stockageId, limit });
  }

  @Post('transfert')
  @Roles(Role.DIRECTION, Role.STOCK)
  transfert(@Body() dto: TransfertDto, @CurrentUser() user: AuthUser) {
    return this.operations.transfert(dto, user.id);
  }

  /** Vérifie un assemblage sans l'enregistrer (acidité estimée, avertissements). */
  @Post('assemblage/simulation')
  @Roles(Role.DIRECTION, Role.STOCK, Role.QUALITE)
  async simulerAssemblage(@Body() dto: AssemblageDto) {
    const { lots: _lots, parLot: _parLot, ...controle } = await this.operations.simulerAssemblage(dto);
    return controle;
  }

  @Post('assemblage')
  @Roles(Role.DIRECTION, Role.STOCK)
  assemblage(@Body() dto: AssemblageDto, @CurrentUser() user: AuthUser) {
    return this.operations.assemblage(dto, user.id);
  }

  @Post('sortie')
  @Roles(Role.DIRECTION, Role.STOCK)
  sortie(@Body() dto: SortieDto, @CurrentUser() user: AuthUser) {
    return this.operations.sortie(dto, user.id);
  }
}

@Controller('livraisons')
export class LivraisonsController {
  constructor(private readonly livraisons: LivraisonsService) {}

  @Get()
  findAll(@Query('statut', new ParseEnumPipe(StatutLivraison, { optional: true })) statut?: StatutLivraison) {
    return this.livraisons.findAll(statut);
  }

  @Patch(':id')
  @Roles(Role.DIRECTION, Role.STOCK, Role.EXPORT)
  update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateLivraisonDto, @CurrentUser() user: AuthUser) {
    return this.livraisons.update(id, dto, user.id);
  }
}

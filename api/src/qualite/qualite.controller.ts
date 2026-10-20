import { Body, Controller, Get, Param, ParseBoolPipe, ParseEnumPipe, ParseIntPipe, Patch, Post, Query } from '@nestjs/common';
import { type AuthUser, CurrentUser, Roles } from '../auth/decorators.js';
import { Role, StatutNonConformite } from '../generated/prisma/enums.js';
import { CreateNonConformiteDto, CreateSpecificationDto, UpdateNonConformiteDto, UpdateSpecificationDto } from './qualite.dto.js';
import { QualiteService } from './qualite.service.js';

// Lecture : tout utilisateur connecté. Critères et non-conformités : ADMIN, DIRECTION, QUALITE.

@Controller('qualite')
export class QualiteController {
  constructor(private readonly qualite: QualiteService) {}

  /** Alertes qualité des lots en stock et compteurs. */
  @Get('alertes')
  alertes() {
    return this.qualite.alertes();
  }

  /** Contrôle d'un lot avant une vente (avec le cahier des charges du client) ou un envoi au conditionnement. */
  @Get('controle-expedition')
  controleExpedition(
    @Query('lotId', ParseIntPipe) lotId: number,
    @Query('clientId', new ParseIntPipe({ optional: true })) clientId?: number,
  ) {
    return this.qualite.controleExpedition(lotId, clientId);
  }

  @Get('specifications')
  specifications() {
    return this.qualite.listeSpecifications();
  }

  @Post('specifications')
  @Roles(Role.DIRECTION, Role.QUALITE)
  creerSpecification(@Body() dto: CreateSpecificationDto, @CurrentUser() user: AuthUser) {
    return this.qualite.creerSpecification(dto, user.id);
  }

  @Patch('specifications/:id')
  @Roles(Role.DIRECTION, Role.QUALITE)
  majSpecification(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateSpecificationDto, @CurrentUser() user: AuthUser) {
    return this.qualite.majSpecification(id, dto, user.id);
  }

  @Get('non-conformites')
  nonConformites(
    @Query('statut', new ParseEnumPipe(StatutNonConformite, { optional: true })) statut?: StatutNonConformite,
    @Query('ouvertes', new ParseBoolPipe({ optional: true })) ouvertes?: boolean,
    @Query('lotId', new ParseIntPipe({ optional: true })) lotId?: number,
  ) {
    return this.qualite.listeNonConformites({ statut, ouvertes, lotId });
  }

  @Post('non-conformites')
  @Roles(Role.DIRECTION, Role.QUALITE)
  creerNonConformite(@Body() dto: CreateNonConformiteDto, @CurrentUser() user: AuthUser) {
    return this.qualite.creerNonConformite(dto, user.id);
  }

  @Patch('non-conformites/:id')
  @Roles(Role.DIRECTION, Role.QUALITE)
  majNonConformite(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateNonConformiteDto, @CurrentUser() user: AuthUser) {
    return this.qualite.majNonConformite(id, dto, user.id);
  }
}

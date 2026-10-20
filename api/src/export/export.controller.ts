import { Body, Controller, Get, Param, ParseEnumPipe, ParseIntPipe, Patch, Post, Query, StreamableFile } from '@nestjs/common';
import { type AuthUser, CurrentUser, Roles } from '../auth/decorators.js';
import { Role, StatutExpedition } from '../generated/prisma/enums.js';
import { CreateExpeditionDto, StatutExpeditionDto, UpdateExpeditionDto } from './export.dto.js';
import { ExpeditionsService } from './expeditions.service.js';
import { DOCUMENTS, type TypeDocument } from './regles.js';

// Lecture et documents PDF : tout utilisateur connecté. Création, modification et statut : ADMIN, DIRECTION, EXPORT.

@Controller('expeditions')
export class ExpeditionsController {
  constructor(private readonly expeditions: ExpeditionsService) {}

  @Get()
  findAll(@Query('statut', new ParseEnumPipe(StatutExpedition, { optional: true })) statut?: StatutExpedition) {
    return this.expeditions.findAll(statut);
  }

  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.expeditions.findOne(id);
  }

  @Post()
  @Roles(Role.DIRECTION, Role.EXPORT)
  creer(@Body() dto: CreateExpeditionDto, @CurrentUser() user: AuthUser) {
    return this.expeditions.creer(dto, user.id);
  }

  @Patch(':id')
  @Roles(Role.DIRECTION, Role.EXPORT)
  modifier(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateExpeditionDto, @CurrentUser() user: AuthUser) {
    return this.expeditions.modifier(id, dto, user.id);
  }

  /** Départ (le stock sort), livraison ou annulation. */
  @Post(':id/statut')
  @Roles(Role.DIRECTION, Role.EXPORT)
  statut(@Param('id', ParseIntPipe) id: number, @Body() dto: StatutExpeditionDto, @CurrentUser() user: AuthUser) {
    return this.expeditions.changerStatut(id, dto, user.id);
  }

  /** PDF : colisage, origine, analyses, conformite, fiches, ou dossier (tous les documents à la suite). */
  @Get(':id/documents/:type')
  async document(
    @Param('id', ParseIntPipe) id: number,
    @Param('type', new ParseEnumPipe([...Object.keys(DOCUMENTS), 'dossier'])) type: TypeDocument | 'dossier',
    @CurrentUser() user: AuthUser,
  ) {
    const { pdf, nomFichier } = await this.expeditions.document(id, type, user.id);
    return new StreamableFile(pdf, { type: 'application/pdf', disposition: `attachment; filename="${nomFichier}"` });
  }
}

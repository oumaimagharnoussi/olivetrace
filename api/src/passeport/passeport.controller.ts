import { Body, Controller, Get, Param, ParseIntPipe, Patch, Post, Query, Res, StreamableFile } from '@nestjs/common';
import type { Response } from 'express';
import { type AuthUser, CurrentUser, Public, Roles } from '../auth/decorators.js';
import { Role } from '../generated/prisma/enums.js';
import { PasseportDto } from './passeport.dto.js';
import { PasseportService } from './passeport.service.js';

// Lecture et QR codes : tout utilisateur connecté. Réglages du passeport : ADMIN, DIRECTION, QUALITE, EXPORT.

@Controller('conditionnements/:id/passeport')
export class PasseportController {
  constructor(private readonly passeports: PasseportService) {}

  @Get()
  fiche(@Param('id', ParseIntPipe) id: number) {
    return this.passeports.fiche(id);
  }

  @Patch()
  @Roles(Role.DIRECTION, Role.QUALITE, Role.EXPORT)
  modifier(@Param('id', ParseIntPipe) id: number, @Body() dto: PasseportDto, @CurrentUser() user: AuthUser) {
    return this.passeports.modifier(id, dto, user.id);
  }

  @Post('renouveler')
  @Roles(Role.DIRECTION, Role.QUALITE, Role.EXPORT)
  renouveler(@Param('id', ParseIntPipe) id: number, @CurrentUser() user: AuthUser) {
    return this.passeports.renouvelerJeton(id, user.id);
  }

  /** QR code du lot (ou d'une bouteille avec ?unite=12), en SVG. */
  @Get('qr.svg')
  async qrSvg(
    @Param('id', ParseIntPipe) id: number,
    @Query('unite', new ParseIntPipe({ optional: true })) unite: number | undefined,
    @Res({ passthrough: true }) res: Response,
  ) {
    const { code, svg } = await this.passeports.qrSvg(id, unite);
    res.set({ 'Content-Type': 'image/svg+xml', 'Content-Disposition': `attachment; filename="qr-${code}${unite ? `-${unite}` : ''}.svg"` });
    return svg;
  }

  /** QR code du lot (ou d'une bouteille avec ?unite=12), en PNG 1024 px pour l'imprimeur. */
  @Get('qr.png')
  async qrPng(
    @Param('id', ParseIntPipe) id: number,
    @Query('unite', new ParseIntPipe({ optional: true })) unite: number | undefined,
  ) {
    const { code, png } = await this.passeports.qrPng(id, unite);
    return new StreamableFile(png, { type: 'image/png', disposition: `attachment; filename="qr-${code}${unite ? `-${unite}` : ''}.png"` });
  }

  /** QR codes des bouteilles ?de=1&a=100 (500 au plus), pour une planche d'étiquettes. */
  @Get('etiquettes')
  etiquettes(
    @Param('id', ParseIntPipe) id: number,
    @Query('de', new ParseIntPipe({ optional: true })) de?: number,
    @Query('a', new ParseIntPipe({ optional: true })) a?: number,
  ) {
    return this.passeports.etiquettes(id, de, a);
  }
}

/** Page publique du passeport : sans connexion, ce que voit l'importateur ou le consommateur qui scanne le QR code. */
@Controller('public/passeports')
export class PasseportPublicController {
  constructor(private readonly passeports: PasseportService) {}

  @Public()
  @Get(':jeton')
  consulter(@Param('jeton') jeton: string, @Query('b') b?: string) {
    return this.passeports.public(jeton, b);
  }
}

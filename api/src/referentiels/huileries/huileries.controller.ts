import { Body, Controller, Delete, Get, Param, ParseBoolPipe, ParseIntPipe, Patch, Post, Query } from '@nestjs/common';
import { type AuthUser, CurrentUser, Roles } from '../../auth/decorators.js';
import { Role } from '../../generated/prisma/enums.js';
import { CreateHuilerieDto, UpdateHuilerieDto } from './huileries.dto.js';
import { HuilerieService } from './huileries.service.js';

// Lecture : tout utilisateur connecté. Écriture : ADMIN, DIRECTION, STOCK.
@Controller('huileries')
export class HuilerieController {
  constructor(private readonly service: HuilerieService) {}

  @Get()
  findAll(@Query('inclureInactifs', new ParseBoolPipe({ optional: true })) inclureInactifs?: boolean) {
    return this.service.findAll(inclureInactifs);
  }

  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.service.findOne(id);
  }

  @Post()
  @Roles(Role.DIRECTION, Role.STOCK)
  create(@Body() dto: CreateHuilerieDto, @CurrentUser() user: AuthUser) {
    return this.service.create(dto, user.id);
  }

  @Patch(':id')
  @Roles(Role.DIRECTION, Role.STOCK)
  update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateHuilerieDto, @CurrentUser() user: AuthUser) {
    return this.service.update(id, dto, user.id);
  }

  @Delete(':id')
  @Roles(Role.DIRECTION, Role.STOCK)
  deactivate(@Param('id', ParseIntPipe) id: number, @CurrentUser() user: AuthUser) {
    return this.service.deactivate(id, user.id);
  }
}

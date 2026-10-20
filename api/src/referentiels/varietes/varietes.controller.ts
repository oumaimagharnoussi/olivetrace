import { Body, Controller, Delete, Get, Param, ParseBoolPipe, ParseIntPipe, Patch, Post, Query } from '@nestjs/common';
import { type AuthUser, CurrentUser, Roles } from '../../auth/decorators.js';
import { Role } from '../../generated/prisma/enums.js';
import { CreateVarieteDto, UpdateVarieteDto } from './varietes.dto.js';
import { VarieteService } from './varietes.service.js';

// Lecture : tout utilisateur connecté. Écriture : ADMIN, DIRECTION, QUALITE.
@Controller('varietes')
export class VarieteController {
  constructor(private readonly service: VarieteService) {}

  @Get()
  findAll(@Query('inclureInactifs', new ParseBoolPipe({ optional: true })) inclureInactifs?: boolean) {
    return this.service.findAll(inclureInactifs);
  }

  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.service.findOne(id);
  }

  @Post()
  @Roles(Role.DIRECTION, Role.QUALITE)
  create(@Body() dto: CreateVarieteDto, @CurrentUser() user: AuthUser) {
    return this.service.create(dto, user.id);
  }

  @Patch(':id')
  @Roles(Role.DIRECTION, Role.QUALITE)
  update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateVarieteDto, @CurrentUser() user: AuthUser) {
    return this.service.update(id, dto, user.id);
  }

  @Delete(':id')
  @Roles(Role.DIRECTION, Role.QUALITE)
  deactivate(@Param('id', ParseIntPipe) id: number, @CurrentUser() user: AuthUser) {
    return this.service.deactivate(id, user.id);
  }
}

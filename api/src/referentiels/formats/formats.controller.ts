import { Body, Controller, Delete, Get, Param, ParseBoolPipe, ParseIntPipe, Patch, Post, Query } from '@nestjs/common';
import { type AuthUser, CurrentUser, Roles } from '../../auth/decorators.js';
import { Role } from '../../generated/prisma/enums.js';
import { CreateFormatDto, UpdateFormatDto } from './formats.dto.js';
import { FormatService } from './formats.service.js';

// Lecture : tout utilisateur connecté. Écriture : ADMIN, DIRECTION, PRODUCTION.
@Controller('formats')
export class FormatController {
  constructor(private readonly service: FormatService) {}

  @Get()
  findAll(@Query('inclureInactifs', new ParseBoolPipe({ optional: true })) inclureInactifs?: boolean) {
    return this.service.findAll(inclureInactifs);
  }

  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.service.findOne(id);
  }

  @Post()
  @Roles(Role.DIRECTION, Role.PRODUCTION)
  create(@Body() dto: CreateFormatDto, @CurrentUser() user: AuthUser) {
    return this.service.create(dto, user.id);
  }

  @Patch(':id')
  @Roles(Role.DIRECTION, Role.PRODUCTION)
  update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateFormatDto, @CurrentUser() user: AuthUser) {
    return this.service.update(id, dto, user.id);
  }

  @Delete(':id')
  @Roles(Role.DIRECTION, Role.PRODUCTION)
  deactivate(@Param('id', ParseIntPipe) id: number, @CurrentUser() user: AuthUser) {
    return this.service.deactivate(id, user.id);
  }
}

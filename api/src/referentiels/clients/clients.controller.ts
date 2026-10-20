import { Body, Controller, Delete, Get, Param, ParseBoolPipe, ParseIntPipe, Patch, Post, Query } from '@nestjs/common';
import { type AuthUser, CurrentUser, Roles } from '../../auth/decorators.js';
import { Role } from '../../generated/prisma/enums.js';
import { CreateClientDto, UpdateClientDto } from './clients.dto.js';
import { ClientService } from './clients.service.js';

// Lecture : tout utilisateur connecté. Écriture : ADMIN, DIRECTION, EXPORT.
@Controller('clients')
export class ClientController {
  constructor(private readonly service: ClientService) {}

  @Get()
  findAll(@Query('inclureInactifs', new ParseBoolPipe({ optional: true })) inclureInactifs?: boolean) {
    return this.service.findAll(inclureInactifs);
  }

  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.service.findOne(id);
  }

  @Post()
  @Roles(Role.DIRECTION, Role.EXPORT)
  create(@Body() dto: CreateClientDto, @CurrentUser() user: AuthUser) {
    return this.service.create(dto, user.id);
  }

  @Patch(':id')
  @Roles(Role.DIRECTION, Role.EXPORT)
  update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateClientDto, @CurrentUser() user: AuthUser) {
    return this.service.update(id, dto, user.id);
  }

  @Delete(':id')
  @Roles(Role.DIRECTION, Role.EXPORT)
  deactivate(@Param('id', ParseIntPipe) id: number, @CurrentUser() user: AuthUser) {
    return this.service.deactivate(id, user.id);
  }
}

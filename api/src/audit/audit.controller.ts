import { Controller, Get, ParseIntPipe, Query } from '@nestjs/common';
import { Role } from '../generated/prisma/enums.js';
import { Roles } from '../auth/decorators.js';
import { AuditService } from './audit.service.js';

@Controller('audit')
@Roles(Role.ADMIN, Role.DIRECTION)
export class AuditController {
  constructor(private readonly audit: AuditService) {}

  @Get()
  list(@Query('limit', new ParseIntPipe({ optional: true })) limit?: number) {
    return this.audit.list(limit);
  }
}

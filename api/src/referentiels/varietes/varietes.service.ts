import { Injectable } from '@nestjs/common';
import { AuditService } from '../../audit/audit.service.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import { ReferentielService } from '../referentiel.service.js';
import { CreateVarieteDto, UpdateVarieteDto } from './varietes.dto.js';

@Injectable()
export class VarieteService extends ReferentielService<CreateVarieteDto, UpdateVarieteDto> {
  constructor(prisma: PrismaService, audit: AuditService) {
    super(prisma.variete, audit, 'Variete');
  }
}

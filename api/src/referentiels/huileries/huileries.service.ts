import { Injectable } from '@nestjs/common';
import { AuditService } from '../../audit/audit.service.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import { ReferentielService } from '../referentiel.service.js';
import { CreateHuilerieDto, UpdateHuilerieDto } from './huileries.dto.js';

@Injectable()
export class HuilerieService extends ReferentielService<CreateHuilerieDto, UpdateHuilerieDto> {
  constructor(prisma: PrismaService, audit: AuditService) {
    super(prisma.huilerie, audit, 'Huilerie');
  }
}

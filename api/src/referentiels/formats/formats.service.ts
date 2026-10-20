import { Injectable } from '@nestjs/common';
import { AuditService } from '../../audit/audit.service.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import { ReferentielService } from '../referentiel.service.js';
import { CreateFormatDto, UpdateFormatDto } from './formats.dto.js';

@Injectable()
export class FormatService extends ReferentielService<CreateFormatDto, UpdateFormatDto> {
  constructor(prisma: PrismaService, audit: AuditService) {
    super(prisma.formatConditionnement, audit, 'FormatConditionnement');
  }
}

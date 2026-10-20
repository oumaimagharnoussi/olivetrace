import { Injectable } from '@nestjs/common';
import { AuditService } from '../../audit/audit.service.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import { ReferentielService } from '../referentiel.service.js';
import { CreateStockageDto, UpdateStockageDto } from './stockages.dto.js';

@Injectable()
export class StockageService extends ReferentielService<CreateStockageDto, UpdateStockageDto> {
  constructor(prisma: PrismaService, audit: AuditService) {
    super(prisma.stockage, audit, 'Stockage');
  }
}

import { Injectable } from '@nestjs/common';
import { AuditService } from '../../audit/audit.service.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import { ReferentielService } from '../referentiel.service.js';
import { CreateClientDto, UpdateClientDto } from './clients.dto.js';

@Injectable()
export class ClientService extends ReferentielService<CreateClientDto, UpdateClientDto> {
  constructor(prisma: PrismaService, audit: AuditService) {
    super(prisma.client, audit, 'Client');
  }
}

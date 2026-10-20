import { BadRequestException, Controller, Get, Param, Post } from '@nestjs/common';
import { Roles } from '../auth/decorators.js';
import { Role } from '../generated/prisma/enums.js';
import { BlockchainService } from './blockchain.service.js';

// Comme le journal d'audit : ADMIN et DIRECTION.

@Controller('blockchain')
@Roles(Role.DIRECTION)
export class BlockchainController {
  constructor(private readonly blockchain: BlockchainService) {}

  @Get()
  etat() {
    return this.blockchain.etat();
  }

  /** Scelle tout de suite les nouveaux événements et envoie les ancrages en attente. */
  @Post('ancrer')
  ancrer() {
    return this.blockchain.ancrer();
  }

  @Get('verification')
  verifier() {
    return this.blockchain.verifier();
  }

  @Get('preuves/:auditId')
  preuve(@Param('auditId') auditId: string) {
    if (!/^\d{1,19}$/.test(auditId)) throw new BadRequestException("Numéro d'événement invalide");
    return this.blockchain.preuve(BigInt(auditId));
  }
}

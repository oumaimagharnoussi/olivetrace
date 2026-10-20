import { Module } from '@nestjs/common';
import { BlockchainController } from './blockchain.controller.js';
import { BlockchainService } from './blockchain.service.js';

/** Blockchain (option) : scellement du journal d'audit et ancrage de son empreinte sur Polygon. */
@Module({
  controllers: [BlockchainController],
  providers: [BlockchainService],
  exports: [BlockchainService],
})
export class BlockchainModule {}

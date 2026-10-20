import { Module } from '@nestjs/common';
import { BlockchainModule } from '../blockchain/blockchain.module.js';
import { QualiteModule } from '../qualite/qualite.module.js';
import { PasseportController, PasseportPublicController } from './passeport.controller.js';
import { PasseportService } from './passeport.service.js';

/** Passeport produit : QR codes des lots conditionnés et des bouteilles, page publique. */
@Module({
  imports: [QualiteModule, BlockchainModule],
  controllers: [PasseportController, PasseportPublicController],
  providers: [PasseportService],
  exports: [PasseportService],
})
export class PasseportModule {}

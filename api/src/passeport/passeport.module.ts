import { Module } from '@nestjs/common';
import { QualiteModule } from '../qualite/qualite.module.js';
import { PasseportController, PasseportPublicController } from './passeport.controller.js';
import { PasseportService } from './passeport.service.js';

/** Passeport produit : QR codes des lots conditionnés et des bouteilles, page publique. */
@Module({
  imports: [QualiteModule],
  controllers: [PasseportController, PasseportPublicController],
  providers: [PasseportService],
})
export class PasseportModule {}

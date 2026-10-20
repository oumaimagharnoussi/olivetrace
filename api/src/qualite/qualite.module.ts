import { Module } from '@nestjs/common';
import { QualiteController } from './qualite.controller.js';
import { QualiteService } from './qualite.service.js';

/** Contrôle qualité : critères, résultat des analyses, non-conformités, contrôle avant expédition. */
@Module({
  controllers: [QualiteController],
  providers: [QualiteService],
  exports: [QualiteService],
})
export class QualiteModule {}

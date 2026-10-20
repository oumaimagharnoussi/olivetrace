import { Module } from '@nestjs/common';
import { PasseportModule } from '../passeport/passeport.module.js';
import { QualiteModule } from '../qualite/qualite.module.js';
import { ExpeditionsController } from './export.controller.js';
import { ExpeditionsService } from './expeditions.service.js';
import { PdfService } from './pdf.service.js';

/** Export : expéditions de produits finis et dossier export en PDF (Puppeteer). */
@Module({
  imports: [QualiteModule, PasseportModule],
  controllers: [ExpeditionsController],
  providers: [ExpeditionsService, PdfService],
})
export class ExportModule {}

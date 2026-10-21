import { Module } from '@nestjs/common';
import { PdfModule } from '../pdf/pdf.module.js';
import { PasseportModule } from '../passeport/passeport.module.js';
import { QualiteModule } from '../qualite/qualite.module.js';
import { ExpeditionsController } from './export.controller.js';
import { ExpeditionsService } from './expeditions.service.js';

/** Export : expéditions de produits finis et dossier export en PDF (Puppeteer). */
@Module({
  imports: [QualiteModule, PasseportModule, PdfModule],
  controllers: [ExpeditionsController],
  providers: [ExpeditionsService],
})
export class ExportModule {}

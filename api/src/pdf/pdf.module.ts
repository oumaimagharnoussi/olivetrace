import { Module } from '@nestjs/common';
import { PdfService } from './pdf.service.js';

/** Génération des PDF (dossier export, bon de réception, déclaration de conformité du passeport). */
@Module({
  providers: [PdfService],
  exports: [PdfService],
})
export class PdfModule {}

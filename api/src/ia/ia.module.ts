import { Module } from '@nestjs/common';
import { QualiteModule } from '../qualite/qualite.module.js';
import { VracModule } from '../vrac/vrac.module.js';
import { IaController } from './ia.controller.js';
import { IaService } from './ia.service.js';

/** Intelligence artificielle : prévision de la qualité, évolution en stock, recommandations, anomalies. */
@Module({
  imports: [QualiteModule, VracModule],
  controllers: [IaController],
  providers: [IaService],
})
export class IaModule {}

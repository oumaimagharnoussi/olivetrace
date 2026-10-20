import { Module } from '@nestjs/common';
import { ConditionnementModule } from '../conditionnement/conditionnement.module.js';
import { QualiteModule } from '../qualite/qualite.module.js';
import { VracModule } from '../vrac/vrac.module.js';
import { TableauDeBordController } from './tableau-de-bord.controller.js';
import { TableauDeBordService } from './tableau-de-bord.service.js';

/** Tableau de bord de la direction et rapports. */
@Module({
  imports: [VracModule, QualiteModule, ConditionnementModule],
  controllers: [TableauDeBordController],
  providers: [TableauDeBordService],
})
export class TableauDeBordModule {}

import { Module } from '@nestjs/common';
import { QualiteModule } from '../qualite/qualite.module.js';
import { VracModule } from '../vrac/vrac.module.js';
import { ConditionnementsController, FiltrationsController, ProduitsFinisController } from './conditionnement.controller.js';
import { ConditionnementsService } from './conditionnements.service.js';
import { FiltrationsService } from './filtrations.service.js';

/** Flux 2 : filtration, mise en bouteille et stock de produits finis. */
@Module({
  imports: [QualiteModule, VracModule],
  controllers: [FiltrationsController, ConditionnementsController, ProduitsFinisController],
  providers: [FiltrationsService, ConditionnementsService],
})
export class ConditionnementModule {}

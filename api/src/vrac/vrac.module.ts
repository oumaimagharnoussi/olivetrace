import { Module } from '@nestjs/common';
import { QualiteModule } from '../qualite/qualite.module.js';
import { LivraisonsService } from './livraisons.service.js';
import { LotsService } from './lots.service.js';
import { OperationsService } from './operations.service.js';
import { StockService } from './stock.service.js';
import { LivraisonsController, LotsController, OperationsController, StockController } from './vrac.controller.js';

/** Flux 1 : stockage et vente en vrac. */
@Module({
  imports: [QualiteModule],
  controllers: [StockController, LotsController, OperationsController, LivraisonsController],
  providers: [StockService, LotsService, OperationsService, LivraisonsService],
})
export class VracModule {}

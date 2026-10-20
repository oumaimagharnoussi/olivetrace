import { Module } from '@nestjs/common';
import { HuilerieController } from './huileries/huileries.controller.js';
import { HuilerieService } from './huileries/huileries.service.js';
import { VarieteController } from './varietes/varietes.controller.js';
import { VarieteService } from './varietes/varietes.service.js';
import { StockageController } from './stockages/stockages.controller.js';
import { StockageService } from './stockages/stockages.service.js';
import { ClientController } from './clients/clients.controller.js';
import { ClientService } from './clients/clients.service.js';

@Module({
  controllers: [HuilerieController, VarieteController, StockageController, ClientController],
  providers: [HuilerieService, VarieteService, StockageService, ClientService],
})
export class ReferentielsModule {}

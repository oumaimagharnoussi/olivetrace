import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller.js';
import { AuditModule } from './audit/audit.module.js';
import { AuthModule } from './auth/auth.module.js';
import { BlockchainModule } from './blockchain/blockchain.module.js';
import { ConditionnementModule } from './conditionnement/conditionnement.module.js';
import { ExportModule } from './export/export.module.js';
import { IaModule } from './ia/ia.module.js';
import { MailModule } from './mail/mail.module.js';
import { PasseportModule } from './passeport/passeport.module.js';
import { QualiteModule } from './qualite/qualite.module.js';
import { TableauDeBordModule } from './tableau-de-bord/tableau-de-bord.module.js';
import { PrismaModule } from './prisma/prisma.module.js';
import { ReferentielsModule } from './referentiels/referentiels.module.js';
import { UsersModule } from './users/users.module.js';
import { VracModule } from './vrac/vrac.module.js';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    AuditModule,
    MailModule,
    AuthModule,
    UsersModule,
    ReferentielsModule,
    VracModule,
    QualiteModule,
    ConditionnementModule,
    PasseportModule,
    ExportModule,
    TableauDeBordModule,
    IaModule,
    BlockchainModule,
  ],
  controllers: [AppController],
})
export class AppModule {}

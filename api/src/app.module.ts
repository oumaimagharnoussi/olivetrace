import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller.js';
import { AuditModule } from './audit/audit.module.js';
import { AuthModule } from './auth/auth.module.js';
import { MailModule } from './mail/mail.module.js';
import { QualiteModule } from './qualite/qualite.module.js';
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
  ],
  controllers: [AppController],
})
export class AppModule {}

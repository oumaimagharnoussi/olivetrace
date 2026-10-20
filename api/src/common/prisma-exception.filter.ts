import { ArgumentsHost, Catch, ConflictException, ExceptionFilter, NotFoundException } from '@nestjs/common';
import { BaseExceptionFilter } from '@nestjs/core';
import { Prisma } from '../generated/prisma/client.js';

/** Traduit les erreurs Prisma courantes en réponses HTTP lisibles. */
@Catch(Prisma.PrismaClientKnownRequestError)
export class PrismaExceptionFilter extends BaseExceptionFilter implements ExceptionFilter {
  catch(error: Prisma.PrismaClientKnownRequestError, host: ArgumentsHost) {
    if (error.code === 'P2002') return super.catch(new ConflictException('Ce code ou cet email existe déjà'), host);
    if (error.code === 'P2025') return super.catch(new NotFoundException('Élément introuvable'), host);
    return super.catch(error, host);
  }
}

import { ArgumentsHost, Catch, ConflictException } from '@nestjs/common';
import { BaseExceptionFilter } from '@nestjs/core';
import { Prisma } from '@prisma/client';

// Unique-constraint races (concurrent registration, reused payment references, duplicate ratings) are client conflicts, not
// server faults. The driver error text is never returned because it names internal tables and columns.
@Catch(Prisma.PrismaClientKnownRequestError)
export class PrismaExceptionFilter extends BaseExceptionFilter {
  catch(exception: Prisma.PrismaClientKnownRequestError, host: ArgumentsHost) {
    if (exception.code === 'P2002')
      return super.catch(
        new ConflictException(
          'This record already exists or was changed by another request. Refresh and try again.',
        ),
        host,
      );
    return super.catch(exception, host);
  }
}

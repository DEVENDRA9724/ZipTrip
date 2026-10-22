import { ArgumentsHost } from '@nestjs/common';
import { BaseExceptionFilter } from '@nestjs/core';
import { Prisma } from '@prisma/client';
export declare class PrismaExceptionFilter extends BaseExceptionFilter {
    catch(exception: Prisma.PrismaClientKnownRequestError, host: ArgumentsHost): void;
}

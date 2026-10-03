import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { PrismaBetterSqlite3 } from '@prisma/adapter-better-sqlite3';
import { PrismaPg } from '@prisma/adapter-pg';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  constructor() {
    const url = process.env.DATABASE_URL || 'file:./portal.db';
    if (process.env.NODE_ENV === 'production' && !/^postgres(ql)?:\/\//.test(url)) throw new Error('Production requires a PostgreSQL DATABASE_URL');
    const adapter = /^postgres(ql)?:\/\//.test(url)
      ? new PrismaPg({ connectionString: url })
      : new PrismaBetterSqlite3({ url });
    super({ adapter });
  }

  async onModuleInit() {
    await this.$connect();
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }
}

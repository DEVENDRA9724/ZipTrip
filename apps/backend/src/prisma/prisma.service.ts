import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { PrismaBetterSqlite3 } from '@prisma/adapter-better-sqlite3';
import { PrismaPg } from '@prisma/adapter-pg';
import * as dotenv from 'dotenv';
import { resolve } from 'node:path';
import { existsSync } from 'node:fs';

const envPaths = [
  resolve(__dirname, '../../.env'),
  resolve(__dirname, '../.env'),
  resolve(process.cwd(), '.env'),
  resolve(process.cwd(), 'apps/backend/.env'),
];
for (const p of envPaths) {
  if (existsSync(p)) {
    dotenv.config({ path: p });
  }
}
dotenv.config();

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  constructor() {
    const url = process.env.DATABASE_URL || 'file:./portal.db';
    const isPostgres = /^postgres(ql)?:\/\//.test(url);
    const adapter = isPostgres
      ? new PrismaPg({ connectionString: url })
      : new PrismaBetterSqlite3({ url });
    super({ adapter });
  }

  async onModuleInit() {
    try {
      await this.$connect();
      console.log('[PrismaService] Database connected successfully.');
    } catch (err) {
      console.error('[PrismaService] Failed to connect to database:', err);
      throw err;
    }
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }
}


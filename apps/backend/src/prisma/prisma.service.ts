import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { PrismaBetterSqlite3 } from '@prisma/adapter-better-sqlite3';
import { PrismaPg } from '@prisma/adapter-pg';

const isPostgresUrl = (value: string | undefined) =>
  /^postgres(ql)?:\/\//.test(value || '');

// The connection comes only from the environment (main.ts loads apps/backend/.env without overriding variables that are
// already set, so tests and process managers keep control). A PostgreSQL POSTGRES_DATABASE_URL takes precedence over
// DATABASE_URL. Production never falls back to SQLite or to built-in credentials.
export function databaseUrl(
  env: Record<string, string | undefined> = process.env,
) {
  const url = isPostgresUrl(env.POSTGRES_DATABASE_URL)
    ? env.POSTGRES_DATABASE_URL!
    : env.DATABASE_URL || 'file:./portal.db';
  if (env.NODE_ENV === 'production' && !isPostgresUrl(url))
    throw new Error('Production requires a PostgreSQL DATABASE_URL');
  return url;
}

@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  constructor() {
    const url = databaseUrl();
    const adapter = isPostgresUrl(url)
      ? new PrismaPg({ connectionString: url })
      : new PrismaBetterSqlite3({ url });
    super({ adapter });
  }

  async onModuleInit() {
    try {
      await this.$connect();
    } catch (err) {
      console.error('[PrismaService] Failed to connect to the database.');
      throw err;
    }
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }
}

import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { PrismaBetterSqlite3 } from '@prisma/adapter-better-sqlite3';
import { PrismaPg } from '@prisma/adapter-pg';
import * as dotenv from 'dotenv';
import { resolve } from 'node:path';
import { existsSync, readFileSync } from 'node:fs';

const envPaths = [
  resolve(process.cwd(), '.env'),
  resolve(process.cwd(), 'apps/backend/.env'),
  resolve(__dirname, '../../.env'),
  resolve(__dirname, '../.env'),
  '/home/ubuntu/ZipTrip/apps/backend/.env',
  '/home/ubuntu/ZipTrip/.env',
];

for (const p of envPaths) {
  if (existsSync(p)) {
    dotenv.config({ path: p, override: true });
    try {
      const raw = readFileSync(p, 'utf8');
      for (const line of raw.split('\n')) {
        const m = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
        if (m) {
          let v = (m[2] || '').trim();
          if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
            v = v.slice(1, -1);
          }
          if (m[1] === 'DATABASE_URL' || m[1] === 'POSTGRES_DATABASE_URL') {
            if (/^postgres(ql)?:\/\//.test(v)) {
              process.env[m[1]] = v;
              process.env.DATABASE_URL = v;
            }
          } else if (!process.env[m[1]]) {
            process.env[m[1]] = v;
          }
        }
      }
    } catch {}
  }
}
dotenv.config({ override: true });

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  constructor() {
    let url = process.env.DATABASE_URL || process.env.POSTGRES_DATABASE_URL || '';

    // If POSTGRES_DATABASE_URL is a valid PostgreSQL URL, prefer it
    if (process.env.POSTGRES_DATABASE_URL && /^postgres(ql)?:\/\//.test(process.env.POSTGRES_DATABASE_URL)) {
      url = process.env.POSTGRES_DATABASE_URL;
      process.env.DATABASE_URL = url;
    }

    // If url is empty or sqlite, but we are running in production or on the server, fallback to default local postgres
    if (!url || !/^postgres(ql)?:\/\//.test(url)) {
      if (process.env.NODE_ENV === 'production' || existsSync('/home/ubuntu/ZipTrip')) {
        url = 'postgresql://root:rootpassword@127.0.0.1:5432/ziptrip?schema=public';
        process.env.DATABASE_URL = url;
      } else {
        url = url || 'file:./portal.db';
      }
    }

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

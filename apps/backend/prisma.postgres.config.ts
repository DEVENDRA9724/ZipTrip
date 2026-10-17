import 'dotenv/config';
import { defineConfig } from 'prisma/config';

const pgUrl = process.env.POSTGRES_DATABASE_URL ||
  (/^postgres(ql)?:\/\//.test(process.env.DATABASE_URL || '') ? process.env.DATABASE_URL : '') ||
  'postgresql://unconfigured:unconfigured@localhost:5432/safar';

export default defineConfig({
  schema: 'prisma/postgresql/schema.prisma',
  migrations: { path: 'prisma/postgresql/migrations' },
  datasource: { url: pgUrl },
});


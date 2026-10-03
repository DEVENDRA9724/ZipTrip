import 'dotenv/config';
import { defineConfig } from 'prisma/config';

export default defineConfig({
  schema: 'prisma/postgresql/schema.prisma',
  migrations: { path: 'prisma/postgresql/migrations' },
  datasource: { url: process.env.POSTGRES_DATABASE_URL || 'postgresql://unconfigured:unconfigured@localhost:5432/safar' },
});

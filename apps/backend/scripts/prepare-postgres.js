const { readFileSync, writeFileSync, mkdirSync } = require('node:fs');
const { resolve } = require('node:path');
require('dotenv').config({ path: resolve(__dirname, '../.env') });

const root = resolve(__dirname, '..');
const schemaPath = resolve(root, 'prisma/schema.prisma');
let schema = readFileSync(schemaPath, 'utf8');

const dbUrl = process.env.DATABASE_URL || '';
const isPostgres = /^postgres(ql)?:\/\//.test(dbUrl);

if (isPostgres) {
  schema = schema.replace(/provider\s*=\s*"sqlite"/, 'provider = "postgresql"');
  writeFileSync(schemaPath, schema);
}

const directory = resolve(root, 'prisma/postgresql');
mkdirSync(directory, { recursive: true });
const pgSchema = schema.replace(/provider\s*=\s*"sqlite"/, 'provider = "postgresql"');
writeFileSync(resolve(directory, 'schema.prisma'), pgSchema);

console.log('PostgreSQL schema prepared. Provider synchronized.');

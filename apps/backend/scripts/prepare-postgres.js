const { readFileSync, writeFileSync, mkdirSync } = require('node:fs');
const { resolve } = require('node:path');

const root = resolve(__dirname, '..');
const schemaPath = resolve(root, 'prisma/schema.prisma');
const schema = readFileSync(schemaPath, 'utf8');
if (!schema.includes('provider = "sqlite"')) throw new Error('Expected the existing SQLite source schema');
const pgSchema = schema.replace('provider = "sqlite"', 'provider = "postgresql"');

const directory = resolve(root, 'prisma/postgresql');
mkdirSync(directory, { recursive: true });
writeFileSync(resolve(directory, 'schema.prisma'), pgSchema);
console.log('PostgreSQL schema prepared. Existing database and environment were not changed.');

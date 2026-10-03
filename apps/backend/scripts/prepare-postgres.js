// Derive the target schema from the current model definitions without touching SQLite data.
const { readFileSync, writeFileSync, mkdirSync } = require('node:fs');
const { resolve } = require('node:path');
const root = resolve(__dirname, '..');
const schema = readFileSync(resolve(root, 'prisma/schema.prisma'), 'utf8');
if (!schema.includes('provider = "sqlite"')) throw new Error('Expected the existing SQLite source schema');
const directory = resolve(root, 'prisma/postgresql');
mkdirSync(directory, { recursive: true });
writeFileSync(resolve(directory, 'schema.prisma'), schema.replace('provider = "sqlite"', 'provider = "postgresql"'));
console.log('PostgreSQL schema prepared. Existing database and environment were not changed.');

const { readFileSync, writeFileSync, mkdirSync } = require('node:fs');
const { resolve } = require('node:path');
try {
  require('dotenv').config({ path: resolve(__dirname, '../.env') });
} catch {
  try {
    const raw = readFileSync(resolve(__dirname, '../.env'), 'utf8');
    for (const line of raw.split('\n')) {
      const m = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
      if (m && !process.env[m[1]]) {
        let v = (m[2] || '').trim();
        if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
        process.env[m[1]] = v;
      }
    }
  } catch {}
}

const envFile = resolve(__dirname, '../.env');
try {
  let envContent = readFileSync(envFile, 'utf8');
  if (envContent.includes('replace-with-at-least-32-random-characters') || !process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32) {
    const crypto = require('crypto');
    const secret = crypto.randomBytes(32).toString('hex');
    if (envContent.includes('JWT_SECRET=')) {
      envContent = envContent.replace(/JWT_SECRET=.*/, `JWT_SECRET=${secret}`);
    } else {
      envContent += `\nJWT_SECRET=${secret}\n`;
    }
    writeFileSync(envFile, envContent);
    process.env.JWT_SECRET = secret;
    console.log('Synchronized secure JWT_SECRET in .env');
  }
} catch {}

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

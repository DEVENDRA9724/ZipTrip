const { PrismaClient } = require('@prisma/client');
const { PrismaBetterSqlite3 } = require('@prisma/adapter-better-sqlite3');
const bcrypt = require('bcryptjs');
const { createInterface } = require('node:readline/promises');
const { Writable } = require('node:stream');
(async () => {
  const output = new Writable({ write(chunk, encoding, callback) { if (!output.muted) process.stdout.write(chunk, encoding); callback(); } });
  const rl = createInterface({ input: process.stdin, output, terminal: Boolean(process.stdin.isTTY) });
  const email = (await rl.question('Admin email: ')).trim().toLowerCase();
  process.stdout.write('Admin password (12–72 bytes, input hidden): ');
  output.muted = true;
  const password = await rl.question('');
  output.muted = false;
  process.stdout.write('\n');
  rl.close();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || password.length < 12 || Buffer.byteLength(password) > 72) throw new Error('Invalid email or password');
  const prisma = new PrismaClient({ adapter: new PrismaBetterSqlite3({ url: process.env.DATABASE_URL || 'file:./portal.db' }) });
  try {
    if (await prisma.user.findUnique({ where: { email } })) throw new Error('Account already exists; no role or password was changed');
    await prisma.user.create({ data: { email, firstName: 'Operations', lastName: 'Admin', role: 'ADMIN', passwordHash: await bcrypt.hash(password, 12), wallet: { create: {} } } });
    console.log('Administrator created.');
  } finally { await prisma.$disconnect(); }
})().catch(error => { console.error(error.message); process.exitCode = 1; });


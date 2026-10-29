// Run on the server from apps/backend with its existing .env. No password arguments/files.
'use strict';
const { createInterface } = require('node:readline/promises');
const { Writable } = require('node:stream');

class RecoveryError extends Error {}
function validateAdmin(user) {
  if (!user) throw new RecoveryError('Admin account not found. No changes made. Use the existing admin:create command if you need to create an administrator.');
  if (user.role !== 'ADMIN') throw new RecoveryError('This account is not an administrator. No role or password was changed.');
  if (user.isBlocked) throw new RecoveryError('This administrator is blocked. Password recovery does not unblock accounts.');
}

async function resetAdminPassword(prisma, emailInput, password, confirmation, hashPassword) {
  const email = String(emailInput || '').trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new RecoveryError('Enter a valid admin email.');
  if (typeof password !== 'string' || password.length < 12 || Buffer.byteLength(password, 'utf8') > 72) throw new RecoveryError('Use a password of at least 12 characters and at most 72 UTF-8 bytes.');
  if (password !== confirmation) throw new RecoveryError('Passwords do not match. No changes made.');
  return prisma.$transaction(async tx => {
    const user = await tx.user.findUnique({ where: { email }, select: { id: true, role: true, isBlocked: true } });
    validateAdmin(user);
    const passwordHash = await hashPassword(password);
    await tx.user.update({ where: { id: user.id, role: 'ADMIN', isBlocked: false }, data: { passwordHash } });
    await tx.auditLog.create({ data: {
      actorId: 'system:admin-password-recovery', action: 'ADMIN_PASSWORD_RESET', targetId: user.id,
      detail: 'Administrator password reset through the server terminal. No role or verification changes.',
    } });
  });
}

async function main() {
  if (!process.stdin.isTTY || !process.stdout.isTTY) throw new RecoveryError('Run this command in an interactive SSH terminal. Password input is hidden.');
  const url = /^postgres(ql)?:\/\//.test(process.env.POSTGRES_DATABASE_URL || '')
    ? process.env.POSTGRES_DATABASE_URL : process.env.DATABASE_URL;
  if (!/^postgres(ql)?:\/\//.test(url || '')) throw new RecoveryError('Load the existing server .env with a PostgreSQL connection. No database was changed.');
  const { PrismaClient } = require('@prisma/client');
  const { PrismaPg } = require('@prisma/adapter-pg');
  const bcrypt = require('bcryptjs');
  const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: url }), log: [] });
  const output = new Writable({ write(chunk, encoding, callback) { if (!output.muted) process.stdout.write(chunk, encoding); callback(); } });
  const rl = createInterface({ input: process.stdin, output, terminal: true });
  const hidden = async prompt => {
    process.stdout.write(prompt);
    output.muted = true;
    try { return await rl.question(''); }
    finally { output.muted = false; process.stdout.write('\n'); }
  };
  try {
    const email = (await rl.question('Existing admin email: ')).trim().toLowerCase();
    validateAdmin(await prisma.user.findUnique({ where: { email }, select: { id: true, role: true, isBlocked: true } }));
    const password = await hidden('New password (12+ characters, input hidden): ');
    const confirmation = await hidden('Confirm new password (input hidden): ');
    await resetAdminPassword(prisma, email, password, confirmation, value => bcrypt.hash(value, 12));
    console.log('Administrator password updated. Sign in using the new password; no server restart is required.');
  } finally {
    rl.close();
    await prisma.$disconnect();
  }
}
if (require.main === module) main().catch(error => {
  console.error(error instanceof RecoveryError ? error.message : 'Password reset failed. Check the server database connection and schema. No password or connection details are printed.');
  process.exitCode = 1;
});
module.exports = { resetAdminPassword };

'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { resetAdminPassword } = require('./reset-admin-password.cjs');
const password = 'Synthetic-Test-Only-Password';
function fixture(user) {
  const changes = [];
  const tx = { user: { findUnique: async () => user, update: async args => { changes.push(args); } }, auditLog: { create: async args => { changes.push(args); } } };
  return { prisma: { $transaction: fn => fn(tx) }, changes };
}
test('resets only the password of an active administrator and records no secrets', async () => {
  const { prisma, changes } = fixture({ id: 'admin-1', role: 'ADMIN', isBlocked: false });
  await resetAdminPassword(prisma, ' ADMIN@example.invalid ', password, password, async () => 'test-hash');
  assert.deepEqual(changes[0], { where: { id: 'admin-1', role: 'ADMIN', isBlocked: false }, data: { passwordHash: 'test-hash' } });
  assert.equal(changes[1].data.action, 'ADMIN_PASSWORD_RESET');
  assert.ok(!JSON.stringify(changes).includes(password));
});
for (const [name, user, message] of [
  ['missing account', null, /not found/],
  ['customer account', { id: 'customer-1', role: 'CUSTOMER' }, /not an administrator/],
  ['blocked administrator', { id: 'admin-1', role: 'ADMIN', isBlocked: true }, /blocked/],
]) test(`rejects ${name} without writes`, async () => {
  const { prisma, changes } = fixture(user);
  await assert.rejects(resetAdminPassword(prisma, 'admin@example.invalid', password, password, async () => 'hash'), message);
  assert.equal(changes.length, 0);
});
test('rejects mismatched and overlong UTF-8 passwords before database access', async () => {
  const { prisma, changes } = fixture({ id: 'admin-1', role: 'ADMIN' });
  await assert.rejects(resetAdminPassword(prisma, 'admin@example.invalid', password, 'different', async () => 'hash'), /do not match/);
  await assert.rejects(resetAdminPassword(prisma, 'admin@example.invalid', '🔑'.repeat(20), '🔑'.repeat(20), async () => 'hash'), /72 UTF-8 bytes/);
  await assert.rejects(resetAdminPassword(prisma, 'admin@example.invalid', 'short', 'short', async () => 'hash'), /12 characters/);
  assert.equal(changes.length, 0);
});

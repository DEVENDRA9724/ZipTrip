'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { createHash } = require('node:crypto');
const { restoreFleet } = require('./restore-fleet.cjs');
const photo = Buffer.from('synthetic photo bytes');
function fixture({ owner, vehicle, brokenPhoto = false, failedDocument = false } = {}) {
  const state = { user: [{ id: 'operations-admin', email: 'admin@example.invalid', role: 'ADMIN', passwordHash: 'preserve-admin-password' }, ...(owner ? [owner] : [])],
    vehicle: vehicle ? [vehicle] : [], vehicleModel: [], hub: [], media: [], document: [], auditLog: [] };
  const delegates = value => Object.fromEntries(Object.keys(value).map(name => [name, {
    findUnique: async ({ where }) => value[name].find(row => Object.entries(where).every(([key, val]) => row[key] === val)) || null,
    findFirst: async ({ where }) => value[name].find(row => (where.OR || [where]).some(term => Object.entries(term).every(([key, val]) => row[key] === val))) || null,
    create: async ({ data }) => { if (failedDocument && name === 'document') throw new Error('simulated transaction failure'); value[name].push(data); return data; },
  }]));
  const prisma = { ...delegates(state), $transaction: async fn => {
    const staged = structuredClone(state);
    const result = await fn(delegates(staged));
    Object.assign(state, staged);
    return result;
  } };
  const objects = new Map(), credentials = [];
  const data = { format: 'safar-fleet-v1', owners: [{ id: 'source-host', email: 'host@example.invalid', firstName: 'Test', lastName: 'Host', role: 'HOST' }],
    vehicles: [{ id: 'source-car', hostId: 'source-host', registrationNumber: 'TEST-1', make: 'Test', model: 'Car', modelSpecId: 'model-1', currentHubId: 'hub-1', status: 'ACTIVE' }],
    models: [{ id: 'model-1', brand: 'Test', modelName: 'Car', transmission: 'Manual', fuelType: 'Petrol' }], hubs: [{ id: 'hub-1' }],
    media: [{ id: 'photo-1', vehicleId: 'source-car', ownerId: 'source-host', storageKey: 'abc-123.jpg', kind: 'FRONT', mimeType: 'image/jpeg', size: photo.length, sha256: createHash('sha256').update(photo).digest('hex') }],
    documents: [{ id: 'doc-1', userId: 'source-host', vehicleId: 'source-car', kind: 'RC', source: 'HOST_UPLOAD', status: 'APPROVED' }] };
  const options = { prisma, data, convert: (model, row) => row, hashPassword: async () => 'fresh-private-hash',
    storage: { get: async key => objects.get(key) || null, put: async (key, bytes) => objects.set(key, bytes) },
    readMedia: async () => brokenPhoto ? Buffer.from('wrong bytes') : photo,
    writeCredentials: async rows => credentials.push(...rows) };
  return { state, options, objects, credentials };
}
test('dry run reports the plan without database, S3 or credential writes', async () => {
  const f = fixture();
  const result = await restoreFleet({ ...f.options, apply: false });
  assert.equal(result.vehiclesToRestore, 1);
  assert.equal(f.state.user.length, 1);
  assert.equal(f.state.vehicle.length, 0);
  assert.equal(f.objects.size, 0);
  assert.equal(f.credentials.length, 0);
});
test('restores photos and fleet for review without changing the administrator or claiming missing evidence is verified', async () => {
  const f = fixture();
  const result = await restoreFleet({ ...f.options, apply: true });
  assert.equal(result.restoredVehicles, 1);
  assert.equal(f.state.user[0].passwordHash, 'preserve-admin-password');
  assert.equal(f.state.user[1].isVerified, false);
  assert.equal(f.state.user[1].passwordHash, 'fresh-private-hash');
  assert.equal(f.state.vehicle[0].approvalStatus, 'PENDING_APPROVAL');
  assert.equal(f.state.vehicle[0].availability, 'INACTIVE');
  assert.equal(f.state.document[0].status, 'PENDING');
  assert.equal(f.state.document[0].mediaId, null);
  assert.equal(f.state.media.length, 1);
  assert.deepEqual(f.objects.get('abc-123.jpg'), photo);
  assert.equal(f.credentials.length, 1);
  assert.ok(!JSON.stringify(f.state.auditLog).includes(f.credentials[0].password));
});
test('repeating a restore preserves existing vehicles and credentials', async () => {
  const f = fixture();
  await restoreFleet({ ...f.options, apply: true });
  // A real administrator might have approved this listing after the initial restore.
  f.state.vehicle[0].approvalStatus = 'APPROVED';
  const result = await restoreFleet({ ...f.options, apply: true });
  assert.equal(result.vehiclesToRestore, 0);
  assert.equal(f.state.vehicle.length, 1);
  assert.equal(f.state.vehicle[0].approvalStatus, 'APPROVED');
  assert.equal(f.credentials.length, 1);
});
test('matches an existing owner by email without changing their password or role', async () => {
  const f = fixture({ owner: { id: 'server-host', email: 'host@example.invalid', role: 'HOST', passwordHash: 'keep-host-password' } });
  await restoreFleet({ ...f.options, apply: true });
  assert.equal(f.state.user.length, 2);
  assert.equal(f.state.user[1].passwordHash, 'keep-host-password');
  assert.equal(f.state.vehicle[0].hostId, 'server-host');
  assert.equal(f.state.document[0].userId, 'server-host');
  assert.equal(f.credentials.length, 0);
});
test('existing registration numbers are skipped instead of duplicated', async () => {
  const f = fixture({ vehicle: { id: 'server-car', registrationNumber: 'TEST-1' } });
  const result = await restoreFleet({ ...f.options, apply: true });
  assert.equal(result.existingVehiclesUnchanged, 1);
  assert.equal(f.state.vehicle.length, 1);
  assert.equal(f.objects.size, 0);
});
test('rejects damaged source photos before any writes', async () => {
  const f = fixture({ brokenPhoto: true });
  await assert.rejects(restoreFleet({ ...f.options, apply: true }), /checksum/);
  assert.equal(f.state.vehicle.length, 0);
  assert.equal(f.objects.size, 0);
});
test('refuses to replace an existing S3 object with different bytes', async () => {
  const f = fixture();
  f.objects.set('abc-123.jpg', Buffer.from('existing protected object'));
  await assert.rejects(restoreFleet({ ...f.options, apply: true }), /different content/);
  assert.equal(f.objects.get('abc-123.jpg').toString(), 'existing protected object');
  assert.equal(f.state.vehicle.length, 0);
});
test('a database error rolls back the new owners, vehicles and documents together', async () => {
  const f = fixture({ failedDocument: true });
  await assert.rejects(restoreFleet({ ...f.options, apply: true }), /transaction failure/);
  assert.equal(f.state.user.length, 1);
  assert.equal(f.state.vehicle.length, 0);
  assert.equal(f.credentials.length, 0);
});
test('a customer email conflict never promotes the customer to an owner', async () => {
  const f = fixture({ owner: { id: 'customer', email: 'host@example.invalid', role: 'CUSTOMER' } });
  await assert.rejects(restoreFleet({ ...f.options, apply: true }), /customer/);
  assert.equal(f.state.user[1].role, 'CUSTOMER');
  assert.equal(f.state.vehicle.length, 0);
});
test('reuses an existing model matching the unique model specification', async () => {
  const f = fixture();
  f.state.vehicleModel.push({ id: 'server-model', brand: 'Test', modelName: 'Car', transmission: 'Manual', fuelType: 'Petrol' });
  await restoreFleet({ ...f.options, apply: true });
  assert.equal(f.state.vehicleModel.length, 1);
  assert.equal(f.state.vehicle[0].modelSpecId, 'server-model');
});

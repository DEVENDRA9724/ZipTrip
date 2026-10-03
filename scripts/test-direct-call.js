const path = require('path');
require(path.join(__dirname, '../apps/backend/node_modules/dotenv')).config({ path: path.join(__dirname, '../apps/backend/.env') });

const Database = require(path.join(__dirname, '../apps/backend/node_modules/better-sqlite3'));
const db = new Database(path.join(__dirname, '../apps/backend/portal.db'));

const doc = db.prepare("SELECT * FROM Document WHERE id = 'b35a0082-a6aa-41d3-896c-7b03f4dd6d37'").get();
const session = db.prepare("SELECT * FROM KycSession WHERE id = ?").get(doc.providerSessionId);

async function testDirect() {
  const { SandboxService } = require(path.join(__dirname, '../apps/backend/dist/kyc/sandbox.service'));
  const service = new SandboxService();
  try {
    const res = await service.call('/kyc/digilocker/sessions/' + encodeURIComponent(session.providerId) + '/documents/driving_license');
    console.log('Direct sandbox call result files count:', res.files?.length);
    console.log('Files:', res.files);
  } catch (e) {
    console.error('Direct sandbox call error:', e);
  }
}

testDirect().catch(console.error);

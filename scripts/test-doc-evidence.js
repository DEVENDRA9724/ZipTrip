const path = require('path');
const Database = require(path.join(__dirname, '../apps/backend/node_modules/better-sqlite3'));
const db = new Database(path.join(__dirname, '../apps/backend/portal.db'));

const doc = db.prepare("SELECT * FROM Document WHERE id = 'b35a0082-a6aa-41d3-896c-7b03f4dd6d37'").get();
console.log('Testing Devendra DL document:', doc);

async function test() {
  const jwt = require(path.join(__dirname, '../apps/backend/node_modules/jsonwebtoken'));
  const token = jwt.sign(
    { id: doc.userId, email: 'devendrasharma4308@gmail.com', role: 'ADMIN' },
    '351c1e91b0523198494d608ccd28bf2f79068a792b21321135dbd0d423d6d04247c2466d666adf2b62b44483008ad3d8'
  );

  console.log('Calling user evidence endpoint /api/kyc/documents/' + doc.id + '/evidence ...');
  const res = await fetch(`http://localhost:3000/api/kyc/documents/${doc.id}/evidence`, {
    headers: { 'Cookie': `safar_session=${token}` }
  });
  console.log('Status code:', res.status);
  const data = await res.json();
  console.log('Returned files count:', data.files?.length);
  if (data.files && data.files.length) {
    console.log('First file:', {
      url: data.files[0].url.slice(0, 80) + '...',
      metadata: data.files[0].metadata
    });
  }
}

test().catch(console.error);

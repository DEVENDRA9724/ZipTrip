const path = require('path');
const Database = require(path.join(__dirname, '../apps/backend/node_modules/better-sqlite3'));
const db = new Database(path.join(__dirname, '../apps/backend/portal.db'));

const doc = db.prepare("SELECT * FROM Document WHERE kind = 'DL' AND userId = '5f632c26-b881-49a8-8854-609201908638'").get();
console.log('Testing DL doc:', doc);

async function testDLApproval() {
  const jwt = require(path.join(__dirname, '../apps/backend/node_modules/jsonwebtoken'));
  const token = jwt.sign(
    { id: '5f632c26-b881-49a8-8854-609201908638', email: 'devendrasharma4308@gmail.com', role: 'ADMIN' },
    '351c1e91b0523198494d608ccd28bf2f79068a792b21321135dbd0d423d6d04247c2466d666adf2b62b44483008ad3d8'
  );

  const res = await fetch(`http://localhost:3000/api/admin/documents/${doc.id}/review`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Cookie': 'safar_session=' + token
    },
    body: JSON.stringify({
      status: 'APPROVED',
      validUntil: '2029-12-31',
      note: 'Verified via MoRTH DigiLocker electronic driving licence',
      identityChecked: true
    })
  });

  console.log('DL Approval status:', res.status);
  const data = await res.json();
  console.log('DL Approval response:', data);

  const updatedUser = db.prepare("SELECT id, email, role, isVerified, dlValidUntil FROM User WHERE email = 'devendrasharma4308@gmail.com'").get();
  console.log('Updated user status:', updatedUser);
}

testDLApproval().catch(console.error);

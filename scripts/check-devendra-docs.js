const path = require('path');
const Database = require(path.join(__dirname, '../apps/backend/node_modules/better-sqlite3'));
const db = new Database(path.join(__dirname, '../apps/backend/portal.db'));

const user = db.prepare("SELECT id, email, role, firstName, lastName FROM User WHERE email = 'devendrasharma4308@gmail.com'").get();
const docs = db.prepare("SELECT * FROM Document WHERE userId = ?").all(user.id);
const sessions = db.prepare("SELECT * FROM KycSession WHERE userId = ?").all(user.id);

console.log('User:', user);
console.log('Documents in DB:', docs);
console.log('Sessions in DB:', sessions);

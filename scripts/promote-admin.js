const path = require('path');
const Database = require(path.join(__dirname, '../apps/backend/node_modules/better-sqlite3'));
const db = new Database(path.join(__dirname, '../apps/backend/portal.db'));

db.prepare("UPDATE User SET role = 'ADMIN' WHERE email = 'devendrasharma4308@gmail.com'").run();
const user = db.prepare("SELECT email, role, firstName, lastName FROM User WHERE email = 'devendrasharma4308@gmail.com'").get();
console.log('User status:', user);

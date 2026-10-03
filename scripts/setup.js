const { existsSync, writeFileSync } = require('node:fs');
const { resolve } = require('node:path');
const { randomBytes } = require('node:crypto');
const { spawnSync } = require('node:child_process');
const backend = resolve(__dirname, '../apps/backend');
const envPath = resolve(backend, '.env');
if (!existsSync(envPath)) {
  writeFileSync(envPath, [
    'PORT=3000', 'DATABASE_URL=file:./portal.db',
    'JWT_SECRET=' + randomBytes(48).toString('hex'),
    'DOCUMENT_ENCRYPTION_KEY=' + randomBytes(32).toString('hex'),
    'WEB_ORIGIN=http://localhost:3000', 'UPLOAD_DIR=./uploads',
    'SANDBOX_ENV=test', 'SANDBOX_API_KEY=', 'SANDBOX_API_SECRET=',
    'KYC_REDIRECT_URL=', 'BUSINESS_NAME=Safar Self Drive', 'BUSINESS_ADDRESS=', ''
  ].join('\n'), { flag: 'wx' });
  console.log('Created apps/backend/.env with local security keys. Add Sandbox credentials there.');
}
const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm';
for (const args of [['install', '--ignore-scripts'], ['run','db:generate'], ['run','db:push'], ['run','seed'], ['run','build']]) {
  const result = spawnSync(npm, args, { cwd: backend, stdio: 'inherit', shell: process.platform === 'win32', windowsHide: true });
  if (result.status !== 0) process.exit(result.status || 1);
}
console.log('Setup complete! Run npm start (or double-click START_SAFAR_PORTAL.bat), then visit http://localhost:3000.');


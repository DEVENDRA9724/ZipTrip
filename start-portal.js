const { spawn, exec } = require('node:child_process');
const { existsSync, writeFileSync, unlinkSync } = require('node:fs');
const { resolve } = require('node:path');
const backend = resolve(__dirname, 'apps/backend');
const pidFile = resolve(__dirname, '.portal-pids.json');
if (!existsSync(resolve(backend, '.env')) || !existsSync(resolve(backend, 'dist/main.js'))) {
  console.error('Run npm run setup first.');
  process.exit(1);
}
const child = spawn(process.execPath, ['--env-file-if-exists=.env', 'dist/main.js'], { cwd: backend, stdio: 'inherit', windowsHide: true });
writeFileSync(pidFile, JSON.stringify({ pid: child.pid, executable: process.execPath, cwd: backend }));
console.log('Starting Safar frontend and API at http://localhost:3000. Keep this terminal open; Ctrl+C stops it.');

setTimeout(() => {
  const url = 'http://localhost:3000';
  const openCmd = process.platform === 'win32' ? `start ${url}` : process.platform === 'darwin' ? `open ${url}` : `xdg-open ${url}`;
  exec(openCmd, () => {});
}, 1500);

child.on('exit', code => { try { unlinkSync(pidFile); } catch {} process.exitCode = code || 0; });
process.on('SIGINT', () => child.kill('SIGINT'));
process.on('SIGTERM', () => child.kill('SIGTERM'));

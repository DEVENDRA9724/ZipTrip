const { spawn, execSync } = require('child_process');
const http = require('http');

console.log('🚀 Starting Safar Self Drive & Gujarat Taxi Portal...');

function checkPort(port) {
  return new Promise((resolve) => {
    const req = http.get('http://localhost:' + port + '/', (res) => {
      resolve(true);
    });
    req.on('error', () => resolve(false));
    req.setTimeout(1000, () => {
      req.abort();
      resolve(false);
    });
  });
}

async function main() {
  const is8000Up = await checkPort(8000);
  if (!is8000Up) {
    console.log('🌐 Launching Safar Web Server on http://localhost:8000...');
    const webProc = spawn('python', ['-m', 'http.server', '8000', '--directory', 'apps/web'], {
      detached: true,
      stdio: 'ignore',
      cwd: __dirname
    });
    webProc.unref();
  } else {
    console.log('✅ Safar Web Server is already running on http://localhost:8000');
  }

  // Open default browser to new portal
  console.log('🌍 Opening http://localhost:8000 in your browser...');
  try {
    const startCmd = process.platform === 'win32' ? 'start' : 'open';
    execSync(startCmd + ' http://localhost:8000/index.html');
  } catch (e) {}

  console.log('🎉 Safar Portal is LIVE at: http://localhost:8000/');
  console.log('💡 To stop the portal anytime, run: npm run stop or double click STOP_SAFAR_PORTAL.bat');
}

main();

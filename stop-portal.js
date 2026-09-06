const { execSync } = require('child_process');

console.log('🛑 Stopping Safar Portal processes on port 8000 and 3000...');

function killPort(port) {
  try {
    if (process.platform === 'win32') {
      const output = execSync('netstat -ano | findstr :' + port).toString();
      const lines = output.trim().split('\n');
      const pids = new Set();
      lines.forEach(line => {
        const parts = line.trim().split(/\s+/);
        if (parts.length >= 5 && parts[1].includes(':' + port)) {
          const pid = parts[parts.length - 1];
          if (pid && pid !== '0') pids.add(pid);
        }
      });
      pids.forEach(pid => {
        try {
          execSync('taskkill /F /PID ' + pid);
          console.log('✅ Stopped process ' + pid + ' on port ' + port);
        } catch (e) {}
      });
    }
  } catch (e) {
    console.log('ℹ️ Port ' + port + ' is already free.');
  }
}

killPort(8000);
killPort(3000);
console.log('🏁 All Safar Portal servers stopped successfully.');

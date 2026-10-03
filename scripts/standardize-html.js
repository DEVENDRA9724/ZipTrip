const fs = require('fs');
const path = require('path');

const webDir = path.join(__dirname, '../apps/web');
const files = fs.readdirSync(webDir).filter(f => f.endsWith('.html'));

const cleanHeader = '<header id="header" class="header"></header>';
const cleanFooter = '<footer class="footer"><div style="display:flex;align-items:center;gap:10px"><img src="safar-logo.png" alt="Safar" style="height:32px;width:32px;object-fit:contain;border-radius:50%;background:#fff"><span style="font-weight:700;color:var(--ink)">Safar Self Drive</span> · <span style="color:var(--muted)">Your Journey. Your Rules.</span></div><span style="color:var(--muted)">Verified listings · DigiLocker eKYC · Transparent records</span></footer>';

for (const file of files) {
  const filePath = path.join(webDir, file);
  let html = fs.readFileSync(filePath, 'utf8');

  // Update theme color
  html = html.replace(/theme-color" content="[^"]*"/, 'theme-color" content="#3B1259"');

  // Ensure header is uniform
  html = html.replace(/<header id="header"[^>]*>[\s\S]*?<\/header>/, cleanHeader);

  // Ensure footer is uniform
  html = html.replace(/<footer class="footer"[^>]*>[\s\S]*?<\/footer>/, cleanFooter);

  fs.writeFileSync(filePath, html, 'utf8');
}
console.log('Updated all', files.length, 'HTML templates.');

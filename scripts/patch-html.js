'use strict';
const fs = require('fs');
const path = require('path');
const glob = require('fs');

const webDir = path.join(__dirname, '../apps/web');
const htmlFiles = fs.readdirSync(webDir).filter(f => f.endsWith('.html'));

const OLD_THEME = 'content="#422448"';
const NEW_THEME = 'content="#6B2D8B"';

const OLD_FOOTER = '<footer class="footer"><span>SAFAR · Self drive, at your pace.</span><span>Verified listings · Clear booking records · Your next journey</span></footer>';
const NEW_FOOTER = '<footer class="footer"><span style="display:flex;align-items:center;gap:10px"><img src="safar-logo.png" alt="Safar Self Drive" style="height:28px;width:auto;opacity:.7"> · Your Journey. Your Rules.</span><span>Verified listings · Clear booking records · Your next journey</span></footer>';

let updated = 0;
for (const f of htmlFiles) {
  const fp = path.join(webDir, f);
  let content = fs.readFileSync(fp, 'utf8');
  let changed = false;
  if (content.includes(OLD_THEME)) { content = content.replace(OLD_THEME, NEW_THEME); changed = true; }
  if (content.includes(OLD_FOOTER)) { content = content.replace(OLD_FOOTER, NEW_FOOTER); changed = true; }
  if (changed) { fs.writeFileSync(fp, content, 'utf8'); updated++; console.log('✓', f); }
}
console.log('Done.', updated, 'files updated.');

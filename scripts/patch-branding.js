'use strict';
const fs = require('fs');
const path = require('path');

const jsPath = path.join(__dirname, '../apps/web/portal.js');
let src = fs.readFileSync(jsPath, 'utf8');

// ── 1. Auth aside: add logo image at top ──────────────────────────────────
const OLD_ASIDE = '<aside class="auth-aside"><div><div class="eyebrow">WELCOME TO SAFAR</div>';
const NEW_ASIDE = '<aside class="auth-aside"><div>' +
  '<img src="safar-logo.png" alt="Safar Self Drive" style="height:56px;width:auto;margin-bottom:20px;filter:brightness(0) invert(1)">' +
  '<div class="eyebrow" style="color:#F07C2099">WELCOME TO SAFAR</div>';

if (src.includes(OLD_ASIDE)) {
  src = src.replace(OLD_ASIDE, NEW_ASIDE);
  console.log('✓ Auth aside logo added');
} else {
  console.log('✗ Auth aside marker not found — skipping');
}

fs.writeFileSync(jsPath, src, 'utf8');
console.log('Done. portal.js updated.');

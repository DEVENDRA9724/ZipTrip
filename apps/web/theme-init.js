// Applies the saved light/dark theme before first paint. Loaded synchronously in <head> (an external file, so the
// pages work under a Content-Security-Policy without 'unsafe-inline').
try { const theme = localStorage.getItem('safar-theme'); if (theme) document.documentElement.dataset.theme = theme; } catch (e) { /* storage unavailable */ }

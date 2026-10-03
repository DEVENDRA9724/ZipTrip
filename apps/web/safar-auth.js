// Compatibility navigation for the informational pages. API authorization is enforced on the server.
const SafarAuth = {
  getUser() { return null; },
  quickLogin() { location.href = 'auth.html'; },
  setUser() { throw new Error('Sign in through the authentication page'); },
  async logout() { await fetch('/api/auth/logout', { method: 'POST', headers: { 'Content-Type':'application/json' }, body: '{}' }); location.href = 'auth.html'; },
  renderDrawer() {
    const drawer = document.getElementById('side-menu-drawer');
    if (drawer) drawer.innerHTML = '<div style="padding:30px"><h2>Safar</h2><p><a href="index.html">Home</a></p><p><a href="cars.html">Explore cars</a></p><p><a href="host-onboarding.html">List your car</a></p><p><a href="dashboard.html">My trips</a></p><p><a href="kyc.html">Verification</a></p><p><a href="auth.html">Sign in / register</a></p></div>';
  },
  protectPage() { location.href = 'auth.html'; return false; }
};
function toggleMenuDrawer() { document.getElementById('side-menu-drawer')?.classList.toggle('open'); document.getElementById('drawer-backdrop')?.classList.toggle('open'); }
document.addEventListener('DOMContentLoaded', () => SafarAuth.renderDrawer());


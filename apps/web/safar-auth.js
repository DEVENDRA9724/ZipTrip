// ══════════════════════════════════════════════════════════════════
// SAFAR SELF DRIVE & GUJARAT TAXI — AUTH & LUXURY DRAWER ENGINE
// ══════════════════════════════════════════════════════════════════

const SafarAuth = {
  getUser() {
    try {
      const raw = localStorage.getItem('safar_user');
      return raw ? JSON.parse(raw) : null;
    } catch (e) {
      return null;
    }
  },

  setUser(user) {
    localStorage.setItem('safar_user', JSON.stringify(user));
  },

  logout() {
    localStorage.removeItem('safar_user');
    window.location.reload();
  },

  quickLogin(role, name, email) {
    const user = {
      name: name,
      email: email || `${role.toLowerCase()}@safarselfdrive.in`,
      role: role.toUpperCase(), // 'CUSTOMER', 'HOST', 'ADMIN'
      phone: '+91 98765 43210',
      city: 'Ahmedabad',
      dlNumber: 'GJ01-2023-009412'
    };
    this.setUser(user);
    
    // Check return query param
    const params = new URLSearchParams(window.location.search);
    const returnUrl = params.get('redirect');
    if (returnUrl) {
      window.location.href = returnUrl;
    } else if (user.role === 'ADMIN' || user.role === 'HOST') {
      window.location.href = 'dashboard.html';
    } else {
      window.location.href = 'cars.html';
    }
  },

  // ══════════════════════════════════════════════════════════════════
  // ROLE-BASED LUXURY DRAWER (ALL OPTIONS UNDER HAMBURGER)
  // ══════════════════════════════════════════════════════════════════
  renderDrawer() {
    const user = this.getUser();
    const role = user ? user.role.toUpperCase() : 'GUEST';
    const curPath = window.location.pathname.split('/').pop() || 'index.html';

    let userCardHtml = '';
    let sectionsHtml = '';

    // Fast Switcher Buttons
    const roleSwitcherHtml = `
      <div style="margin-top: 14px; padding-top: 12px; border-top: 1px solid rgba(255,255,255,0.18);">
        <div style="font-size: 0.68rem; text-transform: uppercase; font-weight: 800; color: rgba(255,255,255,0.65); margin-bottom: 6px; letter-spacing: 0.05em;">
          Fast 1-Click Role Switcher:
        </div>
        <div style="display: flex; gap: 6px;">
          <button onclick="SafarAuth.quickLogin('CUSTOMER', 'Hardik Patel')" style="flex: 1; padding: 5px 4px; border-radius: 8px; border: 1px solid rgba(255,255,255,0.25); background: ${role==='CUSTOMER'?'#FFFFFF':'rgba(255,255,255,0.12)'}; color: ${role==='CUSTOMER'?'#320E3B':'#FFFFFF'}; font-weight: 800; font-size: 0.7rem; cursor: pointer;">
            Customer
          </button>
          <button onclick="SafarAuth.quickLogin('HOST', 'Bhavin Patel')" style="flex: 1; padding: 5px 4px; border-radius: 8px; border: 1px solid rgba(255,255,255,0.25); background: ${role==='HOST'?'#FFFFFF':'rgba(255,255,255,0.12)'}; color: ${role==='HOST'?'#320E3B':'#FFFFFF'}; font-weight: 800; font-size: 0.7rem; cursor: pointer;">
            Host
          </button>
          <button onclick="SafarAuth.quickLogin('ADMIN', 'Safar Ops')" style="flex: 1; padding: 5px 4px; border-radius: 8px; border: 1px solid rgba(255,255,255,0.25); background: ${role==='ADMIN'?'#FFFFFF':'rgba(255,255,255,0.12)'}; color: ${role==='ADMIN'?'#320E3B':'#FFFFFF'}; font-weight: 800; font-size: 0.7rem; cursor: pointer;">
            Admin
          </button>
        </div>
      </div>
    `;

    if (role === 'GUEST') {
      userCardHtml = `
        <div style="font-size: 0.72rem; text-transform: uppercase; font-weight: 800; color: #FFA14A; letter-spacing: 0.06em;">
          Gujarat Premier Portal
        </div>
        <div style="font-family: 'Outfit', sans-serif; font-size: 1.35rem; font-weight: 900; margin-top: 2px;">
          Safar Self Drive
        </div>
        <div style="font-size: 0.8rem; color: rgba(255,255,255,0.85); margin-top: 4px;">
          Welcome Explorer &bull; <a href="auth.html" style="color: #FFA14A; font-weight: 800; text-decoration: underline;">Sign In / Register</a>
        </div>
        ${roleSwitcherHtml}
      `;
    } else {
      const initial = user.name ? user.name.charAt(0).toUpperCase() : 'U';
      userCardHtml = `
        <div style="display: flex; align-items: center; gap: 12px;">
          <div style="width: 42px; height: 42px; border-radius: 50%; background: #FFFFFF; color: #320E3B; display: flex; align-items: center; justify-content: center; font-size: 1.2rem; font-weight: 900; box-shadow: 0 4px 10px rgba(0,0,0,0.15);">
            ${initial}
          </div>
          <div>
            <div style="font-size: 0.7rem; text-transform: uppercase; font-weight: 800; color: #FFA14A; letter-spacing: 0.06em;">
              ${role} ACCOUNT
            </div>
            <div style="font-family: 'Outfit', sans-serif; font-size: 1.15rem; font-weight: 800; line-height: 1.2;">
              ${user.name}
            </div>
            <div style="font-size: 0.74rem; color: rgba(255,255,255,0.8); margin-top: 2px;">
              ${user.city || 'Gujarat'} &bull; <span onclick="SafarAuth.logout()" style="color: #FFA14A; text-decoration: underline; cursor: pointer; font-weight: 700;">Sign out</span>
            </div>
          </div>
        </div>
        ${roleSwitcherHtml}
      `;
    }

    // Generate Role-Filtered Navigation Categories
    sectionsHtml += `
      <!-- CATEGORY 1: FLEET & BOOKINGS -->
      <div class="drawer-section-heading">Fleet &amp; Outstation Trips</div>
      <ul class="drawer-nav-list">
        <li class="drawer-nav-item">
          <a href="index.html" class="drawer-nav-link ${curPath==='index.html'?'active':''}">
            <span class="drawer-link-icon">🏠</span>
            <span>Home Portal</span>
          </a>
        </li>
        <li class="drawer-nav-item">
          <a href="cars.html" class="drawer-nav-link ${curPath==='cars.html'?'active':''}">
            <span class="drawer-link-icon">🚗</span>
            <span>Browse All Cars &amp; Book</span>
          </a>
        </li>
        <li class="drawer-nav-item">
          <a href="cars.html?service=self-drive" class="drawer-nav-link">
            <span class="drawer-link-icon">🔑</span>
            <span>Self-Drive Cars</span>
          </a>
        </li>
        <li class="drawer-nav-item">
          <a href="cars.html?service=taxi" class="drawer-nav-link">
            <span class="drawer-link-icon">🚖</span>
            <span>Chauffeur Taxi (Per KM)</span>
          </a>
        </li>
        <li class="drawer-nav-item">
          <a href="calculator.html" class="drawer-nav-link ${curPath==='calculator.html'?'active':''}">
            <span class="drawer-link-icon">🧮</span>
            <span>Gujarat Outstation Fare Calculator</span>
          </a>
        </li>
      </ul>
    `;

    // CATEGORY 2: CUSTOMER / HOST BOOKINGS
    if (role === 'CUSTOMER' || role === 'ADMIN') {
      sectionsHtml += `
        <div class="drawer-section-heading">My Bookings &amp; Agreements</div>
        <ul class="drawer-nav-list">
          <li class="drawer-nav-item">
            <a href="agreement.html" class="drawer-nav-link ${curPath==='agreement.html'?'active':''}">
              <span class="drawer-link-icon">📜</span>
              <span>Digital Rental Agreement &amp; E-Sign</span>
            </a>
          </li>
          <li class="drawer-nav-item">
            <a href="payment.html" class="drawer-nav-link ${curPath==='payment.html'?'active':''}">
              <span class="drawer-link-icon">💳</span>
              <span>Make Advance Payment / UPI QR</span>
            </a>
          </li>
          <li class="drawer-nav-item">
            <a href="dashboard.html" class="drawer-nav-link ${curPath==='dashboard.html'?'active':''}">
              <span class="drawer-link-icon">📊</span>
              <span>Trip Status &amp; Invoices</span>
            </a>
          </li>
        </ul>
      `;
    }

    // CATEGORY 3: HOST & FLEET PARTNERS
    if (role === 'GUEST' || role === 'HOST' || role === 'ADMIN') {
      sectionsHtml += `
        <div class="drawer-section-heading">Partner &amp; Host Fleet</div>
        <ul class="drawer-nav-list">
          <li class="drawer-nav-item">
            <a href="host-onboarding.html" class="drawer-nav-link ${curPath==='host-onboarding.html'?'active':''}">
              <span class="drawer-link-icon">🤝</span>
              <span>Host Your Car (Earn ₹35k - ₹75k)</span>
            </a>
          </li>
      `;
      if (role === 'HOST' || role === 'ADMIN') {
        sectionsHtml += `
          <li class="drawer-nav-item">
            <a href="dashboard.html" class="drawer-nav-link ${curPath==='dashboard.html'?'active':''}">
              <span class="drawer-link-icon">📈</span>
              <span>Host Fleet &amp; Revenue Hub</span>
            </a>
          </li>
          <li class="drawer-nav-item">
            <a href="tracking.html" class="drawer-nav-link ${curPath==='tracking.html'?'active':''}">
              <span class="drawer-link-icon">📡</span>
              <span>Live Fleet GPS &amp; Immobilizer</span>
            </a>
          </li>
        `;
      }
      sectionsHtml += `</ul>`;
    }

    // CATEGORY 4: POLICIES & SUPPORT
    sectionsHtml += `
      <div class="drawer-section-heading">Policies &amp; Assistance</div>
      <ul class="drawer-nav-list">
        <li class="drawer-nav-item">
          <a href="services.html" class="drawer-nav-link ${curPath==='services.html'?'active':''}">
            <span class="drawer-link-icon">💼</span>
            <span>Services &amp; Per-KM Tariffs</span>
          </a>
        </li>
        <li class="drawer-nav-item">
          <a href="about.html" class="drawer-nav-link ${curPath==='about.html'?'active':''}">
            <span class="drawer-link-icon">🛡️</span>
            <span>Rental Policy &amp; About Safar</span>
          </a>
        </li>
        <li class="drawer-nav-item">
          <a href="contact.html" class="drawer-nav-link ${curPath==='contact.html'?'active':''}">
            <span class="drawer-link-icon">📞</span>
            <span>24/7 Roadside Help &amp; Hub Addresses</span>
          </a>
        </li>
      </ul>
    `;

    // Inject into drawer
    const drawerEl = document.getElementById('side-menu-drawer');
    if (drawerEl) {
      drawerEl.innerHTML = `
        <div>
          <div class="drawer-top-banner">
            <button class="drawer-close-btn" onclick="toggleMenuDrawer()" title="Close Menu">&times;</button>
            ${userCardHtml}
          </div>
          <div style="padding-bottom: 20px;">
            ${sectionsHtml}
          </div>
        </div>
        <div class="drawer-footer-card">
          <div style="font-weight: 800; color: var(--lux-purple); margin-bottom: 4px; font-size: 0.85rem;">24/7 Gujarat Operations Hotline</div>
          <a href="tel:+919999999999" style="font-weight: 800; color: var(--lux-orange); text-decoration: none; font-size: 1.05rem; display: block;">
            📞 +91 99999 99999
          </a>
          <div style="font-size: 0.74rem; color: #64748B; margin-top: 6px;">Ahmedabad &bull; Surat &bull; Vadodara &bull; Rajkot &bull; Gandhinagar</div>
        </div>
      `;
    }

    // Update Header Auth Capsule
    this.updateHeaderAuth(user, role);
  },

  // Update top right header user capsule
  updateHeaderAuth(user, role) {
    const authWrapper = document.getElementById('header-auth-container');
    if (!authWrapper) return;

    if (user) {
      const shortName = user.name.split(' ')[0];
      const initial = shortName.charAt(0).toUpperCase();
      authWrapper.innerHTML = `
        <div class="auth-profile-logged">
          <span class="auth-avatar-circle">${initial}</span>
          <span style="font-weight: 800; color: var(--lux-text-dark);">${shortName}</span>
          <span class="auth-role-tag">${role.toUpperCase()}</span>
          <span class="btn-logout-clean" onclick="SafarAuth.logout()" title="Sign out">Sign out</span>
        </div>
      `;
    } else {
      authWrapper.innerHTML = `
        <a href="auth.html" class="btn-clay-auth">
          Sign In
        </a>
      `;
    }
  },

  protectPage(allowedRoles = ['CUSTOMER', 'HOST', 'ADMIN']) {
    const user = this.getUser();
    const currentPage = window.location.pathname.split('/').pop() || 'index.html';

    if (!user) {
      this.showLoginRequiredModal(currentPage);
      return false;
    }

    const role = user.role.toUpperCase();

    if (currentPage === 'tracking.html' && role === 'CUSTOMER') {
      alert('⚠️ Access Notice: Live GPS Telematics & Remote Engine Immobilizer is restricted to Fleet Hosts and Operations Admins. Redirecting to Vehicle Fleet.');
      window.location.href = 'cars.html';
      return false;
    }

    if (!allowedRoles.includes(role)) {
      alert(`⚠️ You need ${allowedRoles.join(' or ')} permissions to access this portal.`);
      window.location.href = 'index.html';
      return false;
    }
    return true;
  },

  showLoginRequiredModal(redirectUrl = 'cars.html') {
    let overlay = document.getElementById('auth-guard-modal');
    if (overlay) overlay.remove();

    overlay = document.createElement('div');
    overlay.id = 'auth-guard-modal';
    overlay.style.cssText = `
      position: fixed; inset: 0; background: rgba(15, 23, 42, 0.65);
      backdrop-filter: blur(12px); -webkit-backdrop-filter: blur(12px);
      z-index: 10000; display: flex; align-items: center; justify-content: center; padding: 20px;
    `;

    overlay.innerHTML = `
      <div style="background: #FFFFFF; border-radius: 24px; padding: 36px 30px; max-width: 480px; width: 100%; box-shadow: 0 20px 50px rgba(50, 14, 59, 0.25); text-align: center; border: 1px solid rgba(255,255,255,0.8); position: relative;">
        <button onclick="document.getElementById('auth-guard-modal').remove()" style="position: absolute; top: 18px; right: 18px; border: none; background: #F1F5F9; width: 32px; height: 32px; border-radius: 50%; font-size: 16px; cursor: pointer; color: #64748B;">&times;</button>
        
        <div style="width: 56px; height: 56px; border-radius: 16px; background: rgba(227, 114, 32, 0.12); color: #E37220; display: inline-flex; align-items: center; justify-content: center; font-size: 26px; margin-bottom: 16px;">
          🔑
        </div>

        <h3 style="font-family: 'Outfit', sans-serif; font-size: 1.5rem; font-weight: 800; color: #0F172A; margin: 0 0 8px;">
          Authentication Required
        </h3>
        <p style="font-size: 0.88rem; color: #64748B; margin-bottom: 24px; line-height: 1.5;">
          For passenger verification and safety, booking vehicles requires signing in as a <b>Customer</b> or <b>Fleet Host</b>.
        </p>

        <div style="background: #F8FAFC; border-radius: 16px; padding: 18px; border: 1px solid #E2E8F0; margin-bottom: 20px; text-align: left;">
          <div style="font-size: 0.72rem; font-weight: 800; color: #64748B; text-transform: uppercase; margin-bottom: 10px; letter-spacing: 0.05em;">
            Instant 1-Click Fast Login:
          </div>
          <div style="display: flex; flex-direction: column; gap: 8px;">
            <button onclick="SafarAuth.quickLogin('CUSTOMER', 'Hardik Patel')" style="padding: 11px 16px; border-radius: 12px; border: 1px solid #CBD5E1; background: #FFFFFF; font-weight: 800; color: #0F172A; display: flex; align-items: center; justify-content: space-between; cursor: pointer; transition: all 0.2s;">
              <span>👤 Login as <b>Customer</b> (Hardik Patel)</span>
              <span style="color: #E37220;">&rarr;</span>
            </button>
            <button onclick="SafarAuth.quickLogin('HOST', 'Bhavin Patel')" style="padding: 11px 16px; border-radius: 12px; border: 1px solid #CBD5E1; background: #FFFFFF; font-weight: 800; color: #0F172A; display: flex; align-items: center; justify-content: space-between; cursor: pointer; transition: all 0.2s;">
              <span>🤝 Login as <b>Fleet Host</b> (Bhavin Patel)</span>
              <span style="color: #320E3B;">&rarr;</span>
            </button>
            <button onclick="SafarAuth.quickLogin('ADMIN', 'Safar Operations')" style="padding: 11px 16px; border-radius: 12px; border: 1px solid #CBD5E1; background: #FFFFFF; font-weight: 800; color: #0F172A; display: flex; align-items: center; justify-content: space-between; cursor: pointer; transition: all 0.2s;">
              <span>⚡ Login as <b>Admin</b> (Operations Hub)</span>
              <span style="color: #E37220;">&rarr;</span>
            </button>
          </div>
        </div>

        <div style="display: flex; gap: 10px;">
          <a href="auth.html?redirect=${encodeURIComponent(redirectUrl)}" style="flex: 1; padding: 12px; border-radius: 12px; background: linear-gradient(135deg, #320E3B 0%, #4D1656 100%); color: #FFFFFF; text-decoration: none; font-weight: 800; font-size: 0.88rem; display: inline-block;">
            Sign In with OTP / Password
          </a>
          <button onclick="document.getElementById('auth-guard-modal').remove()" style="padding: 12px 18px; border-radius: 12px; border: 1px solid #E2E8F0; background: #FFFFFF; color: #64748B; font-weight: 700; cursor: pointer;">
            Cancel
          </button>
        </div>
      </div>
    `;

    document.body.appendChild(overlay);
  }
};

function toggleMenuDrawer() {
  const drawer = document.getElementById('side-menu-drawer');
  const backdrop = document.getElementById('drawer-backdrop');
  if (!drawer || !backdrop) return;
  
  const isOpen = drawer.classList.contains('open');
  if (isOpen) {
    drawer.classList.remove('open');
    backdrop.classList.remove('open');
    document.body.style.overflow = '';
  } else {
    drawer.classList.add('open');
    backdrop.classList.add('open');
    document.body.style.overflow = 'hidden';
  }
}

document.addEventListener('DOMContentLoaded', () => {
  SafarAuth.renderDrawer();
});

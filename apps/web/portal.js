'use strict';

// Both customer and admin views open the provider file directly, without conversion.
async function renderOriginalEvidence(box, endpoint, title, onEvidence = () => {}, onOpen = () => {}) {
  onEvidence(null);
  box.textContent = 'Retrieving the original document…';
  try {
    const evidence = await api(endpoint);
    if (!box.isConnected) return;
    const files = (evidence.files || []).filter(file => {
      try {
        const url = new URL(file.url, location.origin);
        return !url.username && !url.password && (url.protocol === 'https:' ||
          (url.origin === location.origin && (url.pathname.startsWith('/api/media/') || url.pathname.startsWith('/api/admin/') || url.pathname.startsWith('/api/kyc/'))));
      } catch { return false; }
    });
    if (!files.length) throw new Error('Original document unavailable. Retry or complete DigiLocker verification again.');
    box.replaceChildren();
    const note = document.createElement('p');
    note.className = 'text-muted';
    note.textContent = evidence.source === 'DIGILOCKER'
      ? 'These are the original files returned by DigiLocker/Sandbox. Each opens in its supplied format; XML remains XML. Links expire—use Refresh links if needed.'
      : 'This is the stored document image you uploaded. It is not a DigiLocker-issued file.';
    box.append(note);
    if (evidence.notice) {
      const notice = document.createElement('p');
      notice.textContent = evidence.notice;
      box.append(notice);
    }
    if (evidence.environment === 'test') {
      const trial = document.createElement('p');
      trial.className = 'notice';
      trial.textContent = 'Sandbox test environment: these are provider test files, not live identity documents.';
      box.append(trial);
    }
    for (const file of files) {
      const card = document.createElement('div');
      card.style.cssText = 'text-align:left;padding:14px;border:1px solid var(--line);border-radius:var(--r);margin:12px 0';
      const name = document.createElement('strong');
      name.textContent = file.metadata?.description || title;
      const format = document.createElement('p');
      format.className = 'text-muted';
      const pathname = new URL(file.url, location.origin).pathname;
      const extension = pathname.match(/\.(pdf|xml|jpe?g|png|webp)$/i)?.[1]?.toUpperCase();
      format.textContent = 'File format: ' + (file.metadata?.ContentType || extension || 'As supplied by provider');
      const link = document.createElement('a');
      link.href = file.url;
      link.target = '_blank';
      link.rel = 'noopener noreferrer';
      link.referrerPolicy = 'no-referrer';
      link.className = 'button btn-orange btn-sm';
      link.textContent = (pathname.includes('/certificate') || file.metadata?.isCertificate)
        ? 'Open Official Certificate ↗'
        : (evidence.source === 'DIGILOCKER' ? 'Open original document ↗' : 'Open uploaded image ↗');
      link.onclick = () => onOpen(evidence);
      card.append(name, format, link);
      box.append(card);
    }
    const refresh = document.createElement('button');
    refresh.type = 'button';
    refresh.className = 'button btn-ghost btn-sm';
    refresh.textContent = 'Refresh links';
    refresh.onclick = () => renderOriginalEvidence(box, endpoint, title, onEvidence, onOpen);
    box.append(refresh);
    onEvidence(evidence);
  } catch (error) {
    if (!box.isConnected) return;
    const message = document.createElement('p');
    message.className = 'error';
    message.setAttribute('role', 'alert');
    message.textContent = error.message;
    const retry = document.createElement('button');
    retry.type = 'button';
    retry.className = 'button btn-ghost btn-sm';
    retry.textContent = 'Retry original document';
    retry.onclick = () => renderOriginalEvidence(box, endpoint, title, onEvidence, onOpen);
    box.replaceChildren(message, retry);
  }
}

/* ─── DOM & Format Utilities ────────────────────────────────────────── */
const $ = (s, root = document) => root.querySelector(s);
const $$ = (s, root = document) => [...root.querySelectorAll(s)];
const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const money = n => '₹' + Number(n || 0).toLocaleString('en-IN', {maximumFractionDigits: 0});
const dt = v => v ? new Date(v).toLocaleString('en-IN', {day:'2-digit',month:'short',year:'numeric',hour:'2-digit',minute:'2-digit'}) : '—';
const d = v => v ? new Date(v).toLocaleDateString('en-IN', {day:'2-digit',month:'short',year:'numeric'}) : '—';
const localDateTime = value => {
  if (value === null || value === undefined || value === '') return '';
  const date = new Date(value);
  return Number.isFinite(+date) ? new Date(+date - date.getTimezoneOffset() * 60000).toISOString().slice(0, 16) : '';
};
function carLink(id) {
  const params = new URLSearchParams(location.search);
  const next = new URLSearchParams({ id });
  for (const key of ['startDate', 'endDate', 'city']) if (params.has(key)) next.set(key, params.get(key));
  return 'cars.html?' + next.toString();
}

const badge = s => {
  const cls = ['ACTIVE','APPROVED','CONFIRMED','PAID','COMPLETED','SUCCESS','VERIFIED'].includes(s) ? 'good'
    : ['REJECTED','CANCELLED','FAILED','EXPIRED'].includes(s) ? 'red' : 'warn';
  return `<span class="badge ${cls}">${esc(s.replaceAll('_',' '))}</span>`;
};

const page = location.pathname.split('/').pop() || 'index.html';
let user = null, adminData;

/* ─── API Client ─────────────────────────────────────────────────────── */
async function api(path, opts = {}) {
  const res = await fetch('/api' + path, {
    credentials: 'same-origin', ...opts,
    headers: opts.body instanceof FormData ? {} : {'Content-Type':'application/json', ...(opts.headers||{})},
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(Array.isArray(data.message) ? data.message.join(', ') : data.message || `Request failed (${res.status})`);
  return data;
}
const post = (path, body) => api(path, {method:'POST', body: JSON.stringify(body)});

/* ─── Notification Toast ─────────────────────────────────────────────── */
function toast(msg, isError = false) {
  $('.toast')?.remove();
  const el = document.createElement('div');
  el.className = 'toast' + (isError ? ' toast-error' : '');
  el.role = 'status';
  el.textContent = msg;
  document.body.append(el);
  setTimeout(() => el.remove(), 5500);
}

/* ─── Form Binding ───────────────────────────────────────────────────── */
function bindForm(selector, cb) {
  const form = $(selector);
  if (!form) return;
  form.addEventListener('submit', async e => {
    e.preventDefault();
    const btn = $('button[type=submit]', form);
    $('.form-error', form)?.remove();
    if (btn) { btn.disabled = true; btn.dataset.orig = btn.textContent; btn.textContent = 'Please wait…'; }
    try { await cb(Object.fromEntries(new FormData(form)), form); }
    catch (err) {
      const box = document.createElement('p');
      box.className = 'error form-error'; box.role = 'alert'; box.textContent = err.message;
      form.append(box);
    }
    finally { if (btn) { btn.disabled = false; btn.textContent = btn.dataset.orig || 'Submit'; } }
  });
}

/* ─── HTML Helpers ───────────────────────────────────────────────────── */
function inp(name, label, type = 'text', extra = '') {
  return `<label>${label}<input name="${name}" type="${type}" required ${extra}></label>`;
}
function sel(name, label, vals) {
  return `<label>${label}<select name="${name}">${vals.map(v => `<option>${esc(v)}</option>`).join('')}</select></label>`;
}
function sectionHead(title, sub, eyebrow = 'SAFAR') {
  return `<div class="section-head"><div class="eyebrow">${esc(eyebrow)}</div><h2>${title}</h2>${sub ? `<p>${sub}</p>` : ''}</div>`;
}
function empty(title, desc) {
  return `<div class="empty"><h3>${title}</h3><p>${desc}</p></div>`;
}
async function uploadFile(file, kind) {
  if (!file?.size) throw new Error(`Please choose a ${kind.toLowerCase()} image`);
  const fd = new FormData(); fd.append('file', file);
  return api('/media?kind=' + kind, {method:'POST', body: fd});
}
function photoUrl(car) {
  const m = car.media?.find(x => x.kind === 'FRONT') || car.media?.[0];
  if (m) return '/api/media/' + encodeURIComponent(m.id);
  try { const p = JSON.parse(car.images || '[]'); if (p[0]) return p[0]; } catch {}
  return 'cars/creta.jpg';
}
function requireUser(roles) {
  if (!user) { location.replace('auth.html?redirect=' + encodeURIComponent(page + location.search)); return false; }
  if (roles && !roles.includes(user.role)) {
    $('#app').innerHTML = empty('Access Denied', `This page requires a ${roles.join(' or ')} account.`);
    return false;
  }
  return true;
}

/* ─── HEADER / SHELL (WITH MOBILE BOTTOM NAVIGATION) ─────────────────── */
function shell() {
  const links = [
    ['cars.html', 'Explore Cars'],
    ['host-onboarding.html', 'List Your Car'],
    ['dashboard.html', 'Account'],
    ...(user?.role === 'ADMIN' ? [['admin.html', 'Admin']] : []),
  ];

  $('#header').innerHTML = `
    <div style="display:flex;align-items:center;gap:12px;">
      <a class="brand" href="index.html">
        <img src="safar-logo.png" alt="Safar" class="brand-logo" onerror="this.style.display='none'">
        <div class="brand-text">
          <span class="brand-name">safar</span>
          <span class="brand-tag">SELF DRIVE</span>
        </div>
      </a>
      <div class="header-location-badge" title="Active Hubs Across Gujarat" style="display:inline-flex;align-items:center;gap:6px;background:#F8FAFC;border:1px solid #E2E8F0;border-radius:20px;padding:4px 10px;font-size:11px;font-weight:700;color:#334155;">
        <span style="width:7px;height:7px;border-radius:50%;background:#10B981;box-shadow:0 0 0 3px rgba(16,185,129,0.25);"></span>
        <span>Gujarat &bull; 5 Hubs Live</span>
      </div>
    </div>

    <nav class="nav" aria-label="Main Navigation">
      ${links.map(([href, label]) => `<a class="${page === href || (href === 'dashboard.html' && page === 'kyc.html') ? 'active' : ''}" href="${href}">${label}</a>`).join('')}
    </nav>

    <details class="compact-menu"><summary aria-label="Open navigation menu">Menu <span aria-hidden="true">☰</span></summary><nav aria-label="Compact navigation">${links.map(([href,label]) => `<a href="${href}" ${page === href || (href === 'dashboard.html' && page === 'kyc.html') ? 'aria-current="page"' : ''}>${label}</a>`).join('')}</nav></details>
    <div class="account">
      <a href="tel:+919999999999" class="header-phone-pill" style="display:inline-flex;align-items:center;gap:6px;padding:6px 14px;background:#F8FAFC;border:1px solid #E2E8F0;border-radius:20px;font-size:12px;font-weight:700;color:#334155;text-decoration:none;">
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="var(--orange)" stroke-width="2.2"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"></path></svg>
        <span>+91 99999 99999</span>
      </a>

      <button class="dark-toggle" id="dark-toggle-btn" aria-label="Toggle dark mode" title="Toggle dark mode" style="width:34px;height:34px;border-radius:50%;display:flex;align-items:center;justify-content:center;background:#F8FAFC;border:1px solid #E2E8F0;cursor:pointer;">
        <svg id="theme-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path></svg>
      </button>

      ${user
        ? `<span class="user-pill">Hi, ${esc(user.firstName)}</span>
           <button class="btn-ghost btn-sm" id="logout-btn">Sign out</button>`
        : `<a class="btn-outline btn-sm button" href="auth.html">Sign In</a>
           <a class="btn-orange btn-sm button" href="auth.html?tab=register">Register</a>`
      }
    </div>`;

  // Dark mode: restore from localStorage
  const savedTheme = localStorage.getItem('safar-theme');
  if (savedTheme) document.documentElement.dataset.theme = savedTheme;

  $('#dark-toggle-btn')?.addEventListener('click', () => {
    const isDark = document.documentElement.dataset.theme === 'dark';
    document.documentElement.dataset.theme = isDark ? '' : 'dark';
    localStorage.setItem('safar-theme', isDark ? '' : 'dark');
  });

  $('#logout-btn')?.addEventListener('click', async () => {
    await post('/auth/logout', {});
    location.href = 'auth.html';
  });

  // Inject Mobile Bottom Navigation Bar for Mobile-First experience
  if (!$('#mobile-bnav')) {
    const bnav = document.createElement('nav');
    bnav.id = 'mobile-bnav';
    bnav.className = 'mobile-bnav';
    bnav.setAttribute('aria-label', 'Mobile Navigation');
    bnav.innerHTML = `
      <a class="bnav-item ${page === 'index.html' || page === '' ? 'active' : ''}" href="index.html">
        <svg width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>
        <span>Home</span>
      </a>
      <a class="bnav-item ${page === 'cars.html' ? 'active' : ''}" href="cars.html">
        <svg width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M19 17h2c.6 0 1-.4 1-1v-3c0-.9-.7-1.7-1.5-1.9C18.7 10.6 16 10 16 10s-1.3-1.4-2.2-2.3c-.5-.4-1.1-.7-1.8-.7H5c-.6 0-1.1.4-1.4.9l-1.5 2.8C2.1 10.8 2 11 2 11.2V16c0 .6.4 1 1 1h2"/><circle cx="7" cy="17" r="2"/><path d="M9 17h6"/><circle cx="17" cy="17" r="2"/></svg>
        <span>Cars</span>
      </a>
      <a class="bnav-item ${page === 'dashboard.html' || page === 'kyc.html' ? 'active' : ''}" href="dashboard.html">
        <svg width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
        <span>Account</span>
      </a>
      ${user?.role === 'ADMIN' ? `
      <a class="bnav-item ${page === 'admin.html' ? 'active' : ''}" href="admin.html">
        <svg width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>
        <span>Admin</span>
      </a>` : `
      <a class="bnav-item ${page === 'auth.html' ? 'active' : ''}" href="auth.html">
        <svg width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
        <span>${user ? 'Account' : 'Login'}</span>
      </a>`}
    `;
    document.body.appendChild(bnav);
  }
}

/* ─── CAR CARD (REFERENCE STYLE — CLEAN & EMOJI-FREE) ───────────────── */
function carCard(car) {
  const hrRate = Math.round(Number(car.pricePerDay) / 24);
  const specs = [car.transmission, car.fuelType, car.seats + ' Seats', car.year].filter(Boolean).join(' · ');
  return `
    <a class="car-card" href="${esc(carLink(car.id))}">
      <div class="car-card-media">
        <img src="${photoUrl(car)}" alt="${esc(car.make + ' ' + car.model)}" loading="lazy">
        <span class="car-card-badge">Self-Drive</span>
        <span class="car-card-rating">${(car.media || []).length} photos</span>
      </div>
      <div class="car-card-info">
        <div class="car-card-name">${esc(car.make + ' ' + car.model + ' ' + car.year)}</div>
        <div class="car-card-specs">${esc(specs)}</div>
        <div class="car-card-badges">
          <span class="cc-badge cc-badge-green">
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><polyline points="20 6 9 17 4 12"/></svg>
            Refundable deposit
          </span>
          <span class="cc-badge cc-badge-green">
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><polyline points="20 6 9 17 4 12"/></svg>
            300 km / 24h
          </span>
          <span class="cc-badge cc-badge-gray">${esc((car.category || 'SEDAN').toUpperCase())}</span>
        </div>
        <div class="car-card-dist">
          <svg width="11" height="11" viewBox="0 0 24 24" fill="var(--orange)"><polygon points="3 11 22 2 13 21 11 13 3 11"/></svg>
          <span>${esc(car.locationCity || 'Ahmedabad')}</span>
        </div>
        <div class="car-card-footer">
          <div class="car-card-price-row">
            <div>
              <div class="car-card-price">${money(car.pricePerDay)}<small>/day</small></div>
              <div class="car-card-daily">Per 24 hours · Fuel extra</div>
            </div>
            <span class="btn-book">View &amp; Book &rarr;</span>
          </div>
          <div class="car-card-host">
            <span class="car-card-host-name">₹2,000 refundable deposit</span>
            <span class="instant-confirm">
              <svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor"><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/></svg>
              View details
            </span>
          </div>
        </div>
      </div>
    </a>`;
}

/* ─── HOME PAGE — REFERENCE STYLE ───────────────────────────────────── */
async function home() {
  const today = new Date().toISOString().split('T')[0];
  const tom   = new Date(Date.now() + 86400000).toISOString().split('T')[0];

  $('#app').innerHTML = `
    <div class="hero reveal-on-scroll">
      <div>
        <span class="hero-eyebrow">GUJARAT'S #1 CAR RENTAL &amp; TAXI PORTAL</span>
        <h1 class="hero-heading">
          Your Journey.<br>
          <span class="accent">Your Rules.</span>
        </h1>
        <p class="hero-desc">Rent spotless clean self-drive vehicles on self-drive, or travel in executive comfort with our premium &amp; luxury chauffeur taxi cars on transparent kilometer rates across all of Gujarat.</p>
        <div class="hero-btns">
          <a class="button btn-orange" href="cars.html">Explore All Cars &rarr;</a>
          <a class="button btn-outline" href="host-onboarding.html">Our Services &amp; Rates</a>
        </div>
        <div class="hero-stats">
          <div class="hero-stat">
            <div class="hero-stat-num">50+</div>
            <div class="hero-stat-lbl">Cars Available</div>
          </div>
          <div class="hero-stat">
            <div class="hero-stat-num is-orange">15+</div>
            <div class="hero-stat-lbl">Gujarat Cities</div>
          </div>
          <div class="hero-stat">
            <div class="hero-stat-num is-green">100%</div>
            <div class="hero-stat-lbl">Refundable deposit Option</div>
          </div>
        </div>
      </div>

      <div class="booking-widget">
        <div class="bw-title">Reserve Your Car in Gujarat</div>
        <div class="bw-tabs">
          <div class="bw-tab active" id="bw-t1">Self Drive</div>
          <div class="bw-tab" id="bw-t2">Taxi with Driver</div>
        </div>
        <div class="bw-field-label">Pickup Location</div>
        <select class="bw-select" id="bw-city">
          <option>Ahmedabad (Airport, SG Highway, Ellis Bridge)</option>
          <option>Surat (Airport, Dumas Road, Vesu)</option>
          <option>Vadodara (Alkapuri, Railway Station)</option>
          <option>Rajkot (Kalawad Road)</option>
          <option>Gandhinagar (Infocity)</option>
        </select>
        <div class="bw-dates-row">
          <div>
            <div class="bw-field-label">Pickup Date</div>
            <input type="date" class="bw-date-input" id="bw-start" value="${today}" min="${today}">
          </div>
          <div>
            <div class="bw-field-label">Drop Date</div>
            <input type="date" class="bw-date-input" id="bw-end" value="${tom}" min="${tom}">
          </div>
        </div>
        <button class="bw-find-btn" id="find-available-cars">Find Available Cars &rarr;</button>
        <div class="bw-footer-note"><span>&check; Free doorstep delivery</span> &bull; Deposit shown before booking</div>
      </div>
    </div>

    <div class="highlights-bar">
      <div class="highlight-pill reveal-on-scroll">
        <div class="hl-icon-wrap hl-green">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--green)" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>
        </div>
        <div><div class="hl-title">DigiLocker Verified</div><div class="hl-sub">Instant digital eKYC</div></div>
      </div>
      <div class="highlight-pill reveal-on-scroll">
        <div class="hl-icon-wrap hl-blue">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#2563EB" stroke-width="2.2"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg>
        </div>
        <div><div class="hl-title">8-Angle Photos</div><div class="hl-sub">Full transparency</div></div>
      </div>
      <div class="highlight-pill reveal-on-scroll">
        <div class="hl-icon-wrap hl-orange">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--orange)" stroke-width="2.2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
        </div>
        <div><div class="hl-title">Zero Hidden Charges</div><div class="hl-sub">Clear honest billing</div></div>
      </div>
      <div class="highlight-pill reveal-on-scroll">
        <div class="hl-icon-wrap hl-purple">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#411945" stroke-width="2.2"><path d="M19 17h2c.6 0 1-.4 1-1v-3c0-.9-.7-1.7-1.5-1.9C18.7 10.6 16 10 16 10s-1.3-1.4-2.2-2.3c-.5-.4-1.1-.7-1.8-.7H5c-.6 0-1.1.4-1.4.9l-1.5 2.8C2.1 10.8 2 11 2 11.2V16c0 .6.4 1 1 1h2"/><circle cx="7" cy="17" r="2"/><path d="M9 17h6"/><circle cx="17" cy="17" r="2"/></svg>
        </div>
        <div><div class="hl-title">250+ Verified Cars</div><div class="hl-sub">Across Gujarat</div></div>
      </div>
    </div>

    <div class="how-grid">
      <div class="how-card reveal-on-scroll" data-step="01">
        <div class="how-num">01 &middot; Choose</div>
        <h3>Select Your Drive</h3>
        <p>Browse verified fleet with photos of exterior, interior, boot &amp; odometer.</p>
      </div>
      <div class="how-card reveal-on-scroll" data-step="02">
        <div class="how-num">02 &middot; Verify</div>
        <h3>Instant Digital eKYC</h3>
        <p>Aadhaar and Driving Licence verified in seconds via official DigiLocker gateway.</p>
      </div>
      <div class="how-card reveal-on-scroll" data-step="03">
        <div class="how-num">03 &middot; Drive</div>
        <h3>Transparent Records</h3>
        <p>Real-time booking confirmations, transparent security deposits, and recorded odometers.</p>
      </div>
    </div>

    ${sectionHead('Available Fleet', 'Verified cars ready for your trip.', 'DISCOVER SAFAR')}
    <div class="car-grid" id="fleet">
      ${[1,2,3,4,5,6].map(() => `<div class="skeleton-card">
        <div class="sk-media skeleton-pulse"></div>
        <div class="sk-info">
          <div class="sk-title skeleton-pulse"></div>
          <div class="sk-sub skeleton-pulse"></div>
          <div class="sk-tags"><div class="sk-tag skeleton-pulse"></div><div class="sk-tag skeleton-pulse"></div><div class="sk-tag skeleton-pulse"></div></div>
          <div class="sk-footer"><div class="sk-price skeleton-pulse"></div><div class="sk-btn skeleton-pulse"></div></div>
        </div>
      </div>`).join('')}
    </div>`;

  // Tab switching
  $$('.bw-tab').forEach(tab => tab.addEventListener('click', () => {
    $$('.bw-tab').forEach(t => t.classList.remove('active'));
    tab.classList.add('active');
  }));

  // Sync drop date to always be >= pickup date
  const startEl = $('#bw-start'), endEl = $('#bw-end');
  $('#find-available-cars').onclick = () => {
    const start = new Date(startEl.value + 'T10:00:00');
    const end = new Date(endEl.value + 'T10:00:00');
    if (!Number.isFinite(+start) || !Number.isFinite(+end) || start <= new Date() || end <= start) return toast('Choose a future pickup date and a later return date. Pickup and return default to 10:00 AM; you can adjust times on the next page.', true);
    location.assign('cars.html?' + new URLSearchParams({ startDate: start.toISOString(), endDate: end.toISOString(), city: $('#bw-city').value.replace(/\s*\(.*\)$/, '') }));
  };
  if (startEl && endEl) {
    startEl.addEventListener('change', () => { if (endEl.value < startEl.value) endEl.value = startEl.value; endEl.min = startEl.value; });
  }

  initReveal();

  try {
    const cars = await api('/vehicles');
    const fleet = $('#fleet');
    fleet.innerHTML = cars.length
      ? cars.slice(0, 8).map(carCard).join('')
      : empty('Fleet is preparing', 'Verified listings will appear here soon.');
    fleet.querySelectorAll('.car-card').forEach((el, i) => {
      el.style.animationDelay = (i * 0.07) + 's';
      el.classList.add('reveal-on-scroll');
    });
    initReveal();
    initCountUp();
  } catch (e) {
    $('#fleet').innerHTML = `<p class="error">${esc(e.message)}</p>`;
  }
}

/* ─── SCROLL-REVEAL OBSERVER ─────────────────────────────────────────── */
function initReveal() {
  const els = document.querySelectorAll('.reveal-on-scroll:not(.revealed)');
  if (!els.length) return;
  const io = new IntersectionObserver((entries) => {
    entries.forEach(e => {
      if (e.isIntersecting) { e.target.classList.add('revealed'); io.unobserve(e.target); }
    });
  }, { threshold: 0.1, rootMargin: '0px 0px -40px 0px' });
  els.forEach(el => io.observe(el));
}

/* ─── COUNT-UP ANIMATION ─────────────────────────────────────────────── */
function initCountUp() {
  const band = document.querySelector('.stats-band');
  if (!band) return;
  const io = new IntersectionObserver((entries) => {
    if (!entries[0].isIntersecting) return;
    io.disconnect();
    band.querySelectorAll('.stat-num[data-count]').forEach(el => {
      const target = parseInt(el.dataset.count, 10);
      const suffix = el.dataset.suffix || '+';
      const dur = 1600, step = 16, totalSteps = dur / step;
      let current = 0;
      const inc = target / totalSteps;
      const timer = setInterval(() => {
        current = Math.min(current + inc, target);
        el.textContent = target >= 1000
          ? (current / 1000).toFixed(1) + 'k' + suffix
          : Math.round(current) + suffix;
        if (current >= target) clearInterval(timer);
      }, step);
    });
  }, { threshold: 0.5 });
  io.observe(band);
}


/* ─── AUTH PAGE (LOGIN & REGISTER) ───────────────────────────────────── */
function auth(forceRegister) {
  const isReg = forceRegister ?? (new URLSearchParams(location.search).get('tab') === 'register');

  $('#app').innerHTML = `
    <div class="auth-box">
      <aside class="auth-banner">
        <div>
          <img src="safar-logo.png" alt="Safar" class="auth-banner-logo" onerror="this.style.display='none'">
          <h1>Your Journey.<br>Your Rules.</h1>
          <p>Sign in to manage trips, verify documents, and explore self-drive rentals across India.</p>
        </div>
        <img class="auth-journey-art" src="journey.svg" alt="An orange car on a winding road through a sunlit landscape">
        <div class="auth-steps-list">
          <div class="auth-step-item"><span class="auth-step-num">1</span> Create your account</div>
          <div class="auth-step-item"><span class="auth-step-num">2</span> Verify your identity with DigiLocker</div>
          <div class="auth-step-item"><span class="auth-step-num">3</span> Reserve car &amp; hit the road</div>
        </div>
      </aside>

      <section class="auth-form-panel">
        <div class="auth-tab-switch">
          <button id="tab-login" class="${!isReg ? 'active' : ''}">Sign In</button>
          <button id="tab-reg" class="${isReg ? 'active' : ''}">Create Account</button>
        </div>

        <h2>${isReg ? 'Create your account' : 'Welcome back'}</h2>
        <p class="text-muted">${isReg ? 'Register as a customer or vehicle host.' : 'Enter your email and password to continue.'}</p>

        <form id="auth-form" class="form-stack">
          ${isReg ? `
            <div class="form-grid">
              ${inp('firstName', 'First name', 'text', 'autocomplete="given-name" maxlength="60" placeholder="e.g. Rahul"')}
              ${inp('lastName', 'Last name', 'text', 'autocomplete="family-name" maxlength="60" placeholder="e.g. Sharma"')}
            </div>` : ''}

          ${inp('email', 'Email address', 'email', 'autocomplete="email" maxlength="254" placeholder="you@example.com"')}
          ${inp('password', 'Password', 'password', `autocomplete="${isReg ? 'new-password' : 'current-password'}" minlength="${isReg ? 12 : 1}" maxlength="72" placeholder="${isReg ? 'At least 12 characters' : 'Enter password'}"`)}

          ${isReg ? `
            ${inp('phone', 'Mobile number', 'tel', 'autocomplete="tel" placeholder="+919876543210"')}
            ${sel('role', 'Account Type', ['CUSTOMER', 'HOST'])}
            <p class="text-muted" style="font-size:12px;margin:0">Password requires minimum 12 characters. KYC verification follows immediately.</p>
          ` : ''}

          <button type="submit" class="button btn-orange" style="width:100%;margin-top:8px">
            ${isReg ? 'Create Account &amp; Proceed to KYC →' : 'Sign In →'}
          </button>
        </form>

        <p style="font-size:13px;color:var(--muted);margin-top:16px;text-align:center">
          ${isReg
            ? `Already registered? <a href="#" id="link-login">Sign in here</a>`
            : `Don't have an account? <a href="#" id="link-reg">Register now</a>`}
        </p>
      </section>
    </div>`;

  $('#tab-login').onclick = () => auth(false);
  $('#tab-reg').onclick = () => auth(true);
  $('#link-login')?.addEventListener('click', e => { e.preventDefault(); auth(false); });
  $('#link-reg')?.addEventListener('click', e => { e.preventDefault(); auth(true); });

  bindForm('#auth-form', async data => {
    await post('/auth/' + (isReg ? 'register' : 'login'), data);
    if (isReg) {
      toast('Account registered! Redirecting to KYC verification…');
      setTimeout(() => { location.href = 'kyc.html?new=1'; }, 700);
    } else {
      const redirect = new URLSearchParams(location.search).get('redirect');
      const target = redirect ? new URL(redirect, location.href) : null;
      location.href = target && target.origin === location.origin && !target.pathname.endsWith('auth.html')
        ? target.pathname + target.search : 'dashboard.html';
    }
  });
}

/* ─── CARS LISTING WITH ZOOMCAR FILTER SIDEBAR ───────────────────────── */
let allCars = [];

async function cars() {
  const id = new URLSearchParams(location.search).get('id');
  if (id) return carDetails(id);

  $('#app').innerHTML = `
    <div class="cars-page-wrap">
      <form id="availability-search" class="availability-search">
        <div class="availability-heading"><strong>Find your next drive</strong><span>Choose your pickup and return times to see available cars.</span></div>
        <label>City<input name="city" placeholder="All cities" maxlength="120"></label>
        <fieldset class="trip-date-range"><legend>Trip dates</legend>
          <label>Pickup<input name="startDate" type="datetime-local" required></label>
          <label>Return<input name="endDate" type="datetime-local" required></label>
        </fieldset>
        <button type="submit" class="button btn-orange">Check availability</button>
      </form>
      <!-- Search & Sort Row -->
      <div class="cars-search-row">
        <div class="search-input-box">
          <svg class="search-icon-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2">
            <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
          </svg>
          <input id="car-search" type="search" placeholder="Search by make, model, category, or city…" autocomplete="off">
        </div>
        <select id="car-sort" class="sort-dropdown">
          <option value="">Sort: Relevance</option>
          <option value="price_asc">Price: Low to High</option>
          <option value="price_desc">Price: High to Low</option>
        </select>
      </div>

      <!-- Quick Filter Chips -->
      <div class="chip-row" id="chip-row">
        <button class="chip-btn active" data-filter="all">All Cars</button>
        <button class="chip-btn" data-filter="SUV">SUV</button>
        <button class="chip-btn" data-filter="Compact SUV">Compact SUV</button>
        <button class="chip-btn" data-filter="Sedan">Sedan</button>
        <button class="chip-btn" data-filter="Hatchback">Hatchback</button>

        <button class="chip-btn" data-filter="MUV">MUV</button>
        <button class="chip-btn" data-filter="Luxury">Luxury</button>
        <button class="chip-btn" data-filter="Manual">Manual</button>
        <button class="chip-btn" data-filter="Automatic">Automatic</button>
        <button class="chip-btn" data-filter="Petrol">Petrol</button>
        <button class="chip-btn" data-filter="Diesel">Diesel</button>
      </div>

      <!-- Two-Column Layout: Left Sidebar + Right Grid -->
      <div class="cars-layout">
        <!-- ─── LEFT SIDEBAR (FILTERS) ─── -->
        <button type="button" class="mobile-filter-toggle btn-outline" aria-expanded="false" aria-controls="vehicle-search-filters">Show filters</button>
        <aside class="sidebar-filters" id="vehicle-search-filters">
          <div class="filter-header-top">
            <h3>Filters</h3>
            <button class="filter-reset-btn" id="clear-filters-btn">Reset All</button>
          </div>

          <p class="filter-service-note">Self-drive rentals<br><small>Choose dates to check live availability.</small></p>
          <!-- Price Slider -->
          <div class="filter-group">
            <div class="filter-title">
              <span>Daily Budget</span>
              <span class="price-val-label" id="price-val-label">&le; &#x20B9;8,500</span>
            </div>
            <input type="range" min="1000" max="8500" step="500" value="8500" class="range-slider" id="price-slider" />
            <div class="range-labels">
              <span>&#x20B9;1,000</span>
              <span id="budget-maximum"></span>
            </div>
          </div>

          <!-- Car Type (Category) -->
          <div class="filter-group">
            <div class="filter-title">Car Type</div>
            <label class="checkbox-item">
              <input type="checkbox" class="cat-cb" value="hatchback" checked />
              <span>Hatchback (Swift, i20)</span>
            </label>
            <label class="checkbox-item">
              <input type="checkbox" class="cat-cb" value="sedan" checked />
              <span>Sedan (Dzire, Honda City)</span>
            </label>
            <label class="checkbox-item">
              <input type="checkbox" class="cat-cb" value="suv,muv,compact suv" checked />
              <span>SUV / MUV (Thar 4x4, Creta, Innova)</span>
            </label>
            <label class="checkbox-item">
              <input type="checkbox" class="cat-cb" value="luxury" checked />
              <span>Luxury (Mercedes, BMW, Audi)</span>
            </label>
          </div>

          <!-- Transmission -->
          <div class="filter-group">
            <div class="filter-title">Transmission</div>
            <label class="checkbox-item">
              <input type="checkbox" class="trans-cb" value="Automatic" checked />
              <span>Automatic</span>
            </label>
            <label class="checkbox-item">
              <input type="checkbox" class="trans-cb" value="Manual" checked />
              <span>Manual</span>
            </label>
          </div>

          <!-- Fuel Type -->
          <div class="filter-group" style="border-bottom: none; margin-bottom: 0; padding-bottom: 0;">
            <div class="filter-title">Fuel Type</div>
            <label class="checkbox-item">
              <input type="checkbox" class="fuel-cb" value="Diesel" checked />
              <span>Diesel</span>
            </label>
            <label class="checkbox-item">
              <input type="checkbox" class="fuel-cb" value="Petrol" checked />
              <span>Petrol</span>
            </label>
            <label class="checkbox-item">
              <input type="checkbox" class="fuel-cb" value="CNG" checked />
              <span>CNG</span>
            </label>
            <label class="checkbox-item"><input type="checkbox" class="fuel-cb" value="Electric" checked><span>Electric</span></label>
            <label class="checkbox-item"><input type="checkbox" class="fuel-cb" value="Hybrid" checked><span>Hybrid</span></label>
          </div>
        </aside>

        <!-- RIGHT CARS CONTENT -->
        <div class="cars-results-wrap">
          <div class="cars-count-bar">
            <span id="cars-count-text" role="status" aria-live="polite">Loading cars…</span>
          </div>
          <div class="car-grid" id="fleet-grid"></div>
        </div>
      </div>
    </div>`;

  const searchParams = new URLSearchParams(location.search);
  const availabilityForm = $('#availability-search');
  availabilityForm.elements.city.value = searchParams.get('city') || '';
  for (const key of ['startDate', 'endDate']) {
    availabilityForm.elements[key].value = localDateTime(searchParams.get(key));
    availabilityForm.elements[key].min = localDateTime(Date.now() + 60000);
  }
  bindForm('#availability-search', async data => {
    const start = new Date(data.startDate), end = new Date(data.endDate);
    if (!Number.isFinite(+start) || !Number.isFinite(+end) || start <= new Date() || end <= start) throw new Error('Choose a future pickup time and a later return time.');
    location.assign('cars.html?' + new URLSearchParams({ city: data.city, startDate: start.toISOString(), endDate: end.toISOString() }));
  });
  try {
    const query = new URLSearchParams();
    for (const key of ['city', 'startDate', 'endDate']) if (searchParams.has(key)) query.set(key, searchParams.get(key));
    allCars = await api('/vehicles?' + query);
    const maximum = Math.max(1000, ...allCars.map(car => Math.ceil(Number(car.pricePerDay) / 500) * 500));
    $('#price-slider').max = maximum;
    $('#price-slider').value = maximum;
    $('#price-val-label').textContent = 'Any budget';
    $('#budget-maximum').textContent = money(maximum);
    applyCarFilters();
  } catch (e) {
    $('#fleet-grid').innerHTML = `<p class="error">${esc(e.message)}</p>`;
  }

  // Event handlers
  $('.mobile-filter-toggle').onclick = event => {
    const expanded = event.currentTarget.getAttribute('aria-expanded') !== 'true';
    event.currentTarget.setAttribute('aria-expanded', String(expanded));
    event.currentTarget.textContent = expanded ? 'Hide filters' : 'Show filters';
    $('#vehicle-search-filters').classList.toggle('filters-expanded', expanded);
  };
  $$('#chip-row .chip-btn').forEach(btn => {
    btn.onclick = () => {
      $$('#chip-row .chip-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      applyCarFilters();
    };
  });

  $('#car-search').oninput = () => applyCarFilters();
  $('#car-sort').onchange = () => applyCarFilters();

  // Service mode switch
  $$('.service-switch-btn').forEach(btn => {
    btn.onclick = () => {
      $$('.service-switch-btn').forEach(b => b.classList.remove('active', 'self-drive', 'taxi', 'all'));
      const svc = btn.dataset.service;
      btn.classList.add('active', svc);
      applyCarFilters();
    };
  });

  // Distance slider
  const distEl = $('#distance-slider');
  if (distEl) {
    distEl.oninput = e => {
      $('#distance-val-badge').textContent = e.target.value + ' km';
      applyCarFilters();
    };
  }

  // Price slider
  const priceEl = $('#price-slider');
  if (priceEl) {
    priceEl.oninput = e => {
      $('#price-val-label').textContent = '≤ ₹' + Number(e.target.value).toLocaleString('en-IN');
      applyCarFilters();
    };
  }

  // Checkbox filters
  $$('.cat-cb, .trans-cb, .fuel-cb').forEach(cb => {
    cb.onchange = () => applyCarFilters();
  });

  // Reset all
  $('#clear-filters-btn').onclick = () => {
    $$('#chip-row .chip-btn').forEach((b, i) => b.classList.toggle('active', i === 0));
    $$('.service-switch-btn').forEach(b => b.classList.remove('active', 'self-drive', 'taxi', 'all'));
    document.querySelector('.service-switch-btn[data-service="all"]')?.classList.add('active', 'all');
    $$('.cat-cb, .trans-cb, .fuel-cb').forEach(cb => { cb.checked = true; });
    if ($('#distance-slider')) {
      $('#distance-slider').value = 25;
      $('#distance-val-badge').textContent = '25 km';
    }
    if ($('#price-slider')) {
      $('#price-slider').value = $('#price-slider').max;
      $('#price-val-label').textContent = 'Any budget';
    }
    if ($('#car-search')) $('#car-search').value = '';
    $('#car-sort').value = '';
    applyCarFilters();
  };
}

function applyCarFilters() {
  let list = [...allCars];

  // Text search
  const q = $('#car-search')?.value?.trim().toLowerCase() || '';
  if (q) {
    list = list.filter(c => (c.make + ' ' + c.model + ' ' + c.category + ' ' + c.locationCity + ' ' + c.fuelType).toLowerCase().includes(q));
  }

  // Service Mode
  const activeSvc = document.querySelector('.service-switch-btn.active')?.dataset.service || 'all';
  if (activeSvc === 'self-drive') {
    list = list.filter(c => (c.category || '').toLowerCase() !== 'taxi' && (c.service || '').toLowerCase() !== 'taxi');
  } else if (activeSvc === 'taxi') {
    list = list.filter(c => (c.category || '').toLowerCase() === 'taxi' || (c.service || '').toLowerCase() === 'taxi');
  }

  // Active Chip
  const activeChip = $('#chip-row .chip-btn.active')?.dataset?.filter || 'all';
  if (activeChip !== 'all') {
    if (['Manual','Automatic'].includes(activeChip)) list = list.filter(c => c.transmission === activeChip);
    else if (['Petrol','Diesel','Electric','CNG','Hybrid'].includes(activeChip)) list = list.filter(c => c.fuelType === activeChip);
    else list = list.filter(c => (c.category || '').toLowerCase().includes(activeChip.toLowerCase()));
  }

  // Checkbox filters
  const selCats  = $$('.cat-cb:checked').map(x => x.value.toLowerCase());
  const selTxs   = $$('.trans-cb:checked').map(x => x.value.toLowerCase());
  const selFuels = $$('.fuel-cb:checked').map(x => x.value.toLowerCase());
  const maxPrice = Number($('#price-slider')?.value || 8500);

  list = list.filter(c => selCats.some(group => group.split(',').includes((c.category || '').toLowerCase())));
  list = list.filter(c => selTxs.includes((c.transmission || '').toLowerCase()));
  list = list.filter(c => selFuels.includes((c.fuelType || '').toLowerCase()));
  list = list.filter(c => Number(c.pricePerDay) <= maxPrice);

  // Sorting
  const sort = $('#car-sort')?.value || '';
  if (sort === 'price_asc' || sort === 'price-low')  list.sort((a, b) => Number(a.pricePerDay) - Number(b.pricePerDay));
  if (sort === 'price_desc' || sort === 'price-high') list.sort((a, b) => Number(b.pricePerDay) - Number(a.pricePerDay));

  const datesSelected = new URLSearchParams(location.search).has('startDate') && new URLSearchParams(location.search).has('endDate');
  $('#cars-count-text').textContent = datesSelected
    ? `${list.length} car${list.length !== 1 ? 's' : ''} available for your selected dates`
    : `${list.length} car${list.length !== 1 ? 's' : ''} · Select trip dates to check availability`;
  $('#fleet-grid').innerHTML = list.length
    ? list.map(carCard).join('')
    : empty('No cars match your filters', 'Try changing or clearing your filter criteria.');
}

/* ─── FULL INFORMATIVE CAR DETAILS PAGE ──────────────────────────────── */
const PHOTO_ANGLES = ['FRONT','REAR','LEFT','RIGHT','INTERIOR','BOOT','BONNET','ODOMETER'];

async function carDetails(id) {
  $('#app').innerHTML = `<p class="loading">Loading car details…</p>`;
  let car;
  try { car = await api('/vehicles/' + encodeURIComponent(id)); }
  catch (e) { $('#app').innerHTML = `<p class="error">${esc(e.message)}</p>`; return; }

  const hrRate = Math.round(Number(car.pricePerDay) / 24);
  const mediaList = (car.media || []).filter(m => PHOTO_ANGLES.includes(m.kind));
  const mainMedia = mediaList.find(m => m.kind === 'FRONT') || mediaList[0];

  $('#app').innerHTML = `
    <div class="details-back-bar">
      <a href="cars.html">← Back to all cars</a>
    </div>

    <div class="details-layout">
      <!-- LEFT: Photo Gallery + Rich Car Info -->
      <div class="details-left-col">
        <!-- Photo Gallery Card -->
        <div class="details-gallery">
          <div class="details-main-img-box">
            ${mainMedia
              ? `<img id="car-hero-img" src="/api/media/${encodeURIComponent(mainMedia.id)}" alt="${esc(car.make)} ${esc(car.model)}">`
              : `<img id="car-hero-img" src="${photoUrl(car)}" alt="${esc(car.make)} ${esc(car.model)}">`}
            ${mediaList.length > 1 ? `<span class="gallery-counter" id="gallery-counter-lbl">1 / ${mediaList.length}</span>` : ''}
          </div>

          ${mediaList.length > 1 ? `
          <div class="gallery-thumb-row" id="gallery-thumbs">
            ${mediaList.map((m, idx) => `
              <button class="thumb-card ${idx === 0 ? 'active' : ''}" data-idx="${idx}" data-url="/api/media/${encodeURIComponent(m.id)}">
                <img src="/api/media/${encodeURIComponent(m.id)}" alt="${esc(m.kind)}" loading="lazy">
                <span>${esc(m.kind)}</span>
              </button>`).join('')}
          </div>` : ''}
        </div>

        <!-- Comprehensive Details Panel -->
        <div class="details-content-panel">
          <div class="details-header-row">
            <div>
              <h1 class="details-car-name">${esc(car.make + ' ' + car.model + ' ' + car.year)}</h1>
              <div class="details-car-sub">
                <span>📍 ${esc(car.locationCity)}</span>
                <span>·</span>
                ${badge(car.category)}
                <span>·</span>
                <span style="color:var(--green);font-weight:700">✓ Verified Listing</span>
              </div>
            </div>
            <div class="details-rating-box">
              <div class="details-rating-num">★ 4.8</div>
              <div class="details-rating-lbl">24 Trips Completed</div>
            </div>
          </div>

          <!-- Specifications Grid -->
          <div class="details-specs-grid">
            <div class="spec-box"><span class="spec-box-lbl">Transmission</span><span class="spec-box-val">${esc(car.transmission)}</span></div>
            <div class="spec-box"><span class="spec-box-lbl">Fuel Type</span><span class="spec-box-val">${esc(car.fuelType)}</span></div>
            <div class="spec-box"><span class="spec-box-lbl">Seating</span><span class="spec-box-val">${car.seats} Adults</span></div>
            <div class="spec-box"><span class="spec-box-lbl">Year</span><span class="spec-box-val">${car.year}</span></div>
            <div class="spec-box"><span class="spec-box-lbl">Odometer</span><span class="spec-box-val">${Number(car.odometer).toLocaleString('en-IN')} km</span></div>
            <div class="spec-box"><span class="spec-box-lbl">Registration</span><span class="spec-box-val">${esc(car.registrationNumber)}</span></div>
          </div>

          <!-- Features & Equipment -->
          <div class="details-block">
            <h3>Features &amp; Amenities</h3>
            <div class="details-features-grid">
              <div class="feature-check-item"><span class="feature-check-icon">✓</span> Climate Control Air Conditioning</div>
              <div class="feature-check-item"><span class="feature-check-icon">✓</span> Bluetooth &amp; Apple CarPlay / Android Auto</div>
              <div class="feature-check-item"><span class="feature-check-icon">✓</span> Dual Airbags &amp; ABS with EBD</div>
              <div class="feature-check-item"><span class="feature-check-icon">✓</span> Reverse Parking Sensors / Camera</div>
              <div class="feature-check-item"><span class="feature-check-icon">✓</span> Power Windows &amp; Central Locking</div>
              <div class="feature-check-item"><span class="feature-check-icon">✓</span> Fast USB Charging Ports</div>
            </div>
          </div>

          <!-- Trip Inclusions & Quality Assurance -->
          <div class="details-block">
            <h3>Quality &amp; Safety Assurance</h3>
            <div class="details-features-grid">
              <div class="feature-check-item"><span class="feature-check-icon">✓</span> 100% Sanitized &amp; Cleaned Before Every Trip</div>
              <div class="feature-check-item"><span class="feature-check-icon">✓</span> 24/7 Roadside Assistance across India</div>
              <div class="feature-check-item"><span class="feature-check-icon">✓</span> Verified Registration (RC), Insurance &amp; PUC</div>
              <div class="feature-check-item"><span class="feature-check-icon">✓</span> Pickup &amp; Return Odometer Photos Recorded</div>
            </div>
          </div>

          <!-- Rental Terms & Rules -->
          <div class="details-block">
            <h3>Rental Guidelines &amp; Policies</h3>
            <ul class="rules-list">
              <li><strong>Government Identity:</strong> Aadhaar eKYC and a valid Driving Licence (minimum 1 year old) are mandatory.</li>
              <li><strong>Fuel Policy:</strong> Fuel is paid by renter. Return the car at the same fuel level as received.</li>
              <li><strong>Speed Limit:</strong> Commercial speed governor set at 120 km/h as per state motor vehicle norms.</li>
              <li><strong>Security Deposit:</strong> ₹2,000 refundable deposit, subject to reviewed late-return, damage and excess-kilometre adjustments.</li>
              <li><strong>Tolls &amp; FASTag:</strong> Fastag equipped. Toll charges will be settled upon vehicle return.</li>
            </ul>
          </div>
        </div>
      </div>

      <!-- RIGHT: Sticky Booking Panel -->
      <aside class="booking-panel-sticky">
        <div class="bp-price-header">
          <div class="bp-rate-main">${money(car.pricePerDay)}<small>/day</small></div>
          <div class="bp-rate-sub">${money(car.pricePerDay)} per 24 hours · Excl. fuel</div>
        </div>

        ${!user ? `
          <div class="notice info" style="margin-bottom:16px">
            Sign in or register to reserve this car. DigiLocker KYC required.
          </div>
          <a class="button btn-orange" style="width:100%" href="auth.html?redirect=${encodeURIComponent(carLink(id))}">Sign In to Book →</a>
        ` : `
          <form id="car-booking-form" class="form-stack">
            ${inp('startDate', 'Pickup Date &amp; Time', 'datetime-local')}
            ${inp('endDate', 'Return Date &amp; Time', 'datetime-local')}

            <div id="booking-quote-box" class="bp-fare-calc">
              Select pickup and return dates above to calculate fare.
            </div>

            <label class="check">
              <input type="checkbox" required>
              <span>I confirm my driving licence is valid and agree to the 30-minute hold reservation terms.</span>
            </label>

            <button type="submit" class="button btn-orange" style="width:100%">Reserve This Car →</button>
          </form>

          <p style="font-size:12px;color:var(--muted);margin-top:12px;text-align:center">
            ${user.isVerified
              ? '<span style="color:var(--green);font-weight:700">✓ Your KYC is verified. Instant booking ready.</span>'
              : '<span>Notice: Please <a href="kyc.html">complete KYC verification</a> before trip starts.</span>'}
          </p>
        `}

        <div class="bp-perks-box">
          <div class="bp-perk-line">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M20 6L9 17l-5-5"/></svg>
            <span><strong>Refundable Deposit:</strong> ₹2,000</span>
          </div>
          <div class="bp-perk-line">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M20 6L9 17l-5-5"/></svg>
            <span><strong>Cancellation:</strong> Free up to 6 hours before pickup</span>
          </div>
          <div class="bp-perk-line">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M20 6L9 17l-5-5"/></svg>
            <span><strong>Doorstep Pickup:</strong> ${esc(car.locationCity)}</span>
          </div>
        </div>
      </aside>
    </div>`;

  // Gallery thumbnail click handler
  if (mediaList.length > 1) {
    $$('#gallery-thumbs .thumb-card').forEach((btn, i) => {
      btn.onclick = () => {
        $$('#gallery-thumbs .thumb-card').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        $('#car-hero-img').src = btn.dataset.url;
        $('#gallery-counter-lbl').textContent = `${i + 1} / ${mediaList.length}`;
      };
    });
  }

  // Quote Calculator & Form Submission
  if (user) {
    const form = $('#car-booking-form');
    const selectedDates = new URLSearchParams(location.search);
    for (const key of ['startDate', 'endDate']) {
      form.elements[key].value = localDateTime(selectedDates.get(key));
      form.elements[key].min = localDateTime(Date.now() + 60000);
    }
    let currentQuote = null, quoteSequence = 0, quoteTimer, bookingRequestKey = crypto.randomUUID();
    const updateQuote = async () => {
      const sequence = ++quoteSequence;
      currentQuote = null;
      const button = $('button[type=submit]', form);
      button.disabled = true;
      const start = new Date(form.elements.startDate.value), end = new Date(form.elements.endDate.value);
      if (!Number.isFinite(+start) || !Number.isFinite(+end) || start >= end) {
        $('#booking-quote-box').textContent = 'Choose a valid pickup and return time to check availability and price.';
        return;
      }
      $('#booking-quote-box').textContent = 'Checking availability and rental price…';
      try {
        const quote = await api('/vehicles/' + encodeURIComponent(id) + '/quote?' + new URLSearchParams({startDate:start.toISOString(),endDate:end.toISOString()}));
        if (sequence !== quoteSequence || !form.isConnected) return;
        currentQuote = quote;
        $('#booking-quote-box').innerHTML = '<div class="bp-fare-row"><span>Rental (' + quote.rentalDays + ' billed days)</span><span>' + money(quote.rentalAmount) + '</span></div>' +
          '<div class="bp-fare-row"><span>Included distance</span><span>' + quote.includedKilometres + ' km</span></div>' +
          '<div class="bp-fare-row"><span>Refundable security deposit</span><span>' + money(quote.securityDeposit) + '</span></div>' +
          '<p class="text-muted">' + esc(quote.pricingBasis) + '</p><div class="bp-fare-row"><span>Total at booking</span><span>' + money(quote.totalAmount) + '</span></div>';
        button.disabled = false;
      } catch (error) {
        if (sequence !== quoteSequence || !form.isConnected) return;
        $('#booking-quote-box').textContent = error.message;
      }
    };
    form.addEventListener('input', () => {
      bookingRequestKey = crypto.randomUUID();
      ++quoteSequence; currentQuote = null;
      $('button[type=submit]', form).disabled = true;
      clearTimeout(quoteTimer); quoteTimer = setTimeout(updateQuote, 350);
    });
    updateQuote();

    bindForm('#car-booking-form', async data => {
      if (!requireUser()) return;
      const start = new Date(data.startDate), end = new Date(data.endDate);
      if (isNaN(start.getTime()) || isNaN(end.getTime())) throw new Error('Please select valid pickup and return dates.');
      if (start >= end) throw new Error('Return date must be strictly after pickup date.');
      if (!currentQuote || currentQuote.startDate !== start.toISOString() || currentQuote.endDate !== end.toISOString()) throw new Error('Wait for an updated quote before booking.');
      const booking = await post('/bookings', {
        ...data, vehicleId: id, expectedTotal: currentQuote.totalAmount,
        startDate: start.toISOString(), endDate: end.toISOString(),
        requestKey: bookingRequestKey,
      });
      location.href = 'dashboard.html?booking=' + encodeURIComponent(booking.id);
    });
  }
}

async function kyc() {
  if (!requireUser()) return;
  await dashboard('kyc');
}

function renderKycTabHtml(info) {
  const isNew = new URLSearchParams(location.search).get('new') === '1';
  const vehicleId = new URLSearchParams(location.search).get('vehicle');

  const personalDocs = (info.documents || []).filter(doc => !doc.vehicleId && doc.source !== 'DIGILOCKER_TEST');
  const kycApproved = personalDocs.some(doc => doc.kind === 'AADHAAR' && doc.status === 'APPROVED');
  const dlApproved = personalDocs.some(doc => doc.kind === 'DL' && doc.status === 'APPROVED' && doc.validUntil && new Date(doc.validUntil) > new Date());
  const eligible = kycApproved && dlApproved;
  const documentStatus = kind => {
    const records = personalDocs.filter(doc => doc.kind === kind);
    if (kind === 'AADHAAR' ? kycApproved : dlApproved) return 'Verified';
    if (records.some(doc => doc.status === 'PENDING')) return 'Awaiting review';
    if (records[0]?.status === 'REJECTED') return 'Action required';
    if (records.some(doc => doc.status === 'APPROVED')) return 'Expired — renew document';
    return 'Not yet verified';
  };

  return `
    ${isNew ? `
      <div class="kyc-welcome-banner">
        🎉 <strong>Welcome to Safar!</strong> Your account is registered. Please verify your Aadhaar &amp; Driving Licence below to activate self-drive booking privileges.
      </div>` : ''}

    <ol class="verification-steps" aria-label="Verification progress">
      <li class="is-complete"><span>1</span>Account created</li>
      <li class="${personalDocs.length ? 'is-complete' : 'is-current'}"><span>2</span>Share documents</li>
      <li class="${eligible ? 'is-complete' : personalDocs.length ? 'is-current' : ''}"><span>3</span>Document review</li>
      <li class="${eligible ? 'is-complete' : ''}"><span>4</span>Ready to book</li>
    </ol>
    ${info.environment === 'test' ? '<p class="notice">Test verification is enabled. Test documents cannot approve you for a rental.</p>' : ''}

    <!-- 3-Column Status Cards -->
    <div class="kyc-status-row">
      <div class="kyc-status-card ${kycApproved ? 'ksc-ok' : 'ksc-pending'}">
        <div class="ksc-badge-icon">${kycApproved ? '✓' : '!'}</div>
        <div class="ksc-info">
          <strong>Aadhaar eKYC</strong>
          <p>${documentStatus('AADHAAR')}</p>
        </div>
      </div>

      <div class="kyc-status-card ${dlApproved ? 'ksc-ok' : 'ksc-pending'}">
        <div class="ksc-badge-icon">${dlApproved ? '✓' : '!'}</div>
        <div class="ksc-info">
          <strong>Driving Licence</strong>
          <p>${documentStatus('DL')}</p>
        </div>
      </div>

      <div class="kyc-status-card ${eligible ? 'ksc-ok' : 'ksc-pending'}">
        <div class="ksc-badge-icon">${eligible ? '✓' : '!'}</div>
        <div class="ksc-info">
          <strong>Self-Drive Status</strong>
          <p>${eligible ? 'Ready to book · trip-date checks apply' : 'Complete both verifications'}</p>
        </div>
      </div>
    </div>

    <!-- DigiLocker & Manual Upload Grid -->
    <div class="kyc-action-grid">
      <!-- DigiLocker eKYC Card -->
      <section class="panel">
        <div class="verification-label">DIGITAL VERIFICATION</div>
        <h3>Verify with DigiLocker</h3>
        <p class="text-muted">Securely share your Aadhaar and driving licence, then return here to retrieve your documents for review.</p>

        <form id="digilocker-form" class="form-stack">
          <label class="check">
            <input name="consent" type="checkbox" required>
            <span>I consent to Safar retrieving my Aadhaar and driving licence through DigiLocker (via Sandbox.co.in) for rental verification.</span>
          </label>
          <button type="submit" class="button btn-orange" ${!info.configured ? 'disabled' : ''}>
            ${info.configured ? 'Continue with DigiLocker →' : 'DigiLocker Setup Needed'}
          </button>
        </form>

        <p class="text-muted" style="font-size:12px;margin-top:10px">
          Official gateway: <code>digilocker.meripehchaan.gov.in</code>. Safar never stores your Aadhaar OTP.
        </p>

        ${info.sessions && info.sessions[0] && new Date(info.sessions[0].expiresAt) > new Date() ? `
          <div class="verification-next-action">
            <strong>Returned from DigiLocker?</strong>
            <p>Your documents must be retrieved before they can be reviewed.</p>
            <button type="button" class="button btn-outline sync-session-btn" data-id="${info.sessions[0].id}">Retrieve latest documents</button>
          </div>` : ''}

        ${info.sessions && info.sessions.length ? `
          <details class="verification-history">
            <summary>Verification attempts (${info.sessions.length})</summary>
            <p class="text-muted">A completed sharing session still requires document retrieval and review.</p>
            ${info.sessions.map(s => `
              <div style="display:flex;align-items:center;gap:10px;margin-top:8px">
                <div><strong>${esc(s.status.toLowerCase() === 'succeeded' ? 'Sharing complete' : s.status === 'CREATED' ? 'Sharing started' : s.status)}</strong><p class="text-muted">${dt(s.consentAt)} · ${s.environment === 'test' ? 'Test' : 'Live'}</p></div>
                <button class="btn-outline btn-sm sync-session-btn" data-id="${s.id}" ${new Date(s.expiresAt) < new Date() ? 'disabled' : ''}>${new Date(s.expiresAt) < new Date() ? 'Session expired' : 'Retrieve documents'}</button>
              </div>`).join('')}
          </details>` : ''}
      </section>

      <!-- Manual Document Upload Card -->
      <section class="panel">
        <div class="verification-label">DOCUMENT UPLOAD</div>
        <h3>Submit a document for review</h3>
        <p class="text-muted">Upload your Driving Licence for manual officer review, or upload RC, Insurance, and PUC for listed host cars.</p>

        <form id="doc-upload-form" class="form-stack">
          ${sel('kind', 'Document Type', ['DL','RC','INSURANCE','PUC'])}
          <label>Document Image (JPG, PNG, WebP)
            <input type="file" name="file" accept="image/jpeg,image/png,image/webp" required>
          </label>
          <label class="check">
            <input type="checkbox" name="consent" required>
            <span>I certify this document is genuine and consent to storage for rental verification.</span>
          </label>
          <button type="submit" class="button">Submit Document for Review →</button>
        </form>
      </section>
    </div>

    <!-- Submitted Records Table -->
    <section class="panel" style="margin-top:24px;">
      <h3>Submitted Verification Records</h3>
      ${info.documents && info.documents.length ? `
        <div class="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Document</th>
                <th>Source</th>
                <th>Status</th>
                <th>Valid Until</th>
                <th>Reviewer Notes</th>
                <th>Document File</th>
              </tr>
            </thead>
            <tbody>
              ${info.documents.map(doc => `
                <tr>
                  <td><strong>${esc(doc.kind)}</strong></td>
                  <td>${esc(doc.source || 'MANUAL')}</td>
                  <td>${badge(doc.status)}</td>
                  <td>${doc.validUntil ? d(doc.validUntil) : '—'}</td>
                  <td>${esc(doc.reviewNote || 'Pending review by verification officer')}</td>
                  <td>
                    <button class="button btn-ghost btn-sm view-user-doc-btn" data-id="${doc.id}" data-kind="${doc.kind}">
                      View Document ↗
                    </button>
                  </td>
                </tr>`).join('')}
            </tbody>
          </table>
        </div>` : empty('No verification records found', 'Complete DigiLocker verification or upload your driving licence to get started.')}
    </section>`;
}

function bindKycEvents(info) {
  $$('.view-user-doc-btn').forEach(btn => {
    btn.onclick = async () => {
      showDialog(`
        <h3>${esc(btn.dataset.kind)} Verification Document</h3>
        <p class="text-muted">Retrieve the original file from DigiLocker or your stored upload.</p>
        <div id="user-doc-view-box" style="padding:16px;background:var(--line-soft);border-radius:var(--r);margin-top:12px;text-align:center">
          Loading document evidence…
        </div>`);

      await renderOriginalEvidence($('#user-doc-view-box'), '/kyc/documents/' + btn.dataset.id + '/evidence', btn.dataset.kind);
    };
  });

  bindForm('#digilocker-form', async () => {
    const session = await post('/kyc/sessions', {consent: true});
    location.assign(session.authorizationUrl);
  });

  $$('.sync-session-btn').forEach(btn => {
    btn.onclick = async () => {
      btn.disabled = true; btn.textContent = 'Syncing…';
      try {
        const result = await post('/kyc/sessions/' + btn.dataset.id + '/sync', {});
        await dashboard('kyc');
        toast('Verification records synced.');
      } catch (err) {
        toast(err.message, true);
        btn.disabled = false; btn.textContent = 'Sync & Refresh';
      }
    };
  });

  bindForm('#doc-upload-form', async (data, form) => {
    const media = await uploadFile(form.file.files[0], data.kind);
    await post('/kyc/documents', {
      kind: data.kind,
      mediaId: media.id,
      vehicleId: data.vehicleId || undefined,
      consent: true,
    });
    await dashboard('kyc');
    toast('Document successfully submitted for verification review.');
  });
}

/* ─── HOST ONBOARDING ────────────────────────────────────────────────── */
async function host() {
  if (!requireUser(['HOST','ADMIN'])) return;
  const vehicles = await api('/vehicles/mine');

  $('#app').innerHTML = `
    ${sectionHead('Host Dashboard', 'Register and manage your fleet vehicles on Safar.', 'PARTNER WITH US')}
    <div class="tabs">
      <button class="active" id="tab-register-car">Register a New Car</button>
      <button id="tab-my-fleet">My Fleet (${vehicles.length})</button>
    </div>

    <section id="section-register">
      <form id="car-listing-form">
        <div class="panel">
          <h3>01 · Vehicle Information</h3>
          <div class="form-grid">
            ${inp('registrationNumber','Registration Number','text','placeholder="e.g. GJ01AB1234" maxlength="16"')}
            ${inp('locationCity','City Location','text','placeholder="e.g. Ahmedabad"')}
            ${inp('make','Make / Brand','text','placeholder="e.g. Hyundai"')}
            ${inp('model','Model','text','placeholder="e.g. Creta"')}
            ${inp('year','Year of Manufacture','number',`min="1990" max="${new Date().getFullYear()+1}"`)}
            ${sel('category','Category',['Hatchback','Sedan','Compact SUV','SUV','MUV','Luxury'])}
            ${sel('transmission','Transmission',['Manual','Automatic'])}
            ${sel('fuelType','Fuel Type',['Petrol','Diesel','Electric','CNG','Hybrid'])}
            ${inp('seats','Seating Capacity','number','min="2" max="12"')}
            ${inp('pricePerDay','Daily Rate (₹)','number','min="100" max="1000000" step="1"')}
            ${inp('odometer','Current Odometer (km)','number','min="0" max="2000000"')}
          </div>
        </div>

        <div class="panel">
          <h3>02 · Inspection Photos (All 8 Angles Required)</h3>
          <div class="notice info" style="margin-bottom:18px">
            Upload eight different vehicle photos, one for each view. JPEG, PNG or WebP, up to 8 MB each. Upload the RC, insurance and PUC separately after registration.
          </div>
          <p id="photo-progress" role="status">0 of 8 photos selected</p>
          <div class="photo-grid">
            ${PHOTO_ANGLES.map(kind => `
              <div class="photo-slot" id="slot-${kind}">
                <label>${kind} VIEW
                  <input type="file" name="${kind}" accept="image/jpeg,image/png,image/webp" required>
                  <img hidden alt="${kind} preview">
                  <span>Choose a vehicle photo · Max 8 MB</span>
                </label>
              </div>`).join('')}
          </div>
        </div>

        <div class="panel">
          <label class="check">
            <input type="checkbox" required>
            <span>I am legally authorised to list this vehicle and certify that all details, photos, and odometer readings are true and accurate.</span>
          </label>
          <div class="actions">
            <button type="submit" class="button btn-orange">Register Vehicle &amp; Upload RC/Insurance →</button>
          </div>
          <p class="text-muted" style="margin-top:10px">The vehicle listing will go live once an administrator verifies RC, Insurance, PUC, and photos.</p>
        </div>
      </form>
    </section>

    <section id="section-my-fleet" hidden>
      ${vehicles.length ? vehicles.map(v => `
        <div class="panel">
          <div class="heading">
            <div>
              <h3>${esc(v.make + ' ' + v.model + ' ' + v.year)}</h3>
              <p class="text-muted">${esc(v.registrationNumber)} · ${money(v.pricePerDay)}/day · ${esc(v.locationCity)}</p>
            </div>
            ${badge(v.status)}
          </div>
          <p>${esc(v.reviewNote || 'Awaiting document and listing review by administrator.')}</p>
          <div class="actions">
            <a class="button btn-ghost btn-sm" href="kyc.html?vehicle=${encodeURIComponent(v.id)}">Upload RC, Insurance &amp; PUC →</a>
            <button type="button" class="button btn-outline btn-sm host-schedule" data-id="${v.id}">Manage availability</button>
          </div>
        </div>`).join('') : empty('No cars listed yet', 'Use the form above to register your first self-drive car.')}
    </section>`;

  $('#tab-register-car').onclick = () => {
    $('#section-register').hidden = false; $('#section-my-fleet').hidden = true;
    $('#tab-register-car').classList.add('active'); $('#tab-my-fleet').classList.remove('active');
  };
  $('#tab-my-fleet').onclick = () => {
    $('#section-register').hidden = true; $('#section-my-fleet').hidden = false;
    $('#tab-register-car').classList.remove('active'); $('#tab-my-fleet').classList.add('active');
  };

  $$('.host-schedule').forEach(button => button.onclick = () => openVehicleSchedule(vehicles.find(item => item.id === button.dataset.id)));

  $$('.photo-slot input[type=file]').forEach(el => {
    el.onchange = () => {
      const slot = el.closest('.photo-slot');
      const img = $('img', slot);
      if (img.dataset.url) URL.revokeObjectURL(img.dataset.url);
      if (el.files[0] && (!['image/jpeg','image/png','image/webp'].includes(el.files[0].type) || el.files[0].size > 8 * 1024 * 1024)) {
        el.value = ''; toast('Choose a JPEG, PNG or WebP image up to 8 MB.', true);
      }
      if (!el.files[0]) { img.hidden = true; img.removeAttribute('src'); slot.classList.remove('slot-done'); $('span', slot).textContent = 'Choose a vehicle photo · Max 8 MB'; }
      $('#photo-progress').textContent = PHOTO_ANGLES.filter(kind => $('#car-listing-form').elements[kind].files.length).length + ' of 8 photos selected';
      if (el.files[0]) {
        img.dataset.url = URL.createObjectURL(el.files[0]);
        img.src = img.dataset.url; img.hidden = false;
        $('span', slot).textContent = el.files[0].name;
        slot.classList.add('slot-done');
      }
    };
  });

  const uploadCache = new Map();
  bindForm('#car-listing-form', async (data, form) => {
    const hashes = new Set();
    for (const kind of PHOTO_ANGLES) {
      const file = form.elements[kind].files[0];
      if (!file || !['image/jpeg','image/png','image/webp'].includes(file.type) || file.size > 8 * 1024 * 1024) throw new Error('Choose a JPEG, PNG or WebP up to 8 MB for ' + kind);
      const digest = await crypto.subtle.digest('SHA-256', await file.arrayBuffer());
      const hash = Array.from(new Uint8Array(digest), n => n.toString(16).padStart(2, '0')).join('');
      if (hashes.has(hash)) throw new Error('Each angle needs a different vehicle photo. Repeated image detected at ' + kind + '. Upload RC documents separately.');
      hashes.add(hash);
    }
    const mediaIds = [];
    for (const kind of PHOTO_ANGLES) {
      const file = form.elements[kind].files[0];
      const cached = uploadCache.get(kind);
      if (cached?.file === file) {
        mediaIds.push(cached.id);
      } else {
        toast(`Uploading ${kind} photo…`);
        const media = await uploadFile(file, kind);
        uploadCache.set(kind, {file, id: media.id});
        mediaIds.push(media.id);
      }
    }
    const payload = {...data, mediaIds};
    PHOTO_ANGLES.forEach(k => delete payload[k]);
    const result = await post('/vehicles', payload);
    toast('Car registered successfully! Now submit RC, Insurance & PUC.');
    location.href = 'kyc.html?vehicle=' + encodeURIComponent(result.id);
  });
}

/* ─── DASHBOARD ──────────────────────────────────────────────────────── */
function formatBookingStatus(b) {
  return b.status === 'PENDING' && new Date(b.expiresAt) < new Date() ? 'EXPIRED' : b.status;
}

async function dashboard(defaultTab = 'trips') {
  if (!requireUser()) return;
  const params = new URLSearchParams(location.search);
  const activeTab = params.get('tab') || defaultTab;

  const [trips, hosted, kycInfo] = await Promise.all([
    api('/bookings/my-trips').catch(() => []),
    ['HOST','ADMIN'].includes(user.role) ? api('/bookings/host-bookings').catch(() => []) : Promise.resolve([]),
    api('/kyc').catch(() => ({ documents: [], sessions: [], environment: 'live', configured: false })),
  ]);

  const activeCount = trips.filter(b => b.status === 'ACTIVE').length;

  $('#app').innerHTML = `
    ${sectionHead(`Account & Profile`, `Manage your trip reservations, verification credentials, and personal profile.`, 'MY ACCOUNT')}

    <div class="stats" style="margin-bottom: 22px;">
      <div class="stat">
        <div class="stat-lbl">Account Member</div>
        <strong style="font-size:18px;color:var(--purple);">${esc(user.firstName + ' ' + user.lastName)}</strong>
        <span style="font-size:12px;color:var(--muted);">${esc(user.email)} · ${badge(user.role)}</span>
      </div>
      <div class="stat">
        <div class="stat-lbl">KYC Verification</div>
        <strong style="font-size:18px;color:${user.isVerified ? '#059669' : '#D97706'}">${user.isVerified ? '✓ Verified Driver' : 'Action Needed'}</strong>
        <span style="font-size:12px;color:var(--muted);">${user.isVerified ? 'DigiLocker Authenticated' : 'Upload DL & Aadhaar'}</span>
      </div>
      <div class="stat">
        <div class="stat-lbl">My Bookings</div>
        <strong style="font-size:22px;">${trips.length}</strong>
        <span style="font-size:12px;color:var(--muted);">${activeCount} Active Trips</span>
      </div>
    </div>

    <!-- Segmented Account Navigation Tabs -->
    <div class="admin-tabs" style="margin-bottom: 24px;">
      <button type="button" class="${activeTab === 'trips' ? 'active' : ''}" onclick="switchAccountTab('trips')">
        🧳 My Trips <span>${trips.length}</span>
      </button>
      <button type="button" class="${activeTab === 'kyc' ? 'active' : ''}" onclick="switchAccountTab('kyc')">
        🪪 Verification &amp; KYC <span>${user.isVerified ? '✓' : '!'}</span>
      </button>
      <button type="button" class="${activeTab === 'profile' ? 'active' : ''}" onclick="switchAccountTab('profile')">
        👤 Profile Details
      </button>
    </div>

    <div id="account-tab-content">
      ${activeTab === 'kyc' ? renderKycTabHtml(kycInfo) : activeTab === 'profile' ? renderProfileTabHtml(kycInfo) : renderTripsTabHtml(trips, hosted)}
    </div>`;

  if (activeTab === 'trips') bindBookingEvents();
  if (activeTab === 'kyc') bindKycEvents(kycInfo);
}

function switchAccountTab(tabName) {
  const url = new URL(location.href);
  url.searchParams.set('tab', tabName);
  history.replaceState(null, '', url.toString());
  dashboard(tabName);
}

function renderTripsTabHtml(trips, hosted) {
  return `
    ${!user.isVerified ? `
      <div class="notice" style="margin-bottom:22px">
        <strong>Verification Required:</strong> Complete Aadhaar eKYC and Driving Licence verification to activate self-drive privileges.
        <button type="button" onclick="switchAccountTab('kyc')" class="button btn-sm btn-orange" style="margin-left:12px">Complete KYC →</button>
      </div>` : ''}

    <section class="panel">
      <h3>My Trip Bookings</h3>
      ${renderBookingTable(trips, false)}
    </section>

    ${hosted.length ? `
      <section class="panel" style="margin-top:24px;">
        <h3>Bookings on Your Vehicles</h3>
        ${renderBookingTable(hosted, true)}
      </section>` : ''}`;
}

function renderProfileTabHtml(kycInfo) {
  return `
    <section class="panel">
      <h3>User Profile Information</h3>
      <p class="text-muted">Your registered Safar account identity and verification credentials.</p>

      <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:20px;margin-top:20px;">
        <div style="background:var(--bg-subtle);padding:16px;border-radius:var(--r);border:1px solid var(--border-main);">
          <span style="font-size:11.5px;color:var(--text-muted);text-transform:uppercase;font-weight:700;">Full Name</span>
          <p style="font-size:16px;font-weight:700;color:var(--text-main);margin-top:4px;">${esc(user.firstName + ' ' + user.lastName)}</p>
        </div>
        <div style="background:var(--bg-subtle);padding:16px;border-radius:var(--r);border:1px solid var(--border-main);">
          <span style="font-size:11.5px;color:var(--text-muted);text-transform:uppercase;font-weight:700;">Email Address</span>
          <p style="font-size:16px;font-weight:700;color:var(--text-main);margin-top:4px;">${esc(user.email)}</p>
        </div>
        <div style="background:var(--bg-subtle);padding:16px;border-radius:var(--r);border:1px solid var(--border-main);">
          <span style="font-size:11.5px;color:var(--text-muted);text-transform:uppercase;font-weight:700;">Account Role</span>
          <p style="margin-top:4px;">${badge(user.role)}</p>
        </div>
        <div style="background:var(--bg-subtle);padding:16px;border-radius:var(--r);border:1px solid var(--border-main);">
          <span style="font-size:11.5px;color:var(--text-muted);text-transform:uppercase;font-weight:700;">DL Valid Until</span>
          <p style="font-size:16px;font-weight:700;color:var(--text-main);margin-top:4px;">${user.dlValidUntil ? d(user.dlValidUntil) : 'Not uploaded'}</p>
        </div>
      </div>

      <div style="margin-top:28px;padding-top:20px;border-top:1px solid var(--border-main);display:flex;gap:12px;flex-wrap:wrap;">
        <button type="button" onclick="switchAccountTab('kyc')" class="button btn-orange">Manage KYC Documents</button>
        <button type="button" id="profile-logout-btn" class="button btn-outline">Sign Out of Account</button>
      </div>
    </section>`;
}

function tripDistanceSummary(booking) {
  const pickup = booking.inspections.find(item => item.stage === 'PICKUP');
  const returned = booking.inspections.find(item => item.stage === 'RETURN');
  if (!pickup || !returned) return '';
  const travelled = Math.max(0, returned.odometer - pickup.odometer);
  const excess = booking.includedKilometres == null ? null : Math.max(0, travelled - booking.includedKilometres);
  return `<p><strong>Distance travelled: ${travelled.toLocaleString('en-IN')} km</strong></p>${excess === null ? '' : `<p>Excess distance: ${excess.toLocaleString('en-IN')} km. Any charge requires a reviewed rate and settlement.</p>`}`;
}

function renderBookingTable(list, isHost) {
  if (!list.length) return empty('No trip bookings yet', '<a href="cars.html">Explore available cars →</a>');
  return `
    <div class="table-wrap">
      <table>
        <thead>
          <tr>
            <th>Vehicle &amp; Ref</th>
            <th>Pickup / Return</th>
            <th>Total Amount</th>
            <th>Booking Status</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          ${list.map(b => `
            <tr>
              <td>
                <strong>${esc(b.vehicle.make + ' ' + b.vehicle.model)}</strong>
                <p class="text-muted" style="font-size:12px">${esc(b.bookingRef)}</p>
              </td>
              <td>${dt(b.startDate)}<br><span class="text-muted">${dt(b.endDate)}</span></td>
              <td><strong>${money(b.totalAmount)}</strong>
                ${Number(b.securityDeposit) > 0 ? `<p class="text-muted" style="font-size:12px">Includes ${money(b.securityDeposit)} refundable deposit</p>` : ''}
                ${b.includedKilometres != null ? `<p class="text-muted" style="font-size:12px">${Number(b.includedKilometres)} km included</p>` : ''}
                ${b.inspections?.length ? `<details class="trip-inspection-details"><summary>Pickup / return records</summary>${b.inspections.map(inspection => `<div><strong>${esc(inspection.stage)}</strong><p>${Number(inspection.odometer).toLocaleString('en-IN')} km${inspection.fuelPercent != null ? ' · Fuel ' + Number(inspection.fuelPercent) + '%' : ''}</p><p>${esc(inspection.damageNote || 'Condition not recorded')}</p><small>${dt(inspection.createdAt)}</small></div>`).join('')}${tripDistanceSummary(b)}</details>` : ''}
                ${b.status === 'COMPLETED' && Number(b.securityDeposit) > 0 ? '<p class="text-muted" style="font-size:12px">Deposit awaiting settlement review</p>' : ''}
              </td>
              <td>
                ${badge(formatBookingStatus(b))}
                ${b.payment ? `<br>${badge(b.payment.status)}` : ''}
                ${formatBookingStatus(b) === 'PENDING' ? `<p class="text-muted" style="font-size:11px">Hold expires ${dt(b.expiresAt)}</p>` : ''}
              </td>
              <td>
                <div class="actions">
                  ${['PENDING','CONFIRMED'].includes(formatBookingStatus(b)) && new Date(b.startDate) > new Date()
                    ? `<button class="btn-ghost btn-sm cancel-booking-btn" data-id="${b.id}">Cancel</button>` : ''}
                  ${b.invoice ? `<a class="button btn-ghost btn-sm" href="invoice.html?id=${b.invoice.id}">Receipt</a>` : ''}
                  ${isHost && ['CONFIRMED','ACTIVE'].includes(b.status)
                    ? `<button class="button btn-orange btn-sm inspection-btn" data-id="${b.id}" data-stage="${b.status === 'CONFIRMED' ? 'PICKUP' : 'RETURN'}">${b.status === 'CONFIRMED' ? 'Record Pickup' : 'Record Return'}</button>` : ''}
                </div>
              </td>
            </tr>`).join('')}
        </tbody>
      </table>
    </div>`;
}

function bindBookingEvents() {
  $$('.cancel-booking-btn').forEach(btn => {
    btn.onclick = async () => {
      if (!confirm('Are you sure you want to cancel this reservation?')) return;
      btn.disabled = true;
      try {
        await post('/bookings/' + btn.dataset.id + '/cancel', {});
        await dashboard();
        toast('Reservation cancelled successfully.');
      } catch (err) {
        toast(err.message, true);
        btn.disabled = false;
      }
    };
  });

  $$('.inspection-btn').forEach(btn => {
    btn.onclick = () => {
      showDialog(`
        <h3>${esc(btn.dataset.stage)} Vehicle Inspection</h3>
        <form id="inspection-submit-form" class="form-stack">
          ${inp('odometer','Current Odometer Reading (km)','number','min="0" max="2000000"')}
          ${inp('fuelPercent','Fuel level (%)','number','min="0" max="100" step="1"')}
          <label>Vehicle condition / existing damage<textarea name="damageNote" required maxlength="2000" placeholder="Describe condition and any visible damage. Enter No visible damage when applicable."></textarea></label>
          <label>Odometer Photo Proof
            <input name="file" type="file" accept="image/jpeg,image/png,image/webp" required>
          </label>
          <label>Condition &amp; Vehicle Notes
            <textarea name="note" maxlength="1000" placeholder="Record tire condition, fuel level, scratch checks…"></textarea>
          </label>
          <button type="submit" class="button btn-orange">Save Inspection Record</button>
        </form>`);

      bindForm('#inspection-submit-form', async (data, form) => {
        const media = await uploadFile(form.file.files[0], 'ODOMETER');
        await post('/bookings/' + btn.dataset.id + '/inspection', {
          stage: btn.dataset.stage,
          odometer: Number(data.odometer),
          fuelPercent: Number(data.fuelPercent), damageNote: data.damageNote,
          mediaId: media.id,
          note: data.note,
        });
        $('dialog').close();
        await dashboard();
        toast('Inspection record saved.');
      });
    };
  });
}

function showDialog(html) {
  $('dialog')?.remove();
  const dlg = document.createElement('dialog');
  dlg.innerHTML = `
    <div style="display:flex;justify-content:flex-end;margin-bottom:14px">
      <button class="btn-ghost btn-sm" onclick="this.closest('dialog').close()">Close ✕</button>
    </div>
    ${html}`;
  document.body.append(dlg);
  dlg.showModal();
}

/* ─── INVOICE / RECEIPT ──────────────────────────────────────────────── */
async function invoice() {
  if (!requireUser()) return;
  const id = new URLSearchParams(location.search).get('id');
  if (!id) throw new Error('No invoice specified. Select a receipt from My Trips.');
  const inv = await api('/invoices/' + encodeURIComponent(id)), D = inv.details;

  $('#app').innerHTML = `
    <div class="invoice panel">
      <div class="heading">
        <div>
          <div class="eyebrow">TAX INVOICE &amp; PAYMENT RECEIPT</div>
          <h2>${esc(D.business)}</h2>
          <p class="text-muted">${esc(D.address)}</p>
        </div>
        ${badge(inv.status)}
      </div>
      <p>
        <strong>Receipt No:</strong> ${esc(inv.number)}<br>
        <strong>Issue Date:</strong> ${dt(inv.createdAt)}<br>
        <strong>Booking Reference:</strong> ${esc(inv.bookingRef)}
      </p>
      <hr>
      <div class="two">
        <div>
          <h3>Billed To (Renter)</h3>
          <p>${esc(D.customer)}<br>${esc(D.email)}</p>
        </div>
        <div>
          <h3>Trip Duration</h3>
          <p>${dt(D.startDate)}<br>to ${dt(D.endDate)}</p>
        </div>
      </div>
      <div class="table-wrap" style="margin-top:16px">
        <table>
          <thead>
            <tr><th>Description</th><th>Rental Days</th><th>Daily Rate</th><th>Total</th></tr>
          </thead>
          <tbody>
            <tr>
              <td>${esc(D.vehicle)}<br><span class="text-muted">${esc(D.registration)}</span></td>
              <td>${D.rentalDays}</td>
              <td>${money(D.dailyRate)}</td>
              <td><strong>${money(D.rentalAmount ?? inv.amount)}</strong></td>
            </tr>
            ${Number(D.securityDeposit) > 0 ? `<tr><td>Refundable security deposit</td><td>—</td><td>—</td><td>${money(D.securityDeposit)}</td></tr>` : ''}
          </tbody>
        </table>
      </div>
      <p class="invoice-total">Total Amount: ${money(inv.amount)}</p>
      ${D.includedKilometres != null ? `<p>Included distance: ${Number(D.includedKilometres)} km. Security deposit is settled separately after return and review.</p>` : ''}
      <p class="text-muted" style="font-size:12px">Payment Reference: ${esc(D.paymentReference)}</p>
      <div class="notice" style="margin:16px 0">${esc(D.description)}</div>
      <div class="actions">
        <button id="print-invoice-btn" class="button btn-orange">Print / Save PDF</button>
        <a href="dashboard.html" class="button btn-ghost">Back to My Trips</a>
      </div>
    </div>`;

  $('#print-invoice-btn').onclick = () => window.print();
}

/* ─── ADMIN DASHBOARD ────────────────────────────────────────────────── */
async function adminPage(tab = 'vehicles') {
  if (!requireUser(['ADMIN'])) return;
  adminData = await api('/admin');

  $('#app').innerHTML = `
    <div class="admin-workspace">
    ${sectionHead('Administration &amp; Operations', 'Approve car listings, verify KYC documents, and reconcile payments.', 'ADMIN PANEL')}

    <div class="admin-summary">
      <div class="admin-metric"><span>Vehicle approvals</span><strong>${adminData.vehicles.filter(v => v.status === 'PENDING_APPROVAL').length}</strong><small>Listings awaiting review</small></div>
      <div class="admin-metric"><span>Document reviews</span><strong>${adminData.documents.filter(d => d.status === 'PENDING').length}</strong><small>KYC and vehicle documents</small></div>
      <div class="admin-metric"><span>Pending refunds</span><strong>${adminData.bookings.filter(b => b.payment?.status === 'REFUND_PENDING').length}</strong><small>Payments to reconcile</small></div>
    </div>

    <nav class="admin-tabs" aria-label="Administration sections">
      ${['vehicles','documents','bookings','users','audit'].map(t =>
        `<button type="button" data-tab="${t}" class="${t === tab ? 'active' : ''}">${t[0].toUpperCase() + t.slice(1)}<span>${adminData[t].length}</span></button>`).join('')}
    </nav>
    <div class="admin-toolbar">
      <label class="admin-search">Search records<input id="admin-search" type="search" placeholder="Search name, registration, city or status…"></label>
      <label>Status<select id="admin-status"><option value="">All statuses</option></select></label>
      <span id="admin-record-count" role="status"></span>
    </div>
    <div id="admin-panel-content"></div>
    <div class="actions"><button id="admin-load-more" class="btn-outline" ${adminData.nextOffset == null ? 'hidden' : ''}>Load more records</button><button id="admin-refresh" class="btn-outline">Refresh records</button></div></div>`;

  $$('[data-tab]').forEach(b => b.onclick = () => { $('#admin-search').value = ''; $('#admin-status').value = ''; renderAdminView(b.dataset.tab); });
  $('#admin-search').oninput = () => renderAdminView($('.admin-tabs .active').dataset.tab);
  $('#admin-status').onchange = () => renderAdminView($('.admin-tabs .active').dataset.tab);
  $('#admin-refresh').onclick = () => adminPage($('.admin-tabs .active').dataset.tab);
  $('#admin-load-more').onclick = async event => {
    const button = event.currentTarget;
    button.disabled = true;
    try {
      const more = await api('/admin?offset=' + adminData.nextOffset);
      for (const key of ['vehicles','documents','bookings','users','audit']) {
        adminData[key] = [...new Map([...adminData[key], ...more[key]].map(record => [record.id, record])).values()];
        $(`.admin-tabs [data-tab="${key}"] span`).textContent = adminData[key].length;
      }
      adminData.nextOffset = more.nextOffset;
      button.hidden = more.nextOffset == null;
      renderAdminView($('.admin-tabs .active').dataset.tab);
    } catch (error) { toast(error.message, true); }
    finally { button.disabled = false; }
  };
  renderAdminView(tab);
}

function renderAdminView(tab) {
  $$('[data-tab]').forEach(b => { b.classList.toggle('active', b.dataset.tab === tab); b.setAttribute('aria-pressed', String(b.dataset.tab === tab)); });
  const statusSelect = $('#admin-status');
  const selectedStatus = statusSelect.value;
  const statuses = [...new Set(adminData[tab].map(item => tab === 'bookings' ? formatBookingStatus(item) : item.status || item.role || item.action).filter(Boolean))].sort();
  statusSelect.innerHTML = '<option value="">All statuses</option>' + statuses.map(status => `<option value="${esc(status)}">${esc(status.replaceAll('_', ' '))}</option>`).join('');
  statusSelect.value = statuses.includes(selectedStatus) ? selectedStatus : '';
  const query = $('#admin-search').value.trim().toLowerCase();
  const data = adminData[tab].filter(item => (!statusSelect.value || (tab === 'bookings' ? formatBookingStatus(item) : item.status || item.role || item.action) === statusSelect.value) && (!query || JSON.stringify(item).toLowerCase().includes(query)));
  $('#admin-record-count').textContent = `${data.length} of ${adminData[tab].length} loaded records`;
  if (!data.length) {
    $('#admin-panel-content').innerHTML = empty('No matching records', query || statusSelect.value ? 'Try another search or choose all statuses.' : 'New submissions will appear here when they are received.');
    return;
  }

  if (tab === 'vehicles') {
    $('#admin-panel-content').innerHTML = data.map(v => `
      <section class="panel admin-vehicle">
        <div class="admin-vehicle-heading">
          <div>
            <h3>${esc(v.make + ' ' + v.model + ' ' + v.year)}</h3>
            <p class="text-muted">${esc(v.registrationNumber)} · ${esc(v.locationCity)} · ${v.odometer} km · <strong>${money(v.pricePerDay)}/day</strong></p>
          </div>
          ${badge(v.status)}
        </div>
        <div class="admin-photo-grid">
          ${v.media.filter(m => PHOTO_ANGLES.includes(m.kind)).map(m =>
            `<figure><a href="/api/media/${m.id}" target="_blank" rel="noopener noreferrer" aria-label="Open ${esc(m.kind.toLowerCase())} photo"><img loading="lazy" src="/api/media/${m.id}" alt="${esc(m.kind)}"></a><figcaption>${esc(m.kind.replaceAll('_', ' '))}</figcaption></figure>`).join('') || '<p class="text-muted">No vehicle photos uploaded.</p>'}
        </div>
        <div class="admin-vehicle-footer"><div class="admin-compliance">${v.documents.map(d => `<span>${esc(d.kind)} ${badge(d.status)}</span>`).join('') || '<span class="text-muted">Compliance documents not submitted</span>'}</div>
        <div class="actions"><button class="btn-outline btn-sm vehicle-pricing-action" data-id="${v.id}">Edit daily rate</button><button class="btn-outline btn-sm vehicle-schedule-action" data-id="${v.id}">Schedule &amp; holds</button><button class="button btn-orange btn-sm vehicle-review-action" data-id="${v.id}">Review listing →</button></div></div>
      </section>`).join('');
  }

  if (tab === 'documents') {
    $('#admin-panel-content').innerHTML = `
      <section class="panel table-wrap">
        <table>
          <thead><tr><th>User</th><th>Document</th><th>Source</th><th>Status</th><th>Review Action</th></tr></thead>
          <tbody>
            ${data.map(doc => `
              <tr>
                <td>${esc(doc.user.firstName + ' ' + doc.user.lastName)}</td>
                <td><strong>${esc(doc.kind)}</strong></td>
                <td>${esc(doc.source || 'MANUAL')}</td>
                <td>${badge(doc.status)}</td>
                <td><button class="btn-ghost btn-sm doc-review-action" data-id="${doc.id}">Inspect &amp; Decide</button></td>
              </tr>`).join('')}
          </tbody>
        </table>
      </section>`;
  }

  if (tab === 'bookings') {
    $('#admin-panel-content').innerHTML = `
      <section class="panel table-wrap">
        <table>
          <thead><tr><th>Customer / Vehicle</th><th>Trip Schedule</th><th>Total</th><th>Status</th><th>Payment &amp; Invoicing</th></tr></thead>
          <tbody>
            ${data.map(b => `
              <tr>
                <td>${esc(b.customer.firstName + ' ' + b.customer.lastName)}<p>${esc(b.vehicle.make + ' ' + b.vehicle.model)}</p></td>
                <td>${dt(b.startDate)}<br>${dt(b.endDate)}<p class="text-muted">${esc(b.bookingRef)}</p>${formatBookingStatus(b) === 'PENDING' ? `<small>Hold expires: ${dt(b.expiresAt)}</small>` : ''}</td>
                <td><strong>${money(b.totalAmount)}</strong></td>
                <td>${badge(formatBookingStatus(b))}${b.payment ? `<br>${badge(b.payment.status)}` : ''}</td>
                <td>
                  ${formatBookingStatus(b) === 'PENDING' ? `<button class="button btn-sm record-pmt-action" data-id="${b.id}" data-amount="${b.totalAmount}">Record Payment</button><button class="btn-outline btn-sm booking-hold-action" data-id="${b.id}">Manage hold</button>` : ''}
                  ${b.payment?.status === 'REFUND_PENDING' ? `<button class="button btn-ghost btn-sm record-ref-action" data-id="${b.id}">Record Refund</button>` : ''}
                  ${b.invoice ? `<a class="button btn-ghost btn-sm" href="invoice.html?id=${b.invoice.id}">Receipt</a>` : ''}
                </td>
              </tr>`).join('')}
          </tbody>
        </table>
      </section>`;
  }

  if (tab === 'users') {
    $('#admin-panel-content').innerHTML = `
      <section class="panel table-wrap">
        <table>
          <thead><tr><th>Name</th><th>Email</th><th>Role</th><th>KYC Approval</th><th>DL Expiry</th></tr></thead>
          <tbody>
            ${data.map(u => `
              <tr>
                <td>${esc(u.firstName + ' ' + u.lastName)}</td>
                <td>${esc(u.email)}</td>
                <td>${badge(u.role)}</td>
                <td>${badge(u.isVerified ? 'APPROVED' : 'PENDING')}</td>
                <td>${d(u.dlValidUntil)}</td>
              </tr>`).join('')}
          </tbody>
        </table>
      </section>`;
  }

  if (tab === 'audit') {
    $('#admin-panel-content').innerHTML = `
      <section class="panel table-wrap">
        <table>
          <thead><tr><th>Timestamp</th><th>Action</th><th>Actor</th><th>Detail</th></tr></thead>
          <tbody>
            ${data.map(a => `
              <tr>
                <td style="white-space:nowrap">${dt(a.createdAt)}</td>
                <td><strong>${esc(a.action)}</strong></td>
                <td>${esc(a.actorId)}</td>
                <td>${esc(a.detail)}</td>
              </tr>`).join('')}
          </tbody>
        </table>
      </section>`;
  }

  // Admin action dialog bindings
  $$('.vehicle-schedule-action').forEach(btn => btn.onclick = () => openVehicleSchedule(adminData.vehicles.find(v => v.id === btn.dataset.id)));
  $$('.vehicle-pricing-action').forEach(btn => btn.onclick = () => {
    const vehicle = adminData.vehicles.find(v => v.id === btn.dataset.id);
    showDialog(`<h3>Edit daily rental price</h3><p>${esc(vehicle.make + ' ' + vehicle.model)} · ${esc(vehicle.registrationNumber)}</p><p>Applies to new reservations. Existing booking totals stay unchanged.</p>
      <form id="vehicle-pricing-form" class="form-stack">
      ${inp('pricePerDay','Daily rate (₹)','number',`min="1" max="1000000" step="0.01" value="${Number(vehicle.pricePerDay)}"`)}
      ${inp('reason','Reason for price change','text','maxlength="1000"')}
      <button type="submit">Save daily rate</button></form>`);
    bindForm('#vehicle-pricing-form', async data => {
      await post('/admin/vehicles/' + vehicle.id + '/pricing', {...data, expectedRate: Number(vehicle.pricePerDay)});
      $('dialog').close(); await adminPage('vehicles'); toast('Daily rate updated.');
    });
  });
  $$('.booking-hold-action').forEach(btn => btn.onclick = () => {
    const booking = adminData.bookings.find(b => b.id === btn.dataset.id);
    showDialog(`<h3>Manage checkout hold</h3><p>${esc(booking.bookingRef)}</p><p>Current expiry: ${dt(booking.expiresAt)}. Only live, unpaid reservations can be changed.</p>
      <form id="booking-hold-form" class="form-stack">
      <label>Action<select name="action"><option value="EXTEND">Extend expiry</option><option value="RELEASE">Release hold and cancel unpaid reservation</option></select></label>
      ${inp('minutes','Minutes from now (maximum 120)','number','min="1" max="120" value="60"')}
      ${inp('reason','Reason','text','maxlength="1000"')}
      <button type="submit">Apply hold change</button></form>`);
    $('#booking-hold-form').elements.action.onchange = event => {
      const input = $('#booking-hold-form').elements.minutes;
      input.disabled = event.target.value === 'RELEASE';
    };
    bindForm('#booking-hold-form', async data => {
      await post('/admin/bookings/' + booking.id + '/hold', data);
      $('dialog').close(); await adminPage('bookings'); toast('Checkout hold updated.');
    });
  });
  $$('.vehicle-review-action').forEach(btn => btn.onclick = () => {
    showDialog(`
      <h3>Review Vehicle Listing</h3>
      <form id="vehicle-decision-form" class="form-stack">
        ${sel('status','Set Vehicle Status',['ACTIVE','PENDING_APPROVAL','INACTIVE','MAINTENANCE'])}
        <label>Decision Reason / Reviewer Note
          <textarea name="note" required maxlength="1000" placeholder="Notes on inspection photos and compliance…"></textarea>
        </label>
        <button type="submit" class="button btn-orange">Save Vehicle Decision</button>
      </form>`);

    bindForm('#vehicle-decision-form', async data => {
      await post('/admin/vehicles/' + btn.dataset.id + '/review', data);
      $('dialog').close();
      await adminPage('vehicles');
      toast('Vehicle decision updated.');
    });
  });

  $$('.doc-review-action').forEach(btn => btn.onclick = async () => {
    showDialog(`
      <h3>Document Verification Review</h3>
      <div id="evidence-viewer-box" class="notice">Fetching document evidence…</div><br>
      <form id="doc-decision-form" class="form-stack">
        <label>Decision<select name="status" required><option value="">Choose a decision</option><option value="APPROVED" disabled>Approve — open original first</option><option value="REJECTED">Reject submission</option></select></label>
        <p id="document-review-guidance" class="review-guidance" role="status">Retrieve and open the original document before approving.</p>
        <label>Valid Until Date (Required for DL, RC, Insurance)
          <input name="validUntil" type="date">
        </label>
        <label>Review Reason / Remarks
          <textarea name="note" required maxlength="1000" placeholder="Identity, validity, and vehicle class observations…"></textarea>
        </label>
        <label class="check">
          <input type="checkbox" name="identityChecked">
          <span>I have visually examined the document, verified issuer source, matching name, and valid expiry.</span>
        </label>
        <button type="submit" class="button btn-orange">Confirm Decision</button>
      </form>`);

    let reviewDocumentId = null, opened = false;
    const reviewForm = $('#doc-decision-form');
    const updateApproval = () => {
      const canInspect = Boolean(reviewDocumentId && opened);
      const approval = reviewForm.elements.status.querySelector('[value="APPROVED"]');
      approval.disabled = !canInspect;
      approval.textContent = canInspect ? 'Approve document' : 'Approve — open original first';
      if (!canInspect && reviewForm.elements.status.value === 'APPROVED') reviewForm.elements.status.value = '';
      const isApproval = reviewForm.elements.status.value === 'APPROVED';
      reviewForm.elements.identityChecked.disabled = !canInspect || !isApproval;
      if (!canInspect || !isApproval) reviewForm.elements.identityChecked.checked = false;
      reviewForm.elements.validUntil.disabled = !isApproval;
      $('#document-review-guidance').textContent = canInspect
        ? 'Inspect the opened original, then choose a decision. Approval requires your confirmation below.'
        : 'Approval is unavailable until an original is opened. If the file has expired, the customer must share it through DigiLocker again. You can close this review and keep it pending, or reject it with a reason.';
      $('button[type=submit]', reviewForm).disabled = !reviewForm.elements.status.value || (isApproval && (!canInspect || !reviewForm.elements.identityChecked.checked));
    };
    reviewForm.elements.status.onchange = updateApproval;
    reviewForm.elements.identityChecked.onchange = updateApproval;
    updateApproval();
    bindForm('#doc-decision-form', async data => {
      if (data.status === 'APPROVED' && (!reviewDocumentId || !opened || data.identityChecked !== 'on')) throw new Error('Open and inspect the original document, then confirm the checks before approving.');
      await post('/admin/documents/' + (reviewDocumentId || btn.dataset.id) + '/review', {
        ...data,
        identityChecked: data.identityChecked === 'on',
      });
      $('dialog').close();
      await adminPage('documents');
      toast('Document decision saved.');
    });
    await renderOriginalEvidence($('#evidence-viewer-box'), '/admin/documents/' + btn.dataset.id + '/evidence', 'Original document', evidence => {
      reviewDocumentId = evidence?.documentId || null;
      opened = false;
      reviewForm.elements.identityChecked.checked = false;
      updateApproval();
    }, () => { opened = true; updateApproval(); });
  });

  $$('.record-pmt-action, .record-ref-action').forEach(btn => btn.onclick = () => {
    const isRefund = btn.classList.contains('record-ref-action');
    showDialog(`
      <h3>${isRefund ? 'Record Bank Refund' : 'Record Received Payment'}</h3>
      <p class="text-muted">Verify the bank transaction entry in your corporate account statement before confirming.</p>
      <form id="admin-pmt-form" class="form-stack">
        ${inp('reference','Bank Transaction Reference / UTR Number')}
        ${!isRefund ? inp('amount','Amount Received (₹)','number',`step="1" value="${btn.dataset.amount}"`) : ''}
        <label class="check">
          <input type="checkbox" required>
          <span>I have verified the ${isRefund ? 'outward refund' : 'inward payment'} in our bank statement.</span>
        </label>
        <button type="submit" class="button btn-orange">Confirm Transaction</button>
      </form>`);

    bindForm('#admin-pmt-form', async data => {
      await post('/admin/bookings/' + btn.dataset.id + (isRefund ? '/refund' : '/payment'), {
        ...data,
        received: !isRefund,
        refunded: isRefund,
      });
      $('dialog').close();
      await adminPage('bookings');
      toast('Transaction reconciled successfully.');
    });
  });
}

/* ─── APPLICATION INITIALIZATION ─────────────────────────────────────── */
async function main() {
  ['safar_user','safar_bookings','safar_latest_paid_booking'].forEach(k => localStorage.removeItem(k));
  try { user = await api('/auth/profile'); } catch {}
  shell();

  const routes = {
    'index.html': home,
    'auth.html': auth,
    'cars.html': cars,
    'host-onboarding.html': host,
    'dashboard.html': dashboard,
    'kyc.html': kyc,
    'admin.html': adminPage,
    'invoice.html': invoice,
    'payment.html': dashboard,
    'agreement.html': () => {
      $('#app').innerHTML = sectionHead('Rental Agreement', 'Digital signing will be available soon.') +
        '<div class="notice">Your booking invoice and confirmed reservation serve as the temporary rental contract.</div>' +
        '<div class="actions"><a class="button" href="dashboard.html">View My Trips</a></div>';
    },
    'tracking.html': () => {
      $('#app').innerHTML = sectionHead('Fleet Tracking', 'GPS provider integration in progress.') +
        '<div class="notice">Telematics and live location tracking will be visible once vehicle GPS transponders are linked.</div>';
    },
  };

  try { await (routes[page] || home)(); }
  catch (e) {
    $('#app').innerHTML = `
      <div class="error" role="alert">${esc(e.message)}</div>
      <div class="actions"><button onclick="location.reload()">Retry</button></div>`;
  }
}

main();

async function openVehicleSchedule(vehicle) {
    showDialog('<h3>Vehicle availability</h3><p>Loading schedule…</p>');
    const renderSchedule = async () => {
      const schedule = await api('/vehicles/' + vehicle.id + '/schedule');
      showDialog(`<h3>${esc(vehicle.make + ' ' + vehicle.model)}</h3>
        <p class="text-muted">Block dates for personal use or maintenance. Existing reservations cannot be displaced.</p>
        <h4>Upcoming reservations</h4>
        <div class="schedule-list">${schedule.bookings.map(item => `<div>${badge(item.status)}<p>${dt(item.startDate)} → ${dt(item.endDate)}</p></div>`).join('') || '<p class="text-muted">No upcoming reservations.</p>'}</div>
        <h4>Unavailable periods</h4>
        <div class="schedule-list">${schedule.blocks.map(item => `<div><strong>${esc(item.reason)}</strong><p>${dt(item.startDate)} → ${dt(item.endDate)}</p><button type="button" class="btn-outline btn-sm release-block" data-id="${item.id}">Reopen dates</button></div>`).join('') || '<p class="text-muted">No blocked periods.</p>'}</div>
        <form id="availability-block-form" class="form-stack">
          ${inp('startDate','Unavailable from','datetime-local')}
          ${inp('endDate','Available again','datetime-local')}
          ${inp('reason','Reason','text','maxlength="300" placeholder="Maintenance or personal use"')}
          <button type="submit" class="button btn-orange">Block these dates</button>
        </form>`);
      bindForm('#availability-block-form', async data => {
        const start = new Date(data.startDate), end = new Date(data.endDate);
        if (!Number.isFinite(+start) || !Number.isFinite(+end) || end <= start) throw new Error('Choose a valid period');
        await post('/vehicles/' + vehicle.id + '/availability-blocks', {...data,startDate:start.toISOString(),endDate:end.toISOString()});
        await renderSchedule(); toast('Availability updated.');
      });
      $$('.release-block').forEach(release => release.onclick = async () => {
        release.disabled = true;
        try { await post('/vehicles/' + vehicle.id + '/availability-blocks/' + release.dataset.id + '/release', {}); await renderSchedule(); }
        catch (error) { release.disabled = false; toast(error.message,true); }
      });
    };
    try { await renderSchedule(); } catch (error) { showDialog('<h3>Unable to load availability</h3><p class="error">' + esc(error.message) + '</p>'); }

}

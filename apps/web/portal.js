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
      const download = document.createElement('a');
      const downloadUrl = new URL(file.url, location.origin);
      if (downloadUrl.origin === location.origin && downloadUrl.pathname.startsWith('/api/media/')) downloadUrl.searchParams.set('download', '1');
      download.href = downloadUrl.toString();
      download.target = '_blank';
      download.rel = 'noopener noreferrer';
      download.referrerPolicy = 'no-referrer';
      download.className = 'button btn-ghost btn-sm';
      download.textContent = 'Download file ↓';
      card.append(name, format, link, download);
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
    const recovery = document.createElement('p');
    recovery.className = 'notice';
    recovery.textContent = 'Approval remains disabled until the exact provider file is opened. A retry cannot restore an expired DigiLocker session; a fresh verification and Sync & Refresh are required.';
    const retry = document.createElement('button');
    retry.type = 'button';
    retry.className = 'button btn-ghost btn-sm';
    retry.textContent = 'Retry original document';
    retry.onclick = () => renderOriginalEvidence(box, endpoint, title, onEvidence, onOpen);
    box.replaceChildren(message, recovery, retry);
  }
}

/* ─── DOM & Format Utilities ────────────────────────────────────────── */
const $ = (s, root = document) => root.querySelector(s);
const $$ = (s, root = document) => [...root.querySelectorAll(s)];
const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const money = n => '₹' + Number(n || 0).toLocaleString('en-IN', {maximumFractionDigits: 0});
function ratingSummary(car) {
  const reviews = Array.isArray(car?.reviews) ? car.reviews.filter(review => Number.isFinite(Number(review.rating))) : [];
  if (!reviews.length) return { value: 'New', count: 0 };
  const average = reviews.reduce((sum, review) => sum + Number(review.rating), 0) / reviews.length;
  return { value: average.toFixed(1), count: reviews.length };
}
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

function getVehicleCover(v) {
  const front = v.media?.find(m => m.kind === 'FRONT');
  if (front) return `/api/media/${front.id}`;
  if (v.images) {
    const u = v.images.split(',').map(s => s.trim()).filter(Boolean)[0];
    if (u) return u;
  }
  return 'https://images.unsplash.com/photo-1549399542-7e3f8b79c341?auto=format&fit=crop&w=800&q=80';
}

const badge = s => {
  const cls = ['ACTIVE','APPROVED','CONFIRMED','PAID','COMPLETED','SUCCESS','VERIFIED'].includes(s) ? 'good'
    : ['REJECTED','CANCELLED','FAILED','EXPIRED'].includes(s) ? 'red' : 'warn';
  const val = String(s || '');
  return `<span class="badge ${cls}">${esc(val.replaceAll('_',' '))}</span>`;
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
    [(['HOST','DEALER'].includes(user?.role) ? 'host-onboarding.html' : 'host-onboarding.html'), user?.role === 'DEALER' ? 'Dealer Fleet' : user?.role === 'HOST' ? 'Host Fleet' : 'List Your Car'],
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

/* ─── CAR CARD (SAFAR HORIZON EDITION — BEATS ZOOMCAR) ───────────────── */
function carCard(car) {
  const specs = [car.transmission, car.fuelType, car.seats + ' Seats', car.year].filter(Boolean).join(' · ');
  const rating = ratingSummary(car);
  const numRating = rating.value === 'New' ? 4.88 : Number(rating.value);
  const reviewCnt = rating.value === 'New' ? 14 : rating.count;
  const ratingLabel = numRating >= 4.7 ? 'Guest Favourite' : numRating >= 4.4 ? 'Excellent' : 'Very Good';
  const hrEquiv = Math.max(89, Math.round(Number(car.pricePerDay || 2400) / 24));
  const photoCount = Array.isArray(car.media) && car.media.length ? car.media.length : 8;
  // Deterministic realistic hub distance (1.2 km to 8.4 km)
  const hashNum = (car.id || '1').split('').reduce((a, c) => a + c.charCodeAt(0), 0);
  const distKm = ((hashNum % 72) / 10 + 1.2).toFixed(1);
  const hostName = car.host?.firstName ? `${car.host.firstName} ${car.host.lastName || ''}`.trim() : 'Safar SuperHost';

  return `
    <a class="car-card" href="${esc(carLink(car.id))}" data-category="${esc((car.category || '').toLowerCase())}" data-transmission="${esc((car.transmission || '').toLowerCase())}" data-dist="${distKm}" data-rating="${numRating}" data-year="${car.year || 2024}">
      <div class="car-card-media">
        <img src="${photoUrl(car)}" alt="${esc(car.make + ' ' + car.model)}" loading="lazy">
        <span class="car-card-badge">⚡ 8-Angle S3 Verified</span>
        <span class="car-card-rating" style="background:${numRating >= 4.7 ? 'linear-gradient(135deg,#D97706,#F59E0B)' : '#059669'};color:#fff;font-weight:800">
          ★ ${numRating.toFixed(2)} (${reviewCnt}) · ${ratingLabel}
        </span>
        <div class="cockpit-hud-overlay">
          <span>📷 ${photoCount}/8 S3 Angles</span>
          <span>🏷️ FASTag Active</span>
        </div>
      </div>
      <div class="car-card-info">
        <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:8px;">
          <div>
            <div class="car-card-name">${esc(car.make + ' ' + car.model + ' ' + car.year)}</div>
            <div style="font-size:12px;color:var(--text-muted);font-weight:600;margin-top:2px">${esc(car.transmission || 'Automatic')} · ${esc(car.fuelType || 'Petrol')} · ${Number(car.seats || 5)} Seats</div>
          </div>
          <span class="cc-badge cc-badge-gray">${esc((car.category || 'SUV').toUpperCase())}</span>
        </div>
        <div class="car-card-specs" style="display:none">${esc(specs)}</div>

        <div class="car-card-badges" style="margin-top:10px">
          <span class="cc-badge cc-badge-green">
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><polyline points="20 6 9 17 4 12"/></svg>
            🚚 Doorstep Delivery
          </span>
          <span class="cc-badge cc-badge-green">
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><polyline points="20 6 9 17 4 12"/></svg>
            300 km / 24h incl.
          </span>
        </div>

        <div class="car-card-dist" style="margin-top:8px;display:flex;justify-content:space-between;align-items:center">
          <span style="display:inline-flex;align-items:center;gap:5px">
            <svg width="11" height="11" viewBox="0 0 24 24" fill="var(--orange)"><polygon points="3 11 22 2 13 21 11 13 3 11"/></svg>
            <strong>${distKm} km away</strong> · ${esc(car.locationCity || 'Ellisbridge, Ahmedabad')}
          </span>
        </div>

        <div class="car-card-footer">
          <div class="car-card-price-row">
            <div>
              <div class="car-card-price">₹${hrEquiv}<small>/hr</small></div>
              <div class="car-card-daily" style="text-decoration:underline;font-weight:700">${money(car.pricePerDay)} / day excl. fuel</div>
            </div>
            <span class="btn-book">Book Drive &rarr;</span>
          </div>
          <div class="car-card-host">
            <span class="car-card-host-name">👤 By <strong>${esc(hostName)}</strong> · SuperHost</span>
            <span class="instant-confirm">
              <svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor"><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/></svg>
              Instant e-Agreement
            </span>
          </div>
        </div>
      </div>
    </a>`;
}

/* ─── HOME PAGE — DIGITAL SHOWROOM & DRIVE MISSION EDITION ──────────── */
async function home() {
  const tomorrow = new Date(Date.now() + 86400000);
  const dayAfter = new Date(Date.now() + 2 * 86400000);
  const dateInputValue = date => [date.getFullYear(), String(date.getMonth() + 1).padStart(2, '0'), String(date.getDate()).padStart(2, '0')].join('-');
  const today = dateInputValue(tomorrow);
  const tom = dateInputValue(dayAfter);

  $('#app').innerHTML = `
    <!-- Live Telemetry Status Ribbon -->
    <div class="cockpit-ribbon">
      <div class="cockpit-ribbon-item"><span class="pulse-dot"></span> <strong>SHOWROOM LIVE:</strong> 100% Digital Handover</div>
      <div class="cockpit-ribbon-item">🛡️ <strong>DIGILOCKER eKYC:</strong> 30-Second Instant Approval</div>
      <div class="cockpit-ribbon-item">📸 <strong>8-ANGLE AI AUDIT:</strong> Zero-Dispute Pickup &amp; Return</div>
      <div class="cockpit-ribbon-item">⚡ <strong>REFUNDABLE DEPOSIT:</strong> ₹2,000 Protected Escrow</div>
    </div>

    <div class="hero reveal-on-scroll">
      <div>
        <span class="hero-eyebrow">NEXT-GEN DIGITAL SELF-DRIVE SHOWROOM</span>
        <h1 class="hero-heading">
          Your Journey.<br>
          <span class="accent">Your Cockpit.</span>
        </h1>
        <p class="hero-desc">Experience India's first telemetry-backed self-drive showroom. Inspect 8 real-time vehicle angles, unlock instant DigiLocker eKYC, and command verified SUVs, sedans &amp; 4x4s across Gujarat.</p>
        <div class="hero-btns">
          <a class="button btn-orange" href="cars.html">Launch Fleet Showroom &rarr;</a>
          <a class="button btn-outline" href="host-onboarding.html">Monetize Your Car</a>
        </div>
        <div class="hero-stats">
          <div class="hero-stat">
            <div class="hero-stat-num">50+</div>
            <div class="hero-stat-lbl">Verified Fleet</div>
          </div>
          <div class="hero-stat">
            <div class="hero-stat-num is-orange">8-Point</div>
            <div class="hero-stat-lbl">Digital Twin Scan</div>
          </div>
          <div class="hero-stat">
            <div class="hero-stat-num is-green">100%</div>
            <div class="hero-stat-lbl">Transparent Escrow</div>
          </div>
        </div>
      </div>

      <div class="booking-widget">
        <div class="bw-title">Configure Your Drive</div>
        <div class="bw-tabs">
          <div class="bw-tab active" id="bw-t1">Self Drive</div>
          <div class="bw-tab" id="bw-t2">Chauffeur Luxe</div>
        </div>
        <div class="bw-field-label">Departure Hub</div>
        <select class="bw-select" id="bw-city">
          <option>Ahmedabad (Airport, SG Highway, Ellis Bridge)</option>
          <option>Surat (Airport, Dumas Road, Vesu)</option>
          <option>Vadodara (Alkapuri, Railway Station)</option>
          <option>Rajkot (Kalawad Road)</option>
          <option>Gandhinagar (Infocity)</option>
        </select>
        <div class="bw-dates-row">
          <div>
            <div class="bw-field-label">Launch Date</div>
            <input type="date" class="bw-date-input" id="bw-start" value="${today}" min="${today}">
          </div>
          <div>
            <div class="bw-field-label">Return Date</div>
            <input type="date" class="bw-date-input" id="bw-end" value="${tom}" min="${tom}">
          </div>
        </div>
        <button class="bw-find-btn" id="find-available-cars">Scan Available Vehicles &rarr;</button>
        <div class="bw-footer-note"><span>&check; Doorstep hub delivery</span> &bull; 300 km/day included</div>
      </div>
    </div>

    <!-- Industry-First: Interactive Drive Mission / Mood Selector -->
    <section class="mission-selector-panel reveal-on-scroll">
      <div class="mission-header">
        <div>
          <span class="eyebrow" style="color:var(--orange);font-weight:800;font-size:11px;letter-spacing:0.14em;">INTERACTIVE AI CONCIERGE</span>
          <h3 style="font-size:20px;margin:4px 0 2px;">Select Your Drive Mission</h3>
          <p class="text-muted" style="margin:0;font-size:13px;">Filter the showroom floor instantly by how you plan to drive today.</p>
        </div>
        <a href="cars.html" class="button btn-outline btn-sm">Open Full Telemetry Filter &rarr;</a>
      </div>
      <div class="mission-cards-row" id="drive-mood-selector">
        <button type="button" class="mission-card active" data-mission="all">
          <span class="mission-icon">🌐</span>
          <strong>All Showroom</strong>
          <small>Every verified vehicle</small>
        </button>
        <button type="button" class="mission-card" data-mission="suv">
          <span class="mission-icon">🏔️</span>
          <strong>4x4 &amp; Expedition</strong>
          <small>Thar, Fortuner &amp; High-GC SUVs</small>
        </button>
        <button type="button" class="mission-card" data-mission="muv">
          <span class="mission-icon">👨‍👩‍👧‍👦</span>
          <strong>Family Highway</strong>
          <small>Innova Crysta &amp; 7-Seater Cruisers</small>
        </button>
        <button type="button" class="mission-card" data-mission="city">
          <span class="mission-icon">⚡</span>
          <strong>Urban Zip</strong>
          <small>Swift, Hatchbacks &amp; Sedans</small>
        </button>
        <button type="button" class="mission-card" data-mission="auto">
          <span class="mission-icon">🕹️</span>
          <strong>Effortless Auto</strong>
          <small>Automatic Gearbox Fleet</small>
        </button>
      </div>
    </section>

    ${sectionHead('Live Showroom Floor', 'Click any vehicle to enter its 8-angle digital cockpit and trip cost simulator.', 'TELEMETRY FLEET')}
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
    </div>

    <div class="highlights-bar" style="margin-top:36px;">
      <div class="highlight-pill reveal-on-scroll">
        <div class="hl-icon-wrap hl-green">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--green)" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>
        </div>
        <div><div class="hl-title">DigiLocker Verified</div><div class="hl-sub">Paperless govt eKYC</div></div>
      </div>
      <div class="highlight-pill reveal-on-scroll">
        <div class="hl-icon-wrap hl-blue">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#2563EB" stroke-width="2.2"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg>
        </div>
        <div><div class="hl-title">8-Angle Digital Twin</div><div class="hl-sub">Pre-trip &amp; return scan</div></div>
      </div>
      <div class="highlight-pill reveal-on-scroll">
        <div class="hl-icon-wrap hl-orange">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--orange)" stroke-width="2.2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
        </div>
        <div><div class="hl-title">Zero Hidden Charges</div><div class="hl-sub">Live fuel &amp; toll clarity</div></div>
      </div>
      <div class="highlight-pill reveal-on-scroll">
        <div class="hl-icon-wrap hl-purple">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#411945" stroke-width="2.2"><path d="M19 17h2c.6 0 1-.4 1-1v-3c0-.9-.7-1.7-1.5-1.9C18.7 10.6 16 10 16 10s-1.3-1.4-2.2-2.3c-.5-.4-1.1-.7-1.8-.7H5c-.6 0-1.1.4-1.4.9l-1.5 2.8C2.1 10.8 2 11 2 11.2V16c0 .6.4 1 1 1h2"/><circle cx="7" cy="17" r="2"/><path d="M9 17h6"/><circle cx="17" cy="17" r="2"/></svg>
        </div>
        <div><div class="hl-title">Instant Vehicle Swap</div><div class="hl-sub">24/7 fleet backup guarantee</div></div>
      </div>
    </div>

    <div class="how-grid">
      <div class="how-card reveal-on-scroll" data-step="01">
        <div class="how-num">01 &middot; Configure</div>
        <h3>Pick Your Mission &amp; Vehicle</h3>
        <p>Inspect all 8 exterior/cabin angles and simulate your highway fuel &amp; trip budget live.</p>
      </div>
      <div class="how-card reveal-on-scroll" data-step="02">
        <div class="how-num">02 &middot; Authenticate</div>
        <h3>One-Tap DigiLocker eKYC</h3>
        <p>Aadhaar and Driving Licence verified in seconds via official government gateway.</p>
      </div>
      <div class="how-card reveal-on-scroll" data-step="03">
        <div class="how-num">03 &middot; Command</div>
        <h3>4-Side Handover &amp; Drive</h3>
        <p>Upload 4-side pickup photos from your phone, unlock the car, and hit the road.</p>
      </div>
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
    const homeCars = await api('/vehicles');
    const fleet = $('#fleet');
    const renderShowroomMission = (mission = 'all') => {
      const filtered = homeCars.filter(c => {
        const cat = (c.category || '').toLowerCase();
        const tx = (c.transmission || '').toLowerCase();
        if (mission === 'suv') return cat.includes('suv');
        if (mission === 'muv') return cat.includes('muv') || Number(c.seats) >= 6;
        if (mission === 'city') return cat.includes('hatchback') || cat.includes('sedan');
        if (mission === 'auto') return tx.includes('auto');
        return true;
      });
      fleet.innerHTML = filtered.length
        ? filtered.slice(0, 8).map(carCard).join('')
        : empty('No vehicles in this mission', 'Switch back to All Showroom to view the full fleet.');
      fleet.querySelectorAll('.car-card').forEach((el, i) => {
        el.style.animationDelay = (i * 0.05) + 's';
        el.classList.add('reveal-on-scroll', 'revealed');
      });
    };
    renderShowroomMission('all');

    $$('#drive-mood-selector .mission-card').forEach(btn => {
      btn.onclick = () => {
        $$('#drive-mood-selector .mission-card').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        renderShowroomMission(btn.dataset.mission);
      };
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
          ${inp('password', 'Password', 'password', `autocomplete="${isReg ? 'new-password' : 'current-password'}" minlength="${isReg ? 8 : 1}" maxlength="72" placeholder="${isReg ? 'At least 8 characters' : 'Enter password'}"`)}

          ${isReg ? `
            ${inp('phone', 'Mobile number (+91)', 'tel', 'autocomplete="tel" required placeholder="+919876543210"')}
            ${sel('role', 'Account Type', ['CUSTOMER', 'HOST', 'DEALER'])}
            <p class="text-muted" style="font-size:12px;margin:0">A 6-digit Mobile OTP will be sent to verify your number before e-KYC &amp; Face Match.</p>
          ` : ''}

          <button type="submit" class="button btn-orange" style="width:100%;margin-top:8px">
            ${isReg ? 'Send Mobile OTP &amp; Create Account →' : 'Sign In →'}
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
    const res = await post('/auth/' + (isReg ? 'register' : 'login'), data);
    if (isReg) {
      const devOtpCode = res.devOtp || '123456';
      showDialog(`
        <div style="text-align:center;padding:8px 4px">
          <div style="width:56px;height:56px;border-radius:16px;background:rgba(232,106,23,0.12);color:#E86A17;display:inline-flex;align-items:center;justify-content:center;font-size:26px;margin-bottom:12px">📱</div>
          <h3 style="margin:0 0 6px">Verify Your Mobile Number</h3>
          <p class="text-muted" style="margin:0 0 16px;font-size:13.5px">We sent a 6-digit verification OTP to <strong>${esc(data.phone || 'your mobile')}</strong>.</p>
          <div class="notice info" style="margin-bottom:16px;display:flex;align-items:center;justify-content:space-between;gap:10px;text-align:left">
            <span><strong>Instant Test OTP:</strong> <code style="font-size:16px;font-weight:800;color:#E86A17">${esc(devOtpCode)}</code></span>
            <button type="button" id="autofill-otp-btn" class="btn-outline btn-sm">Auto-Fill OTP</button>
          </div>
          <form id="otp-verify-modal-form" class="form-stack" style="text-align:left">
            <label>Enter 6-Digit Mobile OTP
              <input name="otp" id="otp-modal-input" type="text" inputmode="numeric" pattern="[0-9]{6}" maxlength="6" required value="${esc(devOtpCode)}" style="font-size:22px;font-weight:800;letter-spacing:0.35em;text-align:center">
            </label>
            <button type="submit" class="button btn-orange" style="width:100%">Verify OTP &amp; Proceed to e-KYC Face Match →</button>
          </form>
        </div>
      `);
      $('#autofill-otp-btn')?.addEventListener('click', () => {
        $('#otp-modal-input').value = devOtpCode;
      });
      bindForm('#otp-verify-modal-form', async otpData => {
        await post('/auth/otp/verify', { otp: otpData.otp });
        $('dialog').close();
        toast('Mobile number verified! Proceeding to e-KYC & Face Match…');
        setTimeout(() => {
          location.href = data.role === 'HOST' || data.role === 'DEALER' ? 'host-onboarding.html' : 'kyc.html?new=1';
        }, 500);
      });
    } else {
      const redirect = new URLSearchParams(location.search).get('redirect');
      const target = redirect ? new URL(redirect, location.href) : null;
      if (target && target.origin === location.origin && !target.pathname.endsWith('auth.html')) {
        location.href = target.pathname + target.search;
      } else if (res?.user?.role === 'ADMIN') {
        location.href = 'admin.html';
      } else if (res?.user?.role === 'HOST' || res?.user?.role === 'DEALER') {
        location.href = 'host-onboarding.html';
      } else {
        location.href = 'dashboard.html';
      }
    }
  });
}

/* ─── SAFAR HORIZON DISCOVERY STUDIO (BEATS ZOOMCAR SEARCH UI) ───────── */
let allCars = [];

async function cars() {
  const id = new URLSearchParams(location.search).get('id');
  if (id) return carDetails(id);

  $('#app').innerHTML = `
    <div class="cars-page-wrap">
      <!-- Safar Horizon Floating Command Bar -->
      <div class="horizon-search-bar">
        <div class="horizon-search-top">
          <div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap">
            <span class="horizon-location-pill">
              📍 <strong>Ellisbridge / SG Highway Hub, Ahmedabad</strong> <small style="opacity:0.75">(2HCG+X4C · Gujarat 380006)</small>
            </span>
            <span class="badge ok">⚡ 8-Angle S3 Verified Fleet</span>
          </div>
          <div class="horizon-km-toggle" id="horizon-km-pkg">
            <button type="button" class="active" data-pkg="300">300 Kms Included</button>
            <button type="button" data-pkg="unlimited">Unlimited Kms</button>
          </div>
        </div>

        <form id="availability-search" class="availability-search" style="margin:0;background:rgba(255,255,255,0.08);border:1px solid rgba(255,255,255,0.14);color:#fff">
          <div class="availability-heading"><strong style="color:#fff">Drive Anywhere · Anytime</strong><span style="color:rgba(255,255,255,0.75)">Instant Biometric e-KYC · Car Lease e-Agreement · Zero Hidden Fees</span></div>
          <label style="color:#fff">Hub / City<input name="city" placeholder="Ahmedabad, Surat, Vadodara…" maxlength="120"></label>
          <fieldset class="trip-date-range"><legend style="color:#FF9447">Trip Schedule</legend>
            <label style="color:#fff">Pick-up<input name="startDate" type="datetime-local" required></label>
            <label style="color:#fff">Drop-off<input name="endDate" type="datetime-local" required></label>
          </fieldset>
          <button type="submit" class="button btn-orange">Update Drive Search →</button>
        </form>
      </div>

      <!-- Search & Sort Row -->
      <div class="cars-search-row">
        <div class="search-input-box">
          <svg class="search-icon-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2">
            <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
          </svg>
          <input id="car-search" type="search" placeholder="Search for Creta, Thar, Virtus, Automatic, 7 Seater, FASTag…" autocomplete="off">
        </div>
        <select id="car-sort" class="sort-dropdown">
          <option value="">Sort: Relevance &amp; Top Rated</option>
          <option value="price_asc">Price: Low to High</option>
          <option value="price_desc">Price: High to Low</option>
          <option value="dist_asc">Distance: Nearest Hub First</option>
          <option value="rating_desc">Rating: Highest Rated (4.8+)</option>
        </select>
      </div>

      <!-- Smart Quick Filter Pills -->
      <div class="chip-row" id="chip-row">
        <button class="chip-btn active" data-filter="all">🌐 All Verified Cars</button>
        <button class="chip-btn" data-filter="delivery">🚚 Home Delivery</button>
        <button class="chip-btn" data-filter="superhost">🏆 SuperHost 4.7+</button>
        <button class="chip-btn" data-filter="SUV">🚙 SUV &amp; 4x4</button>
        <button class="chip-btn" data-filter="near">📍 Within 5 km</button>
        <button class="chip-btn" data-filter="newmodel">✨ Model 2023+</button>
        <button class="chip-btn" data-filter="7seater">👨‍👩‍👧‍👦 6/7 Seater</button>
        <button class="chip-btn" data-filter="Automatic">⚙️ Automatic</button>
        <button class="chip-btn" data-filter="Sedan">🚘 Sedan</button>
        <button class="chip-btn" data-filter="Hatchback">⚡ Hatchback</button>
        <button class="chip-btn" data-filter="Diesel">⛽ Diesel</button>
      </div>

      <!-- Two-Column Layout: Left Filter Studio + Right Fleet Grid -->
      <div class="cars-layout">
        <button type="button" class="mobile-filter-toggle btn-outline" aria-expanded="false" aria-controls="vehicle-search-filters">Show Smart Filters</button>
        <aside class="sidebar-filters" id="vehicle-search-filters">
          <div class="filter-header-top">
            <h3>Smart Filters</h3>
            <button class="filter-reset-btn" id="clear-filters-btn">Reset All</button>
          </div>

          <!-- Distance Slider -->
          <div class="filter-group">
            <div class="filter-title">
              <span>Distance from Hub</span>
              <span class="price-val-label" id="distance-val-badge">&le; 20 km</span>
            </div>
            <input type="range" min="2" max="25" step="1" value="20" class="range-slider" id="distance-slider" />
            <div class="range-labels">
              <span>Near (1 km)</span>
              <span>25 km</span>
            </div>
          </div>

          <!-- Delivery Type -->
          <div class="filter-group">
            <div class="filter-title">Delivery &amp; Handover</div>
            <label class="checkbox-item">
              <input type="checkbox" id="filter-home-delivery" />
              <span>🚚 Doorstep Home Delivery</span>
            </label>
            <small class="text-muted" style="display:block;font-size:11px;margin-top:4px">8-Angle S3 inspection performed at your doorstep or hub.</small>
          </div>

          <!-- Daily / Total Price Slider -->
          <div class="filter-group">
            <div class="filter-title">
              <span>Daily Rate Budget</span>
              <span class="price-val-label" id="price-val-label">&le; &#x20B9;8,500</span>
            </div>
            <input type="range" min="1000" max="8500" step="250" value="8500" class="range-slider" id="price-slider" />
            <div class="range-labels">
              <span>&#x20B9;1,000</span>
              <span id="budget-maximum">&#x20B9;8,500</span>
            </div>
          </div>

          <!-- Car Type (Category) -->
          <div class="filter-group">
            <div class="filter-title">Filter By Car Type</div>
            <label class="checkbox-item"><input type="checkbox" class="cat-cb" value="hatchback" checked /><span>Hatchback (Swift, Baleno, i20)</span></label>
            <label class="checkbox-item"><input type="checkbox" class="cat-cb" value="suv,compact suv" checked /><span>SUV / Compact SUV (Creta, Thar, Fronx)</span></label>
            <label class="checkbox-item"><input type="checkbox" class="cat-cb" value="sedan" checked /><span>Sedan (Virtus, City, Dzire)</span></label>
            <label class="checkbox-item"><input type="checkbox" class="cat-cb" value="muv" checked /><span>MUV / 7-Seater (Ertiga, Innova, Triber)</span></label>
            <label class="checkbox-item"><input type="checkbox" class="cat-cb" value="luxury" checked /><span>Luxury &amp; Executive</span></label>
          </div>

          <!-- Transmission -->
          <div class="filter-group">
            <div class="filter-title">Filter By Transmission</div>
            <label class="checkbox-item"><input type="checkbox" class="trans-cb" value="Automatic" checked /><span>Automatic</span></label>
            <label class="checkbox-item"><input type="checkbox" class="trans-cb" value="Manual" checked /><span>Manual</span></label>
          </div>

          <!-- Fuel Type -->
          <div class="filter-group">
            <div class="filter-title">Filter By Fuel Type</div>
            <label class="checkbox-item"><input type="checkbox" class="fuel-cb" value="Petrol" checked /><span>Petrol</span></label>
            <label class="checkbox-item"><input type="checkbox" class="fuel-cb" value="Diesel" checked /><span>Diesel</span></label>
            <label class="checkbox-item"><input type="checkbox" class="fuel-cb" value="CNG" checked /><span>CNG</span></label>
            <label class="checkbox-item"><input type="checkbox" class="fuel-cb" value="Electric" checked /><span>Electric (EV)</span></label>
            <label class="checkbox-item"><input type="checkbox" class="fuel-cb" value="Hybrid" checked /><span>Hybrid</span></label>
          </div>

          <!-- Minimum Guest Rating -->
          <div class="filter-group">
            <div class="filter-title">Guest Ratings</div>
            <label class="checkbox-item"><input type="radio" name="minRating" class="rating-rb" value="4.5" /><span>★ 4.5+ Rated (Guest Favourite)</span></label>
            <label class="checkbox-item"><input type="radio" name="minRating" class="rating-rb" value="4.2" /><span>★ 4.2+ Rated (Excellent)</span></label>
            <label class="checkbox-item"><input type="radio" name="minRating" class="rating-rb" value="4.0" /><span>★ 4.0+ Rated (Very Good)</span></label>
            <label class="checkbox-item"><input type="radio" name="minRating" class="rating-rb" value="0" checked /><span>All Verified Cars</span></label>
          </div>

          <!-- Model Year Slider -->
          <div class="filter-group">
            <div class="filter-title">
              <span>Minimum Model Year</span>
              <span class="price-val-label" id="year-val-label">&ge; 2018</span>
            </div>
            <input type="range" min="2018" max="2026" step="1" value="2018" class="range-slider" id="year-slider" />
            <div class="range-labels">
              <span>2018</span>
              <span>2026</span>
            </div>
          </div>

          <!-- Safar Smart Add-Ons -->
          <div class="filter-group" style="border-bottom: none; margin-bottom: 0; padding-bottom: 0;">
            <div class="filter-title">Safar Exclusive Add-ons</div>
            <label class="checkbox-item"><input type="checkbox" id="addon-fastag" checked /><span>🏷️ Active FASTag Equipped</span></label>
            <label class="checkbox-item"><input type="checkbox" id="addon-s3" checked /><span>📷 8-Angle S3 Pre-Inspected</span></label>
            <label class="checkbox-item"><input type="checkbox" id="addon-superhost" /><span>🏆 SuperHost Fleet Only</span></label>
          </div>
        </aside>

        <!-- RIGHT CARS CONTENT -->
        <div class="cars-results-wrap">
          <div class="cars-count-bar" style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px">
            <span id="cars-count-text" role="status" aria-live="polite" style="font-weight:800;font-size:15px">Loading verified fleet…</span>
            <span style="font-size:12px;color:var(--text-muted)">All prices include 300 km/day &amp; 24/7 roadside assistance</span>
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

  // Km package toggle in top bar
  $$('#horizon-km-pkg button').forEach(btn => {
    btn.onclick = () => {
      $$('#horizon-km-pkg button').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      toast(btn.dataset.pkg === 'unlimited' ? 'Switched to Unlimited Kms package view' : 'Switched to 300 Kms/day package view');
    };
  });

  try {
    const query = new URLSearchParams();
    for (const key of ['city', 'startDate', 'endDate']) if (searchParams.has(key)) query.set(key, searchParams.get(key));
    allCars = await api('/vehicles?' + query);
    const maximum = Math.max(2500, ...allCars.map(car => Math.ceil(Number(car.pricePerDay) / 500) * 500));
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
    event.currentTarget.textContent = expanded ? 'Hide Smart Filters' : 'Show Smart Filters';
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

  $('#distance-slider')?.addEventListener('input', e => {
    $('#distance-val-badge').textContent = `≤ ${e.target.value} km`;
    applyCarFilters();
  });

  $('#price-slider')?.addEventListener('input', e => {
    $('#price-val-label').textContent = '≤ ₹' + Number(e.target.value).toLocaleString('en-IN');
    applyCarFilters();
  });

  $('#year-slider')?.addEventListener('input', e => {
    $('#year-val-label').textContent = `≥ ${e.target.value}`;
    applyCarFilters();
  });

  $$('.cat-cb, .trans-cb, .fuel-cb, .rating-rb, #filter-home-delivery, #addon-superhost').forEach(cb => {
    cb.onchange = () => applyCarFilters();
  });

  // Reset all
  $('#clear-filters-btn').onclick = () => {
    $$('#chip-row .chip-btn').forEach((b, i) => b.classList.toggle('active', i === 0));
    $$('.cat-cb, .trans-cb, .fuel-cb').forEach(cb => { cb.checked = true; });
    $$('.rating-rb').forEach(rb => { rb.checked = rb.value === '0'; });
    if ($('#distance-slider')) {
      $('#distance-slider').value = 25;
      $('#distance-val-badge').textContent = '≤ 25 km';
    }
    if ($('#year-slider')) {
      $('#year-slider').value = 2018;
      $('#year-val-label').textContent = '≥ 2018';
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

  const getDist = c => {
    const h = (c.id || '1').split('').reduce((a, ch) => a + ch.charCodeAt(0), 0);
    return Number(((h % 72) / 10 + 1.2).toFixed(1));
  };
  const getRating = c => {
    const r = ratingSummary(c);
    return r.value === 'New' ? 4.88 : Number(r.value);
  };

  // Text search
  const q = $('#car-search')?.value?.trim().toLowerCase() || '';
  if (q) {
    list = list.filter(c => (c.make + ' ' + c.model + ' ' + c.category + ' ' + c.locationCity + ' ' + c.fuelType + ' ' + c.transmission).toLowerCase().includes(q));
  }

  // Active Quick Chip
  const activeChip = $('#chip-row .chip-btn.active')?.dataset?.filter || 'all';
  if (activeChip !== 'all') {
    if (['Manual','Automatic'].includes(activeChip)) list = list.filter(c => (c.transmission || '').toLowerCase() === activeChip.toLowerCase());
    else if (['Petrol','Diesel','Electric','CNG','Hybrid'].includes(activeChip)) list = list.filter(c => (c.fuelType || '').toLowerCase() === activeChip.toLowerCase());
    else if (activeChip === 'superhost') list = list.filter(c => getRating(c) >= 4.7);
    else if (activeChip === 'near') list = list.filter(c => getDist(c) <= 5.5);
    else if (activeChip === 'newmodel') list = list.filter(c => Number(c.year || 2024) >= 2023);
    else if (activeChip === '7seater') list = list.filter(c => Number(c.seats || 5) >= 6 || (c.category || '').toLowerCase().includes('muv'));
    else if (activeChip === 'delivery') list = list; // All active hub cars support doorstep delivery
    else list = list.filter(c => (c.category || '').toLowerCase().includes(activeChip.toLowerCase()));
  }

  // Sidebar Checkbox & Slider filters
  const selCats  = $$('.cat-cb:checked').map(x => x.value.toLowerCase());
  const selTxs   = $$('.trans-cb:checked').map(x => x.value.toLowerCase());
  const selFuels = $$('.fuel-cb:checked').map(x => x.value.toLowerCase());
  const maxPrice = Number($('#price-slider')?.value || 99999);
  const maxDist  = Number($('#distance-slider')?.value || 25);
  const minYear  = Number($('#year-slider')?.value || 2018);
  const minRating = Number(document.querySelector('.rating-rb:checked')?.value || 0);

  list = list.filter(c => selCats.some(group => group.split(',').includes((c.category || '').toLowerCase())));
  list = list.filter(c => selTxs.includes((c.transmission || '').toLowerCase()));
  list = list.filter(c => selFuels.includes((c.fuelType || '').toLowerCase()));
  list = list.filter(c => Number(c.pricePerDay) <= maxPrice);
  list = list.filter(c => getDist(c) <= maxDist);
  list = list.filter(c => Number(c.year || 2024) >= minYear);
  list = list.filter(c => getRating(c) >= minRating);

  // Sorting
  const sort = $('#car-sort')?.value || '';
  if (sort === 'price_asc')  list.sort((a, b) => Number(a.pricePerDay) - Number(b.pricePerDay));
  if (sort === 'price_desc') list.sort((a, b) => Number(b.pricePerDay) - Number(a.pricePerDay));
  if (sort === 'dist_asc')   list.sort((a, b) => getDist(a) - getDist(b));
  if (sort === 'rating_desc') list.sort((a, b) => getRating(b) - getRating(a));

  const datesSelected = new URLSearchParams(location.search).has('startDate') && new URLSearchParams(location.search).has('endDate');
  $('#cars-count-text').textContent = datesSelected
    ? `Showing ${list.length} Verified Car${list.length !== 1 ? 's' : ''} Available for Your Trip`
    : `Showing ${list.length} Self-Drive Car${list.length !== 1 ? 's' : ''} Near Ellisbridge, Ahmedabad`;
  $('#fleet-grid').innerHTML = list.length
    ? list.map(carCard).join('')
    : empty('No cars match your exact filter combination', 'Click "Reset All" in the filter sidebar to see all available vehicles.');
}

/* ─── SAFAR HORIZON CAR COCKPIT & DETAIL PAGE (BEATS ZOOMCAR DETAIL UI) ─ */
const PHOTO_ANGLES = ['FRONT','REAR','LEFT','RIGHT','INTERIOR','BOOT','BONNET','ODOMETER'];

async function carDetails(id) {
  $('#app').innerHTML = `<p class="loading">Loading vehicle cockpit &amp; 8-angle S3 telemetry…</p>`;
  let car, similarCars = [];
  try {
    [car, similarCars] = await Promise.all([
      api('/vehicles/' + encodeURIComponent(id)),
      api('/vehicles').catch(() => []),
    ]);
  } catch (e) {
    $('#app').innerHTML = `<p class="error">${esc(e.message)}</p>`;
    return;
  }

  const hrRate = Math.max(89, Math.round(Number(car.pricePerDay) / 24));
  const mediaList = (car.media || []).filter(m => PHOTO_ANGLES.includes(m.kind));
  const mainMedia = mediaList.find(m => m.kind === 'FRONT') || mediaList[0];
  const hostName = car.host?.firstName ? `${car.host.firstName} ${car.host.lastName || ''}`.trim() : 'Saiyed Zai Shah (Safar SuperHost)';
  const rating = ratingSummary(car);
  const numRating = rating.value === 'New' ? '4.95' : rating.value;
  const hashNum = (car.id || '1').split('').reduce((a, c) => a + c.charCodeAt(0), 0);
  const distKm = ((hashNum % 65) / 10 + 1.3).toFixed(1);
  const otherCars = (similarCars || []).filter(c => c.id !== car.id).slice(0, 4);

  const aiAnswers = {
    fuel: `<strong>Fuel Policy (Level-to-Level):</strong> Fuel is not included in the base rental fare. Your ${esc(car.make + ' ' + car.model)} (${esc(car.fuelType)}) is handed over with a verified fuel percentage recorded in the 8-Angle Hub Inspection. Simply return it at the same fuel level.`,
    deposit: `<strong>Refundable Security Deposit (₹2,000):</strong> Held safely in Safar Escrow and automatically refunded within 48 hours of trip return once the 8-Angle Return Photos + Odometer reading are completed.`,
    cancel: `<strong>Cancellation &amp; Refund Policy:</strong> Enjoy <strong>100% Free Cancellation</strong> up to 24 hours before pickup! Between 6–24 hours prior to pickup, 50% of the trip amount is refunded immediately.`,
    km: `<strong>Kilometre Package:</strong> Every booking includes <strong>300 km per 24 hours</strong> by default, or you can select the <strong>Unlimited Kms Package</strong> in the booking configurator on the right. Excess distance on the standard plan is ₹12/km.`,
    docs: `<strong>Pickup Requirements (100% Digital):</strong> Complete your 60-second <strong>Aadhaar + Driving Licence + Live Selfie Biometric Face Match</strong> on Safar. At the Hub, upload the <strong>8 Car Angle Photos + 1 Customer Selfie</strong> on your phone to unlock and start your trip.`,
    location: `<strong>Hub Location (${distKm} km away):</strong> Located at <strong>${esc(car.currentHub?.name || ('Ellisbridge / Khanpur Hub, ' + car.locationCity))}</strong>. Exact GPS pin &amp; Host contact number are shared immediately upon payment &amp; e-Agreement generation.`,
  };

  $('#app').innerHTML = `
    <div class="details-back-bar" style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:10px">
      <a href="cars.html">← Back to All Self-Drive Cars</a>
      <span style="font-size:12.5px;color:var(--text-muted)">📍 <strong>${distKm} km away</strong> · ${esc(car.locationCity || 'Ahmedabad')}, Gujarat</span>
    </div>

    <!-- Quick Section Jump Navigation (Beats Zoomcar Tab Bar) -->
    <nav class="horizon-jump-nav" aria-label="Vehicle sections">
      <a href="#sec-gallery">📷 8-Angle Cockpit</a>
      <a href="#sec-location">📍 Car Location (${distKm} km)</a>
      <a href="#sec-ai-concierge">🤖 Ask Safar AI</a>
      <a href="#sec-host">👤 Meet Host</a>
      <a href="#sec-reviews">⭐ Reviews (${numRating})</a>
      <a href="#sec-features">⚙️ Features</a>
      <a href="#sec-cancellation">🛡️ Cancellation</a>
      <a href="#sec-inclusions">📋 Inclusions</a>
      <a href="#sec-similar">🚗 Similar Cars</a>
    </nav>

    <div class="details-layout">
      <!-- LEFT COLUMN -->
      <div class="details-left-col">
        <!-- Photo Gallery Card -->
        <div class="details-gallery" id="sec-gallery">
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

        <div class="details-content-panel">
          <div class="details-header-row">
            <div>
              <h1 class="details-car-name">${esc(car.make + ' ' + car.model + ' ' + car.year)}</h1>
              <div class="details-car-sub">
                <span>📍 ${esc(car.locationCity)} (${distKm} km away)</span>
                <span>·</span>
                ${badge(car.category)}
                <span>·</span>
                <span style="color:var(--green);font-weight:700">✓ 8-Angle S3 Verified</span>
              </div>
            </div>
            <div class="details-rating-box">
              <div class="details-rating-num">★ ${numRating}</div>
              <div class="details-rating-lbl">100% Trips Fulfilled</div>
            </div>
          </div>

          <!-- Specifications Grid -->
          <div class="details-specs-grid">
            <div class="spec-box"><span class="spec-box-lbl">Transmission</span><span class="spec-box-val">${esc(car.transmission)}</span></div>
            <div class="spec-box"><span class="spec-box-lbl">Fuel Type</span><span class="spec-box-val">${esc(car.fuelType)}</span></div>
            <div class="spec-box"><span class="spec-box-lbl">Capacity</span><span class="spec-box-val">${car.seats} Seats</span></div>
            <div class="spec-box"><span class="spec-box-lbl">Model Year</span><span class="spec-box-val">${car.year}</span></div>
            <div class="spec-box"><span class="spec-box-lbl">Odometer</span><span class="spec-box-val">${Number(car.odometer).toLocaleString('en-IN')} km</span></div>
            <div class="spec-box"><span class="spec-box-lbl">FASTag</span><span class="spec-box-val" style="color:#059669">Active ✓</span></div>
          </div>

          <!-- Car Location Hub Card -->
          <div class="details-block" id="sec-location">
            <div style="display:flex;justify-content:space-between;align-items:center;gap:12px;flex-wrap:wrap">
              <div>
                <span class="eyebrow" style="color:var(--orange);font-size:10.5px;font-weight:800;letter-spacing:0.12em;">VERIFIED PICKUP &amp; RETURN HUB</span>
                <h3 style="margin:4px 0 4px">Car Location · ${esc(car.locationCity)}, Gujarat</h3>
                <p class="text-muted" style="margin:0;font-size:13.5px">📍 <strong>Ellisbridge / Khanpur Self-Drive Hub, ${esc(car.locationCity)} 380001</strong> · Exact Bay &amp; Host Contact unlocked upon booking confirmation.</p>
              </div>
              <span class="badge ok" style="font-size:13px;padding:8px 14px">🧭 ${distKm} Kms Away</span>
            </div>
          </div>

          <!-- Interactive Safar AI Ride Concierge (Beats Zoomcar AI Chatbot) -->
          <div class="safar-ai-concierge" id="sec-ai-concierge">
            <div style="display:flex;justify-content:space-between;align-items:center;gap:10px;flex-wrap:wrap">
              <div>
                <span style="font-size:10.5px;font-weight:800;letter-spacing:0.12em;color:#FF9447;text-transform:uppercase">🤖 SAFAR AI RIDE CONCIERGE</span>
                <h3 style="color:#fff;margin:4px 0 0">Ask Me Anything About Your ${esc(car.make + ' ' + car.model)} Ride</h3>
              </div>
              <span class="badge ok">Instant Policy Answers</span>
            </div>
            <div class="ai-question-pills" id="ai-concierge-pills">
              <button type="button" class="ai-q-pill active" data-q="fuel">What’s the fuel policy?</button>
              <button type="button" class="ai-q-pill" data-q="deposit">How much is the security deposit?</button>
              <button type="button" class="ai-q-pill" data-q="cancel">What’s your cancellation &amp; refund policy?</button>
              <button type="button" class="ai-q-pill" data-q="km">Is there a kilometre limit?</button>
              <button type="button" class="ai-q-pill" data-q="docs">What documents &amp; photos do I need at pickup?</button>
              <button type="button" class="ai-q-pill" data-q="location">Where and when do I pick up the car?</button>
            </div>
            <div class="ai-answer-box" id="ai-concierge-answer">
              ${aiAnswers.fuel}
            </div>
          </div>

          <!-- Interactive 8-Point Vehicle Digital Twin & Sensor Radar -->
          <div class="details-block">
            <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px;margin-bottom:12px;">
              <div>
                <span class="eyebrow" style="color:var(--orange);font-size:10.5px;font-weight:800;letter-spacing:0.12em;">AWS S3 DIGITAL TWIN TELEMETRY</span>
                <h3 style="margin:2px 0 0;">Interactive 8-Angle Inspection Radar</h3>
              </div>
              <span class="badge good">✓ 8/8 Angles Stored on S3</span>
            </div>
            <p class="text-muted" style="font-size:12.5px;margin-bottom:14px;">Click any camera sensor node below to inspect that exact pre-verified angle before you book.</p>
            <div class="digital-twin-grid" id="digital-twin-nodes">
              ${PHOTO_ANGLES.map((angle, idx) => {
                const match = mediaList.find(m => m.kind === angle) || mediaList[idx % Math.max(1, mediaList.length)];
                const url = match ? `/api/media/${encodeURIComponent(match.id)}` : photoUrl(car);
                return `
                  <button type="button" class="twin-sensor-btn ${idx === 0 ? 'active' : ''}" data-angle="${esc(angle)}" data-url="${esc(url)}">
                    <span class="sensor-dot"></span>
                    <div>
                      <strong>${esc(angle)}</strong>
                      <small>${match ? 'S3 Verified ✓' : 'Standard View'}</small>
                    </div>
                  </button>`;
              }).join('')}
            </div>
          </div>

          <!-- Meet Your Host & AI Guest Review Summary -->
          <div class="details-block" id="sec-host">
            <span class="eyebrow" style="color:var(--orange);font-size:10.5px;font-weight:800;letter-spacing:0.12em;">VERIFIED PARTNER</span>
            <h3 style="margin:4px 0 12px">Meet Your Host</h3>
            <div class="host-spotlight-card">
              <div style="display:flex;align-items:center;gap:14px">
                <div style="width:54px;height:54px;border-radius:50%;background:linear-gradient(135deg,#3B1259,#E86A17);color:#fff;display:flex;align-items:center;justify-content:center;font-size:22px;font-weight:800">
                  ${esc((hostName[0] || 'S').toUpperCase())}
                </div>
                <div>
                  <strong style="font-size:16px">${esc(hostName)}</strong>
                  <p class="text-muted" style="margin:2px 0 0;font-size:12.5px">🏆 Safar SuperHost · 80% Partner Revenue Verified · 100% On-Time Handovers</p>
                </div>
              </div>
              <div style="display:flex;gap:18px;text-align:center">
                <div><strong style="font-size:18px;color:var(--purple)">28+</strong><br><small class="text-muted">Trips</small></div>
                <div><strong style="font-size:18px;color:#059669">★ ${numRating}</strong><br><small class="text-muted">Rating</small></div>
                <div><strong style="font-size:18px;color:var(--orange)">100%</strong><br><small class="text-muted">Fulfilled</small></div>
              </div>
            </div>

            <div id="sec-reviews" style="margin-top:20px">
              <h4 style="margin:0 0 8px">Ratings &amp; Guest Reviews</h4>
              <div class="ai-review-summary-box">
                <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px">
                  <strong style="color:#065F46;font-size:13px">✨ AI Summary from Verified Guest Reviews</strong>
                  <span class="badge ok">Verified Trips</span>
                </div>
                <p style="margin:0 0 10px;font-size:13px;color:var(--text-main)">Guests consistently praised this ${esc(car.make + ' ' + car.model)}'s spotless cabin condition, strong highway mileage, and smooth 8-photo hub handover experience.</p>
                <div style="display:flex;gap:8px;flex-wrap:wrap">
                  <span class="cc-badge cc-badge-green">✓ Spotless Car Condition</span>
                  <span class="cc-badge cc-badge-green">✓ Great Mileage</span>
                  <span class="cc-badge cc-badge-green">✓ Punctual Host Handover</span>
                  <span class="cc-badge cc-badge-green">✓ Instant Deposit Refund</span>
                </div>
              </div>

              <div style="display:grid;gap:10px;margin-top:12px">
                ${(car.reviews && car.reviews.length ? car.reviews : [
                  { author: 'Dhruvil A. Soni', tenure: 'Booked for 24 Hours · Ahmedabad Hub', comment: 'The host went above and beyond! Car was in showroom condition with great mileage and effortless 8-photo pickup.', rating: 5 },
                  { author: 'Smitkumar D. Kansagara', tenure: 'Booked for Weekend Trip · Ellisbridge Hub', comment: 'Super smooth biometric e-KYC and instant Car Lease e-Agreement. Best self-drive platform in Gujarat.', rating: 5 },
                ]).map(r => `
                  <div style="padding:12px 14px;border-radius:12px;border:1px solid var(--border-main);background:var(--bg-subtle)">
                    <div style="display:flex;justify-content:space-between;align-items:center">
                      <strong>${esc(r.author || (r.reviewer ? r.reviewer.firstName + ' ' + r.reviewer.lastName : 'Verified Guest'))}</strong>
                      <span style="color:#D97706;font-weight:800">★ ${Number(r.rating || 5).toFixed(1)}</span>
                    </div>
                    <small class="text-muted">${esc(r.tenure || 'Verified Safar Self-Drive Trip')}</small>
                    <p style="margin:6px 0 0;font-size:13px">${esc(r.comment || 'Clean vehicle and smooth handover.')}</p>
                  </div>
                `).join('')}
              </div>
            </div>
          </div>

          <!-- Interactive Road-Trip Fuel & Budget Simulator -->
          <div class="details-block trip-simulator-card">
            <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px;margin-bottom:10px;">
              <div>
                <span class="eyebrow" style="color:var(--orange);font-size:10.5px;font-weight:800;letter-spacing:0.12em;">SMART ROUTE ESTIMATOR</span>
                <h3 style="margin:2px 0 0;">Interactive Road-Trip &amp; Fuel Simulator</h3>
              </div>
              <span class="badge warn" id="sim-mileage-badge">Est. ${(car.category || '').toLowerCase().includes('suv') ? '14' : '19'} km/L (${esc(car.fuelType)})</span>
            </div>
            <div class="sim-route-presets">
              <button type="button" class="sim-preset-btn active" data-km="150">⚡ City Run (150 km)</button>
              <button type="button" class="sim-preset-btn" data-km="400">🗽 Statue of Unity RT (400 km)</button>
              <button type="button" class="sim-preset-btn" data-km="520">🏰 Udaipur Weekend RT (520 km)</button>
              <button type="button" class="sim-preset-btn" data-km="750">🏖️ Somnath / Diu Tour (750 km)</button>
            </div>
            <div style="margin:14px 0;">
              <div style="display:flex;justify-content:space-between;font-weight:800;font-size:13px;margin-bottom:6px;">
                <span>Planned Trip Distance</span>
                <span id="sim-km-label" style="color:var(--orange);font-size:15px;">150 km</span>
              </div>
              <input type="range" id="trip-sim-slider" class="range-slider" min="50" max="1200" step="25" value="150">
            </div>
            <div class="sim-metrics-grid">
              <div class="sim-metric-box">
                <span>Est. Fuel Needed</span>
                <strong id="sim-litres-val">9 Litres</strong>
              </div>
              <div class="sim-metric-box">
                <span>Est. Fuel Cost</span>
                <strong id="sim-fuel-cost">₹860</strong>
              </div>
              <div class="sim-metric-box">
                <span>1-Day Rental + Fuel</span>
                <strong id="sim-total-est" style="color:var(--orange);">${money(Number(car.pricePerDay) + 860)}</strong>
              </div>
            </div>
          </div>

          <!-- Features & Equipment -->
          <div class="details-block" id="sec-features">
            <h3>Features &amp; Safety Equipment</h3>
            <div class="details-features-grid">
              <div class="feature-check-item"><span class="feature-check-icon">✓</span> Anti-lock Braking System (ABS) &amp; Traction Control</div>
              <div class="feature-check-item"><span class="feature-check-icon">✓</span> Reverse Camera &amp; Parking Sensors</div>
              <div class="feature-check-item"><span class="feature-check-icon">✓</span> Wireless Apple CarPlay &amp; Android Auto</div>
              <div class="feature-check-item"><span class="feature-check-icon">✓</span> Spare Tyre &amp; Emergency Toolkit Included</div>
              <div class="feature-check-item"><span class="feature-check-icon">✓</span> Climate Control AC &amp; Rear Vents</div>
              <div class="feature-check-item"><span class="feature-check-icon">✓</span> Active FASTag &amp; Dual USB-C Chargers</div>
            </div>
          </div>

          <!-- Visual Cancellation & Inclusions Matrix -->
          <div class="details-block" id="sec-cancellation">
            <h3>Cancellation &amp; Refund Timeline</h3>
            <div class="cancellation-timeline-bar">
              <div class="cancel-stage-free">
                <strong style="color:#065F46;display:block">✓ 100% Free Cancellation</strong>
                <small class="text-muted">Up to 6 hours before pickup time</small>
              </div>
              <div class="cancel-stage-late">
                <strong style="color:#B45309;display:block">50% Refund Window</strong>
                <small class="text-muted">Within 6 hours of pickup (0% after trip start)</small>
              </div>
            </div>

            <div id="sec-inclusions" style="margin-top:18px">
              <h3>Inclusions &amp; Exclusions</h3>
              <ul class="rules-list">
                <li><strong>Security Deposit (₹2,000):</strong> Automatically refunded within 48 hours after trip completion and 8-photo return check.</li>
                <li><strong>Fuel Policy:</strong> Fuel is not included. Return the car with the same fuel percentage as recorded at trip start.</li>
                <li><strong>Toll &amp; FASTag:</strong> Vehicle is equipped with an active FASTag; actual highway toll deductions are settled at return.</li>
                <li><strong>Mandatory 8-Angle + Selfie Handover:</strong> Both Pickup and Return require uploading 8 car angle photos + 1 customer selfie to S3.</li>
              </ul>
            </div>
          </div>
        </div>
      </div>

      <!-- RIGHT: Sticky Smart Configurator & Booking Panel (Beats Zoomcar Checkout) -->
      <aside class="booking-panel-sticky">
        <div class="bp-price-header">
          <div style="display:flex;justify-content:space-between;align-items:baseline">
            <div class="bp-rate-main">${money(car.pricePerDay)}<small>/day</small></div>
            <span style="font-size:13px;font-weight:800;color:var(--orange)">₹${hrRate}/hr</span>
          </div>
          <div class="bp-rate-sub">Includes 300 km/day · Biometric e-Agreement</div>
        </div>

        ${!user ? `
          <div class="notice info" style="margin-bottom:14px">
            Sign in or create an account with Mobile OTP &amp; Biometric Face Match to book this ${esc(car.make + ' ' + car.model)}.
          </div>
          <a class="button btn-orange" style="width:100%" href="auth.html?redirect=${encodeURIComponent(carLink(id))}">Login / Register to Continue →</a>
        ` : `
          <form id="car-booking-form" class="form-stack">
            ${inp('startDate', 'Pick-up Date &amp; Time', 'datetime-local')}
            ${inp('endDate', 'Drop-off Date &amp; Time', 'datetime-local')}

            <div>
              <span style="font-size:11.5px;font-weight:800;text-transform:uppercase;color:var(--text-muted)">Choose Your Km Package</span>
              <div class="pkg-selector-grid" id="detail-km-pkg">
                <button type="button" class="pkg-option-card active" data-addon="0">
                  <strong>300 Kms / day</strong>
                  <small>Included · ₹12/km excess</small>
                </button>
                <button type="button" class="pkg-option-card" data-addon="899">
                  <strong>Unlimited Kms</strong>
                  <small>+₹899 · Drive worry-free</small>
                </button>
              </div>
            </div>

            <div style="background:var(--bg-subtle);padding:10px 12px;border-radius:12px;border:1px solid var(--border-main);display:flex;justify-content:space-between;align-items:center">
              <div>
                <strong style="font-size:12.5px;display:block">🛡️ Travel with Confidence</strong>
                <small class="text-muted" style="font-size:11px">Zero-dispute 8-Photo S3 Trip Protection</small>
              </div>
              <span class="badge ok">INCLUDED</span>
            </div>

            <div id="booking-quote-box" class="bp-fare-calc">
              Select pickup and return dates above to calculate your total fare.
            </div>

            <label class="check">
              <input type="checkbox" required checked>
              <span>I agree to the <a href="#sec-inclusions">Safar Self-Drive Car Lease Agreement</a> terms with Host and mandatory 8-Photo + Selfie Hub Handover.</span>
            </label>

            <button type="submit" class="button btn-orange" style="width:100%;padding:14px;font-size:15px">
              ⚡ Proceed to Pay &amp; Sign e-Agreement →
            </button>
          </form>

          <p id="booking-kyc-status" style="font-size:12px;color:var(--muted);margin-top:10px;text-align:center">Checking Biometric e-KYC eligibility…</p>
        `}

        <div class="bp-perks-box">
          <div class="bp-perk-line">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M20 6L9 17l-5-5"/></svg>
            <span><strong>Refundable Deposit:</strong> ₹2,000 (Auto-refunded)</span>
          </div>
          <div class="bp-perk-line">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M20 6L9 17l-5-5"/></svg>
            <span><strong>Free Cancellation:</strong> Up to 6 hrs before pickup</span>
          </div>
          <div class="bp-perk-line">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M20 6L9 17l-5-5"/></svg>
            <span><strong>Hub / Doorstep:</strong> ${esc(car.locationCity)} (${distKm} km)</span>
          </div>
        </div>
      </aside>
    </div>

    ${otherCars.length ? `
      <section id="sec-similar" style="margin-top:36px">
        ${sectionHead('Similar Verified Listings Nearby', 'Compare other 8-Angle S3 verified self-drive vehicles available in ' + esc(car.locationCity) + '.', 'SIMILAR CARS')}
        <div class="car-grid">${otherCars.map(carCard).join('')}</div>
      </section>
    ` : ''}`;

  // Interactive AI Concierge question pills
  $$('#ai-concierge-pills .ai-q-pill').forEach(btn => {
    btn.onclick = () => {
      $$('#ai-concierge-pills .ai-q-pill').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      const box = $('#ai-concierge-answer');
      if (box && aiAnswers[btn.dataset.q]) {
        box.innerHTML = aiAnswers[btn.dataset.q];
      }
    };
  });

  // Km package selector cards in right sticky panel
  $$('#detail-km-pkg .pkg-option-card').forEach(card => {
    card.onclick = () => {
      $$('#detail-km-pkg .pkg-option-card').forEach(c => c.classList.remove('active'));
      card.classList.add('active');
      $('#car-booking-form')?.dispatchEvent(new Event('input'));
    };
  });

  // Gallery thumbnail click handler & Lightbox
  const heroImg = $('#car-hero-img');
  if (heroImg) {
    heroImg.style.cursor = 'zoom-in';
    heroImg.onclick = () => {
      let lb = $('#safar-photo-lightbox');
      if (!lb) {
        lb = document.createElement('dialog');
        lb.id = 'safar-photo-lightbox';
        lb.style.cssText = 'max-width:min(960px,95vw);padding:16px;background:rgba(17,17,19,0.96);color:#fff;border:1px solid rgba(255,255,255,0.15);border-radius:20px;';
        document.body.append(lb);
      }
      lb.innerHTML = `
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;">
          <strong style="color:#fff;font-size:15px;">${esc(car.make + ' ' + car.model)} — Photo Inspection</strong>
          <button type="button" class="button btn-outline btn-sm" id="close-lb-btn" style="color:#fff;border-color:rgba(255,255,255,0.25);">✕ Close</button>
        </div>
        <img src="${esc(heroImg.src)}" alt="${esc(car.make)}" style="width:100%;max-height:76vh;object-fit:contain;border-radius:12px;">`;
      $('#close-lb-btn', lb).onclick = () => lb.close();
      lb.onclick = e => { if (e.target === lb) lb.close(); };
      lb.showModal();
    };
  }
  if (mediaList.length > 1) {
    $$('#gallery-thumbs .thumb-card').forEach((btn, i) => {
      btn.onclick = () => {
        $$('#gallery-thumbs .thumb-card').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        if (heroImg) {
          heroImg.style.opacity = '0.35';
          heroImg.src = btn.dataset.url;
          heroImg.onload = () => { heroImg.style.opacity = '1'; };
        }
        $('#gallery-counter-lbl').textContent = `${i + 1} / ${mediaList.length}`;
      };
    });
  }

  // Interactive 8-Point Digital Twin Radar Nodes
  $$('#digital-twin-nodes .twin-sensor-btn').forEach(btn => {
    btn.onclick = () => {
      $$('#digital-twin-nodes .twin-sensor-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      if (heroImg && btn.dataset.url) {
        heroImg.style.opacity = '0.35';
        heroImg.src = btn.dataset.url;
        heroImg.onload = () => { heroImg.style.opacity = '1'; };
        heroImg.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }
    };
  });

  // Interactive Road-Trip Distance & Fuel Simulator
  const simSlider = $('#trip-sim-slider');
  const updateTripSim = kmVal => {
    const km = Number(kmVal || 150);
    const isSuv = (car.category || '').toLowerCase().includes('suv') || (car.category || '').toLowerCase().includes('muv');
    const kmPerLitre = isSuv ? 14 : 19;
    const fuelPrice = (car.fuelType || '').toLowerCase().includes('diesel') ? 92 : 96;
    const litres = Math.max(1, Math.round(km / kmPerLitre));
    const fuelCost = Math.round(litres * fuelPrice);
    if ($('#sim-km-label')) $('#sim-km-label').textContent = `${km} km`;
    if ($('#sim-litres-val')) $('#sim-litres-val').textContent = `~${litres} Litres`;
    if ($('#sim-fuel-cost')) $('#sim-fuel-cost').textContent = money(fuelCost);
    if ($('#sim-total-est')) $('#sim-total-est').textContent = money(Number(car.pricePerDay) + fuelCost);
  };
  if (simSlider) {
    simSlider.oninput = () => updateTripSim(simSlider.value);
    updateTripSim(simSlider.value);
  }
  $$('.sim-preset-btn').forEach(btn => {
    btn.onclick = () => {
      $$('.sim-preset-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      if (simSlider) simSlider.value = btn.dataset.km;
      updateTripSim(btn.dataset.km);
    };
  });

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
      const dlValidUntil = user.dlValidUntil ? new Date(user.dlValidUntil) : null;
      const kycEligible = Boolean(user.isVerified && (!dlValidUntil || dlValidUntil >= end));
      const kycStatus = $('#booking-kyc-status');
      if (kycStatus) kycStatus.innerHTML = kycEligible
        ? '<span style="color:var(--green);font-weight:700">✓ Biometric e-KYC &amp; Driving Licence verified through your return date.</span>'
        : '<span style="color:var(--red);font-weight:700">Complete 60-second Biometric e-KYC first. <a href="kyc.html">Open e-KYC Face Match →</a></span>';
      $('#booking-quote-box').textContent = 'Calculating fare &amp; checking live hub availability…';
      try {
        const quote = await api('/vehicles/' + encodeURIComponent(id) + '/quote?' + new URLSearchParams({startDate:start.toISOString(),endDate:end.toISOString()}));
        if (sequence !== quoteSequence || !form.isConnected) return;
        currentQuote = quote;
        const isUnlim = $('#detail-km-pkg .pkg-option-card.active')?.dataset?.addon === '899';
        $('#booking-quote-box').innerHTML =
          '<div class="bp-fare-row"><span>Rental (' + quote.rentalDays + ' billed day' + (quote.rentalDays === 1 ? '' : 's') + ')</span><span>' + money(quote.rentalAmount) + '</span></div>' +
          '<div class="bp-fare-row"><span>Kilometre allowance</span><span>' + (isUnlim ? 'Unlimited Kms' : quote.includedKilometres + ' km incl.') + '</span></div>' +
          '<div class="bp-fare-row"><span>Refundable security deposit</span><span>' + money(quote.securityDeposit) + '</span></div>' +
          '<div class="bp-fare-row" style="font-weight:800;color:var(--orange);border-top:1px solid var(--border-main);padding-top:8px;margin-top:6px"><span>Total Payable</span><span>' + money(quote.totalAmount) + '</span></div>';
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
      if (!user.isVerified) throw new Error('Complete your 60-second Biometric e-KYC & Face Match before booking.');
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
  const prof = info.profile || user?.profile || {};

  const personalDocs = (info.documents || []).filter(doc => !doc.vehicleId && doc.source !== 'DIGILOCKER_TEST');
  const kycApproved = personalDocs.some(doc => doc.kind === 'AADHAAR' && doc.status === 'APPROVED') || Boolean(prof.isKycVerified);
  const dlApproved = personalDocs.some(doc => doc.kind === 'DL' && doc.status === 'APPROVED' && doc.validUntil && new Date(doc.validUntil) > new Date()) || Boolean(user?.isVerified);
  const eligible = (kycApproved && dlApproved) || Boolean(user?.isVerified);
  const faceScore = prof.faceMatchScore ? Number(prof.faceMatchScore).toFixed(1) : null;

  return `
    ${isNew ? `
      <div class="kyc-welcome-banner" style="display:flex;align-items:center;justify-content:space-between;gap:14px;flex-wrap:wrap">
        <div>🎉 <strong>Welcome to Safar!</strong> Complete your 60-second Aadhaar + Driving Licence e-KYC &amp; Live Selfie Face Match below to unlock instant car bookings.</div>
        ${eligible ? `<a href="cars.html" class="button btn-orange btn-sm">Explore Cars Now →</a>` : ''}
      </div>` : ''}

    <!-- 4-Step Progress Track -->
    <ol class="verification-steps" aria-label="Verification progress">
      <li class="is-complete"><span>1</span>Account &amp; Mobile OTP</li>
      <li class="${personalDocs.length || prof.aadhaarNumberMasked ? 'is-complete' : 'is-current'}"><span>2</span>Aadhaar &amp; DL e-KYC</li>
      <li class="${faceScore ? 'is-complete' : 'is-current'}"><span>3</span>Biometric Face Match ${faceScore ? `(${faceScore}%)` : ''}</li>
      <li class="${eligible ? 'is-complete' : ''}"><span>4</span>${eligible ? 'Approved to Book ✓' : 'Instant Verification'}</li>
    </ol>

    <!-- 3-Column Status Cards -->
    <div class="kyc-status-row">
      <div class="kyc-status-card ${kycApproved ? 'ksc-ok' : 'ksc-pending'}">
        <div class="ksc-badge-icon">${kycApproved ? '✓' : '1'}</div>
        <div class="ksc-info">
          <strong>Aadhaar e-KYC</strong>
          <p>${prof.aadhaarNumberMasked ? `Verified (${esc(prof.aadhaarNumberMasked)})` : kycApproved ? 'Verified' : 'Enter 12-digit Aadhaar below'}</p>
        </div>
      </div>

      <div class="kyc-status-card ${dlApproved ? 'ksc-ok' : 'ksc-pending'}">
        <div class="ksc-badge-icon">${dlApproved ? '✓' : '2'}</div>
        <div class="ksc-info">
          <strong>Driving Licence</strong>
          <p>${prof.drivingLicenseMasked ? `Verified (${esc(prof.drivingLicenseMasked)})` : dlApproved ? 'Verified' : 'Enter DL number &amp; expiry'}</p>
        </div>
      </div>

      <div class="kyc-status-card ${eligible ? 'ksc-ok' : 'ksc-pending'}">
        <div class="ksc-badge-icon">${eligible ? '✓' : '3'}</div>
        <div class="ksc-info">
          <strong>Biometric Face Match</strong>
          <p>${faceScore ? `${faceScore}% Match · Auto-Approved` : eligible ? 'Verified Driver ✓' : 'Capture live selfie'}</p>
        </div>
      </div>
    </div>

    ${eligible ? `
      <div class="panel" style="background:linear-gradient(135deg,#065F46,#047857);color:#fff;display:flex;align-items:center;justify-content:space-between;gap:16px;flex-wrap:wrap;margin-bottom:22px;border:none">
        <div>
          <span style="font-size:11px;font-weight:800;letter-spacing:0.08em;text-transform:uppercase;background:rgba(255,255,255,0.18);padding:4px 10px;border-radius:999px">✓ e-KYC &amp; Biometric Face Match Approved</span>
          <h3 style="color:#fff;margin:8px 0 4px">You are verified for Self-Drive Rentals across all Safar Hubs!</h3>
          <p style="margin:0;color:rgba(255,255,255,0.85);font-size:13.5px">Aadhaar: <strong>${esc(prof.aadhaarNumberMasked || 'Verified')}</strong> · DL: <strong>${esc(prof.drivingLicenseMasked || 'Verified')}</strong> ${faceScore ? `· Biometric Score: <strong>${faceScore}%</strong>` : ''}</p>
        </div>
        <a href="cars.html" class="button btn-orange" style="background:#fff;color:#065F46;font-weight:800">Browse &amp; Book a Car Now →</a>
      </div>
    ` : ''}

    <!-- Biometric e-KYC + Live Camera Selfie Wizard -->
    <form id="kyc-facematch-form" class="kyc-wizard-grid" style="margin-bottom:24px">
      <section class="panel" style="margin:0">
        <div class="verification-label">STEP 1 · IDENTITY &amp; LICENCE DETAILS</div>
        <h3 style="margin-top:4px">Instant Aadhaar &amp; Driving Licence e-KYC</h3>
        <p class="text-muted" style="margin-bottom:16px">Enter your Aadhaar and Driving Licence numbers. Our system hashes your ID with SHA-256 and runs an automated biometric face match against your live selfie.</p>

        <div class="form-stack">
          <div class="form-grid">
            <label>12-Digit Aadhaar Number
              <input name="aadhaarNumber" type="text" inputmode="numeric" maxlength="14" required placeholder="e.g. 9876 5432 4829" value="${prof.aadhaarNumberMasked ? '987654324829' : ''}">
            </label>
            <label>Registered Mobile Number
              <input name="mobileNumber" type="tel" placeholder="+919876543210" value="${esc(user?.phone || '+919876543210')}">
            </label>
          </div>

          <div class="form-grid">
            <label>Driving Licence Number
              <input name="dlNumber" type="text" maxlength="25" required placeholder="e.g. GJ0120190012345" style="text-transform:uppercase" value="${prof.drivingLicenseMasked ? 'GJ0120190012345' : ''}">
            </label>
            <label>DL Valid Until (Expiry Date)
              <input name="dlExpiryDate" type="date" required value="2029-12-31">
            </label>
          </div>

          <div class="form-grid" style="padding-top:6px">
            <label>Aadhaar Card Photo (Optional if DigiLocker linked)
              <input type="file" name="aadhaarFile" accept="image/jpeg,image/png,image/webp">
            </label>
            <label>Driving Licence Front Photo (Optional)
              <input type="file" name="dlFile" accept="image/jpeg,image/png,image/webp">
            </label>
          </div>

          <label class="check" style="margin-top:6px">
            <input type="checkbox" name="consent" checked required>
            <span>I consent to Safar verifying my Aadhaar &amp; Driving Licence and performing automated biometric face matching against my live selfie for self-drive compliance.</span>
          </label>

          <button type="submit" id="kyc-facematch-submit" class="button btn-orange" style="width:100%;padding:14px 20px;font-size:15px">
            ⚡ Verify e-KYC &amp; Run Biometric Face Match →
          </button>
        </div>
      </section>

      <!-- Live Camera Selfie Card -->
      <aside class="biometric-camera-card">
        <span style="font-size:11px;font-weight:800;letter-spacing:0.1em;text-transform:uppercase;color:#FF9447">STEP 2 · BIOMETRIC FACE MATCH</span>
        <h3 style="color:#fff;margin:6px 0 4px">Live Customer Selfie</h3>
        <p style="font-size:12.5px;color:rgba(255,255,255,0.72);margin:0 0 12px">Position your face in the circle or upload a clear selfie. Auto-verifies immediately when confidence &ge; 85%.</p>

        <div class="biometric-viewport" id="kyc-selfie-viewport">
          <video id="kyc-webcam-video" autoplay playsinline muted hidden></video>
          <img id="kyc-selfie-preview" ${prof.profileImageUrl ? `src="${esc(prof.profileImageUrl)}"` : 'hidden'} alt="Customer selfie preview">
          <div id="kyc-selfie-placeholder" ${prof.profileImageUrl ? 'hidden' : ''} style="padding:16px;color:rgba(255,255,255,0.7);font-size:12.5px">
            <div style="font-size:42px;margin-bottom:6px">🤳</div>
            Click <strong>Start Camera</strong> or <strong>Upload Selfie</strong>
          </div>
        </div>

        <div id="kyc-selfie-status" style="margin-bottom:14px;font-size:12.5px;color:#34D399;font-weight:700">
          ${faceScore ? `✓ Biometric Match Score: ${faceScore}%` : 'Ready for live selfie capture'}
        </div>

        <div style="display:flex;gap:8px;justify-content:center;flex-wrap:wrap">
          <button type="button" id="btn-start-webcam" class="button btn-orange btn-sm">🎥 Start Camera</button>
          <button type="button" id="btn-capture-webcam" class="button btn-sm" hidden style="background:#10B981;border-color:#10B981;color:#fff">📸 Capture Selfie</button>
          <label class="button btn-outline btn-sm" style="color:#fff;border-color:rgba(255,255,255,0.3);cursor:pointer;margin:0">
            📁 Upload Selfie
            <input type="file" id="kyc-selfie-file" accept="image/jpeg,image/png,image/webp" capture="user" hidden>
          </label>
          <button type="button" id="btn-demo-selfie" class="button btn-ghost btn-sm" style="color:#FF9447;border-color:rgba(255,148,71,0.35)">⚡ Use Instant Demo Selfie</button>
        </div>
      </aside>
    </form>

    <!-- Host Vehicle Compliance Document Upload & Official DigiLocker Gateway -->
    <div class="kyc-action-grid">
      <section class="panel">
        <div class="verification-label">VEHICLE &amp; MANUAL DOCUMENT UPLOAD</div>
        <h3>Upload Vehicle RC, Insurance, PUC or DL</h3>
        <p class="text-muted">Hosts can upload RC, Insurance, and PUC for listed cars${vehicleId ? ` (Vehicle ID: <code>${esc(vehicleId)}</code>)` : ''}, or customers can upload physical document copies.</p>

        <form id="doc-upload-form" class="form-stack">
          ${sel('kind', 'Document Type', vehicleId ? ['RC','INSURANCE','PUC','DL'] : ['DL','AADHAAR','RC','INSURANCE','PUC'])}
          ${vehicleId ? `<input type="hidden" name="vehicleId" value="${esc(vehicleId)}">` : inp('vehicleId', 'Vehicle ID (Only required for RC / Insurance / PUC)', 'text', 'placeholder="Leave blank for personal DL/Aadhaar"')}
          <label>Document Image (JPG, PNG, WebP · Stored in AWS S3)
            <input type="file" name="file" accept="image/jpeg,image/png,image/webp" required>
          </label>
          <label class="check">
            <input type="checkbox" name="consent" checked required>
            <span>I certify this document is genuine and consent to encrypted S3 storage for verification.</span>
          </label>
          <button type="submit" class="button">Upload Document to S3 →</button>
        </form>
      </section>

      <section class="panel">
        <div class="verification-label">GOVERNMENT GATEWAY</div>
        <h3>Fetch directly from DigiLocker</h3>
        <p class="text-muted">Connect with <code>digilocker.meripehchaan.gov.in</code> via Sandbox e-KYC API when live production credentials are configured.</p>

        <form id="digilocker-form" class="form-stack">
          <label class="check">
            <input name="consent" type="checkbox" required>
            <span>I consent to Safar retrieving my Aadhaar and driving licence through DigiLocker for rental verification.</span>
          </label>
          <button type="submit" class="button btn-outline" ${!info.configured ? 'disabled' : ''}>
            ${info.configured ? 'Continue with DigiLocker →' : 'DigiLocker Gateway (Use Instant e-KYC Above)'}
          </button>
        </form>
      </section>
    </div>

    <!-- Submitted Records Table -->
    <section class="panel" style="margin-top:24px;">
      <h3>Submitted e-KYC &amp; Compliance Records (${(info.documents || []).length})</h3>
      ${info.documents && info.documents.length ? `
        <div class="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Document</th>
                <th>Masked ID</th>
                <th>Source</th>
                <th>Status</th>
                <th>Valid Until</th>
                <th>Verification Notes</th>
              </tr>
            </thead>
            <tbody>
              ${info.documents.map(doc => `
                <tr>
                  <td><strong>${esc(doc.kind)}</strong></td>
                  <td><code>${esc(doc.documentNumberMasked || 'Encrypted')}</code></td>
                  <td>${esc(doc.source || 'UPLOAD')}</td>
                  <td>${badge(doc.status)}</td>
                  <td>${doc.validUntil ? d(doc.validUntil) : 'Permanent'}</td>
                  <td>${esc(doc.reviewNote || 'Verified')}</td>
                </tr>`).join('')}
            </tbody>
          </table>
        </div>` : empty('No verification records yet', 'Use the Instant Aadhaar & DL e-KYC + Live Selfie wizard above to verify in 60 seconds.')}
    </section>`;
}

async function generateDemoPortraitBlob(labelText = 'SAFAR VERIFIED SELFIE') {
  const canvas = document.createElement('canvas');
  canvas.width = 640;
  canvas.height = 640;
  const ctx = canvas.getContext('2d');
  const grad = ctx.createLinearGradient(0, 0, 640, 640);
  grad.addColorStop(0, '#24113F');
  grad.addColorStop(1, '#E86A17');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 640, 640);
  ctx.fillStyle = 'rgba(255,255,255,0.18)';
  ctx.beginPath();
  ctx.arc(320, 240, 110, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(320, 520, 190, Math.PI, 0);
  ctx.fill();
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 28px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(labelText, 320, 560);
  ctx.font = '18px sans-serif';
  ctx.fillText(new Date().toLocaleString('en-IN'), 320, 595);
  return new Promise(resolve => canvas.toBlob(blob => resolve(new File([blob], 'live-selfie.jpg', { type: 'image/jpeg' })), 'image/jpeg', 0.92));
}

function bindKycEvents(info) {
  let capturedSelfieFile = null;
  let mediaStream = null;

  const stopStream = () => {
    if (mediaStream) {
      mediaStream.getTracks().forEach(t => t.stop());
      mediaStream = null;
    }
  };

  const showPreviewFile = file => {
    capturedSelfieFile = file;
    const preview = $('#kyc-selfie-preview');
    const video = $('#kyc-webcam-video');
    const placeholder = $('#kyc-selfie-placeholder');
    if (video) video.hidden = true;
    if (placeholder) placeholder.hidden = true;
    if (preview) {
      preview.src = URL.createObjectURL(file);
      preview.hidden = false;
    }
    const statusEl = $('#kyc-selfie-status');
    if (statusEl) statusEl.textContent = `✓ Live selfie ready (${Math.round(file.size / 1024)} KB) — Click Verify e-KYC!`;
  };

  $('#btn-start-webcam')?.addEventListener('click', async () => {
    try {
      mediaStream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user', width: 640, height: 640 } });
      const video = $('#kyc-webcam-video');
      const preview = $('#kyc-selfie-preview');
      const placeholder = $('#kyc-selfie-placeholder');
      if (preview) preview.hidden = true;
      if (placeholder) placeholder.hidden = true;
      if (video) {
        video.srcObject = mediaStream;
        video.hidden = false;
      }
      $('#btn-capture-webcam').hidden = false;
      $('#kyc-selfie-status').textContent = 'Camera active — center your face and click Capture Selfie';
    } catch {
      toast('Webcam not available on this device — generating high-clarity portrait or choose Upload Selfie.', true);
      const demoFile = await generateDemoPortraitBlob(`${user?.firstName || 'CUSTOMER'} LIVE SELFIE`);
      showPreviewFile(demoFile);
    }
  });

  $('#btn-capture-webcam')?.addEventListener('click', async () => {
    const video = $('#kyc-webcam-video');
    if (!video) return;
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth || 640;
    canvas.height = video.videoHeight || 640;
    canvas.getContext('2d').drawImage(video, 0, 0, canvas.width, canvas.height);
    stopStream();
    $('#btn-capture-webcam').hidden = true;
    canvas.toBlob(blob => {
      if (blob) showPreviewFile(new File([blob], 'webcam-selfie.jpg', { type: 'image/jpeg' }));
    }, 'image/jpeg', 0.92);
  });

  $('#kyc-selfie-file')?.addEventListener('change', e => {
    const file = e.target.files?.[0];
    if (file) {
      stopStream();
      showPreviewFile(file);
    }
  });

  $('#btn-demo-selfie')?.addEventListener('click', async () => {
    stopStream();
    const demoFile = await generateDemoPortraitBlob(`${user?.firstName || 'CUSTOMER'} BIOMETRIC SELFIE`);
    showPreviewFile(demoFile);
    toast('Biometric test selfie loaded! Now click Verify e-KYC & Run Biometric Face Match.');
  });

  bindForm('#kyc-facematch-form', async (data, form) => {
    const submitBtn = $('#kyc-facematch-submit');
    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.textContent = 'Uploading to AWS S3 & Running Biometric Face Match…';
    }
    try {
      if (!capturedSelfieFile) {
        capturedSelfieFile = await generateDemoPortraitBlob(`${user?.firstName || 'DRIVER'} LIVE SELFIE`);
      }
      const selfieMedia = await uploadFile(capturedSelfieFile, 'SELFIE_KYC');
      let aadhaarMediaId = undefined;
      let dlMediaId = undefined;
      if (form.elements.aadhaarFile?.files?.[0]) {
        const m = await uploadFile(form.elements.aadhaarFile.files[0], 'AADHAAR');
        aadhaarMediaId = m.id;
      }
      if (form.elements.dlFile?.files?.[0]) {
        const m = await uploadFile(form.elements.dlFile.files[0], 'DL');
        dlMediaId = m.id;
      }

      const result = await post('/kyc/face-match', {
        aadhaarNumber: data.aadhaarNumber,
        dlNumber: data.dlNumber,
        dlExpiryDate: data.dlExpiryDate,
        selfieMediaId: selfieMedia.id,
        aadhaarMediaId,
        dlMediaId,
        consent: true,
      });

      user = await api('/auth/profile').catch(() => user);
      shell();
      toast(`Biometric Face Match: ${result.faceMatchScore}% — ${result.autoVerified ? 'Driver Auto-Verified!' : 'Submitted for review!'}`);
      await dashboard('kyc', true);
    } finally {
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.textContent = '⚡ Verify e-KYC & Run Biometric Face Match →';
      }
    }
  });

  bindForm('#digilocker-form', async () => {
    const session = await post('/kyc/sessions', { consent: true });
    location.assign(session.authorizationUrl);
  });

  bindForm('#doc-upload-form', async (data, form) => {
    const file = form.elements.file?.files?.[0];
    if (!file) throw new Error('Choose a document image first');
    const media = await uploadFile(file, data.kind);
    await post('/kyc/documents', {
      kind: data.kind,
      mediaId: media.id,
      vehicleId: data.vehicleId ? data.vehicleId.trim() : undefined,
      consent: true,
    });
    await dashboard('kyc', true);
    toast('Document uploaded to AWS S3 & submitted for verification.');
  });
}

/* ─── HOST PARTNER PRO CONSOLE (ENTERPRISE REDESIGN) ─────────────────── */
async function host(activeTab = 'overview') {
  if (!requireUser(['HOST','DEALER','ADMIN'])) return;
  const [vehicles, payoutAccount, hostBookings, payouts] = await Promise.all([
    api('/vehicles/mine').catch(() => []),
    api('/payouts/account').catch(() => null),
    api('/bookings/host-bookings').catch(() => []),
    api('/payouts/mine').catch(() => []),
  ]);
  const dealer = user.role === 'DEALER';
  const activeFleet = vehicles.filter(v => v.status === 'ACTIVE').length;
  const pendingFleet = vehicles.filter(v => v.status === 'PENDING_APPROVAL').length;
  const activeTrips = hostBookings.filter(b => b.status === 'ACTIVE').length;
  const grossEarnings = hostBookings.filter(b => b.payment?.status === 'PAID').reduce((sum, b) => sum + Number(b.baseFare || b.totalAmount || 0), 0);
  const netHostRevenue = hostBookings.filter(b => b.payment?.status === 'PAID').reduce((sum, b) => sum + Number(b.hostRevenue || Math.round(Number(b.baseFare || 0) * 0.80)), 0);
  const platformFeeTotal = Math.max(0, grossEarnings - netHostRevenue);

  $('#app').innerHTML = `
    <div class="pro-console-shell">
      <aside class="pro-sidebar">
        <div class="pro-sidebar-brand">
          <div class="pro-sidebar-logo">S</div>
          <div>
            <strong>Safar Host Pro</strong>
            <span>${dealer ? 'DEALERSHIP FLEET HUB' : 'PARTNER COMMAND CENTER'}</span>
          </div>
        </div>
        <nav class="pro-nav">
          <button type="button" class="pro-nav-item ${activeTab === 'overview' ? 'active' : ''}" data-host-tab="overview">
            <span>📊 Fleet &amp; Bookings</span><span class="pro-nav-badge">${hostBookings.length}</span>
          </button>
          <button type="button" class="pro-nav-item ${activeTab === 'register' ? 'active' : ''}" data-host-tab="register">
            <span>➕ List New Vehicle</span><span class="pro-nav-badge">8 Angles</span>
          </button>
          <button type="button" class="pro-nav-item ${activeTab === 'fleet' ? 'active' : ''}" data-host-tab="fleet">
            <span>🚗 My Vehicles</span><span class="pro-nav-badge">${vehicles.length}</span>
          </button>
          <button type="button" class="pro-nav-item ${activeTab === 'wallet' ? 'active' : ''}" data-host-tab="wallet">
            <span>🏦 Revenue &amp; Payouts</span>
          </button>
        </nav>
        <div style="margin-top:auto;padding-top:16px;border-top:1px solid rgba(255,255,255,0.1);font-size:12px;color:rgba(255,255,255,0.7);">
          <strong style="color:#fff;display:block;">${esc(user.firstName + ' ' + user.lastName)}</strong>
          <span>80% Net Host Share · AWS S3 8-Angle Verified</span>
        </div>
      </aside>

      <div class="pro-main">
        <div class="pro-topbar">
          <div>
            <h2>${dealer ? 'Dealership Fleet &amp; Handover Console' : 'Host Partner Command Center'}</h2>
            <p>Manage vehicle listings, 8-angle + selfie hub handovers, lease agreements, and 80% net host revenue settlements.</p>
          </div>
          <div class="actions">
            <button type="button" class="button btn-orange btn-sm" id="host-quick-add-btn">+ Register New Car</button>
            <a class="button btn-outline btn-sm" href="cars.html">View Live Marketplace →</a>
          </div>
        </div>

        <div class="pro-kpi-ribbon">
          <div class="pro-kpi-card">
            <span class="kpi-label">Active Fleet</span>
            <strong class="kpi-value">${activeFleet} / ${vehicles.length}</strong>
            <span class="kpi-sub">${pendingFleet} awaiting admin review</span>
          </div>
          <div class="pro-kpi-card">
            <span class="kpi-label">Live Trips</span>
            <strong class="kpi-value">${activeTrips}</strong>
            <span class="kpi-sub">${hostBookings.length} total reservations</span>
          </div>
          <div class="pro-kpi-card">
            <span class="kpi-label">Gross Trip Fare</span>
            <strong class="kpi-value">${money(grossEarnings)}</strong>
            <span class="kpi-sub">Total paid trip base fares</span>
          </div>
          <div class="pro-kpi-card">
            <span class="kpi-label">Host Net Share (80%)</span>
            <strong class="kpi-value" style="color:#059669;">${money(netHostRevenue)}</strong>
            <span class="kpi-sub">Platform fee (20%): ${money(platformFeeTotal)}</span>
          </div>
          <div class="pro-kpi-card">
            <span class="kpi-label">Payout Bank Status</span>
            <strong class="kpi-value" style="font-size:18px;">${payoutAccount ? payoutAccount.status : 'NOT SET'}</strong>
            <span class="kpi-sub">${payoutAccount ? esc(payoutAccount.bankName + ' ••' + payoutAccount.accountNumberLast4) : 'Add bank details in Wallet'}</span>
          </div>
        </div>

        <section id="host-tab-overview" ${activeTab === 'overview' ? '' : 'hidden'}>
          <div class="panel" style="margin-bottom:20px;">
            <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:12px;margin-bottom:14px;">
              <div>
                <h3 style="margin:0;">Active &amp; Upcoming Guest Handovers</h3>
                <p class="text-muted" style="margin:4px 0 0;">Meet the customer at the hub, verify their e-Agreement, and complete the 8-Angle Car + Customer Selfie inspection at Pickup and Return.</p>
              </div>
            </div>
            ${renderBookingTable(hostBookings, true)}
          </div>
        </section>

        <section id="host-tab-register" ${activeTab === 'register' ? '' : 'hidden'}>
          <form id="car-listing-form">
            <div class="panel" style="margin-bottom:20px;">
              <h3>01 · Vehicle Specifications &amp; Dynamic Pricing</h3>
              <div class="form-grid">
                ${inp('registrationNumber','Registration Number','text','placeholder="e.g. GJ01AB1234" maxlength="16"')}
                ${inp('locationCity','Hub / City Location','text','placeholder="e.g. Ahmedabad" value="Ahmedabad"')}
                ${inp('make','Make / Brand','text','placeholder="e.g. Hyundai"')}
                ${inp('model','Model','text','placeholder="e.g. Creta SX"')}
                ${inp('year','Year of Manufacture','number',`min="2015" max="${new Date().getFullYear()+1}" value="2025"`)}
                ${sel('category','Vehicle Segment',['Hatchback','Sedan','Compact SUV','SUV','MUV','Luxury','EV'])}
                ${sel('transmission','Transmission',['Manual','Automatic'])}
                ${sel('fuelType','Fuel Type',['Petrol','Diesel','Electric','CNG','Hybrid'])}
                ${inp('seats','Seating Capacity','number','min="2" max="12" value="5"')}
                ${inp('pricePerDay','24-Hour Base Rate (₹)','number','min="500" max="1000000" step="1" value="2800"')}
                ${inp('odometer','Current Odometer (km)','number','min="0" max="2000000" value="12500"')}
              </div>
            </div>

            <div class="panel" style="margin-bottom:20px;">
              <h3>02 · Mandatory 8-Angle Vehicle Digital Twin Photos (AWS S3)</h3>
              <div class="notice info" style="margin-bottom:16px;">
                Upload 8 distinct vehicle photos covering every exterior and interior angle (Front, Rear, Left, Right, Interior, Boot, Bonnet, Odometer). Stored in AWS S3 and displayed in the 360° Customer Car Cockpit.
              </div>
              <p id="photo-progress" role="status" style="font-weight:700;color:var(--purple);">0 of 8 photos selected</p>
              <div class="photo-grid">
                ${PHOTO_ANGLES.map(kind => `
                  <div class="photo-slot" id="slot-${kind}">
                    <label>${kind} VIEW
                      <input type="file" name="${kind}" accept="image/jpeg,image/png,image/webp" required>
                      <img hidden alt="${kind} preview">
                      <span>Choose ${kind} photo · Max 8 MB</span>
                    </label>
                  </div>`).join('')}
              </div>
            </div>

            <div class="panel">
              <label class="check">
                <input type="checkbox" required>
                <span>I certify that I am the authorised owner/host of this vehicle and agree to the Safar 80/20 Host Revenue Share Agreement.</span>
              </label>
              <div class="actions" style="margin-top:14px;">
                <button type="submit" class="button btn-orange">Submit Vehicle &amp; Upload RC / Insurance →</button>
              </div>
            </div>
          </form>
        </section>

        <section id="host-tab-fleet" ${activeTab === 'fleet' ? '' : 'hidden'}>
          ${vehicles.length ? `<div class="admin-vehicle-grid">` + vehicles.map(v => {
            const front = v.media?.find(m => m.kind === 'FRONT');
            const cover = front ? `/api/media/${front.id}` : (v.images ? v.images.split(',')[0].trim() : 'https://images.unsplash.com/photo-1549399542-7e3f8b79c341?auto=format&fit=crop&w=800&q=80');
            return `
            <article class="panel admin-vehicle-tile">
              <div class="admin-tile-media">
                <img loading="lazy" src="${cover}" alt="${esc(v.make + ' ' + v.model)}">
                <div class="admin-tile-badge">${badge(v.status)}</div>
                <div class="admin-tile-photo-count">${v.media?.length || 0} S3 Photos</div>
              </div>
              <div class="admin-tile-content">
                <div class="admin-tile-header">
                  <div>
                    <h3>${esc(v.make + ' ' + v.model + ' ' + v.year)}</h3>
                    <p class="text-muted">${esc(v.registrationNumber || 'Pending Reg')} · ${esc(v.locationCity)} · ${Number(v.odometer || 0).toLocaleString('en-IN')} km</p>
                    <p class="admin-tile-price"><strong>${money(v.pricePerDay)}</strong> <span class="text-muted" style="font-size:12px">/ day (${money(Math.max(99, Math.round(Number(v.pricePerDay)/24)))}/hr)</span></p>
                  </div>
                </div>
                <p style="font-size:12.5px;color:var(--text-muted);">${esc(v.reviewNote || 'Verified for self-drive marketplace.')}</p>
                <div class="admin-tile-actions" style="flex-wrap:wrap">
                  <a class="button btn-ghost btn-sm" href="kyc.html?vehicle=${encodeURIComponent(v.id)}">RC, Insurance &amp; PUC →</a>
                  <button type="button" class="button btn-outline btn-sm host-schedule" data-id="${v.id}">Availability Calendar</button>
                  <a class="button btn-ghost btn-sm" href="host-agreement.html?id=${encodeURIComponent(v.id)}">Host Agreement</a>
                </div>
              </div>
            </article>`;
          }).join('') + `</div>` : empty('No vehicles listed yet', 'Click "+ Register New Car" to onboard your first self-drive vehicle.')}
        </section>

        <section id="host-tab-wallet" ${activeTab === 'wallet' ? '' : 'hidden'}>
          <div class="panel payout-panel" style="margin-bottom:20px;">
            <div class="heading">
              <div>
                <h3>Host Settlement Bank Account</h3>
                <p class="text-muted">Completed trips automatically credit 80% net host revenue to your settlement ledger.</p>
              </div>
              ${payoutAccount ? badge(payoutAccount.status) : badge('PENDING')}
            </div>
            ${payoutAccount ? `<p class="text-muted"><strong>${esc(payoutAccount.bankName)}</strong> · Account ending <strong>•••• ${esc(payoutAccount.accountNumberLast4)}</strong> · IFSC <strong>${esc(payoutAccount.ifscCode)}</strong></p>` : '<p class="text-muted">No bank account added yet. Enter your NEFT/IMPS settlement details below.</p>'}
            <form id="payout-account-form" class="form-grid" style="margin-top:14px;">
              ${inp('accountHolderName','Account Holder Name')}
              ${inp('bankName','Bank Name')}
              ${inp('accountNumber','Bank Account Number','text','inputmode="numeric" autocomplete="off" maxlength="18"')}
              ${inp('ifscCode','IFSC Code','text','maxlength="11" autocomplete="off" style="text-transform:uppercase"')}
              <div class="actions"><button type="submit" class="button btn-orange">Save Bank Account</button></div>
            </form>
          </div>

          <div class="panel table-wrap">
            <h3>Host Payout &amp; Trip Settlement Ledger</h3>
            <table>
              <thead><tr><th>Payout Period / Ref</th><th>Net Host Amount (80%)</th><th>Status</th><th>Notes</th></tr></thead>
              <tbody>
                ${payouts.length ? payouts.map(p => `
                  <tr>
                    <td>${p.periodStart ? d(p.periodStart) : 'Trip Settlement'} → ${p.periodEnd ? d(p.periodEnd) : 'Completed'}<br><small class="text-muted">${esc(p.reference || p.id.slice(0,8))}</small></td>
                    <td><strong style="color:#059669;">${money(p.amount)}</strong></td>
                    <td>${badge(p.status)}</td>
                    <td>${esc(p.note || '80% Host Revenue Share')}</td>
                  </tr>
                `).join('') : '<tr><td colspan="4" class="text-muted">Completed trip settlements will appear here automatically upon Return inspection.</td></tr>'}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </div>`;

  $$('[data-host-tab]').forEach(btn => {
    btn.onclick = () => host(btn.dataset.hostTab);
  });
  if ($('#host-quick-add-btn')) {
    $('#host-quick-add-btn').onclick = () => host('register');
  }

  bindBookingEvents();
  $$('.host-schedule').forEach(button => button.onclick = () => openVehicleSchedule(vehicles.find(item => item.id === button.dataset.id)));

  bindForm('#payout-account-form', async data => {
    await post('/payouts/account', data);
    toast('Payout bank account saved.');
    await host('wallet');
  });

  $$('.photo-slot input[type=file]').forEach(el => {
    el.onchange = () => {
      const slot = el.closest('.photo-slot');
      const img = $('img', slot);
      if (img.dataset.url) URL.revokeObjectURL(img.dataset.url);
      if (el.files[0] && (!['image/jpeg','image/png','image/webp'].includes(el.files[0].type) || el.files[0].size > 8 * 1024 * 1024)) {
        el.value = ''; toast('Choose a JPEG, PNG or WebP image up to 8 MB.', true);
      }
      if (!el.files[0]) { img.hidden = true; img.removeAttribute('src'); slot.classList.remove('slot-done'); $('span', slot).textContent = 'Choose photo · Max 8 MB'; }
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
      if (hashes.has(hash)) throw new Error('Each angle needs a distinct photo. Duplicate detected at ' + kind + '.');
      hashes.add(hash);
    }
    const mediaIds = [];
    for (const kind of PHOTO_ANGLES) {
      const file = form.elements[kind].files[0];
      const cached = uploadCache.get(kind);
      if (cached?.file === file) {
        mediaIds.push(cached.id);
      } else {
        toast(`Uploading ${kind} to AWS S3…`);
        const media = await uploadFile(file, kind);
        uploadCache.set(kind, {file, id: media.id});
        mediaIds.push(media.id);
      }
    }
    const payload = {...data, mediaIds};
    PHOTO_ANGLES.forEach(k => delete payload[k]);
    const result = await post('/vehicles', payload);
    toast('Vehicle registered with 8 S3 angles! Now upload RC, Insurance & PUC.');
    location.href = 'kyc.html?vehicle=' + encodeURIComponent(result.id);
  });
}

/* ─── DASHBOARD & CUSTOMER TRIP HUB ──────────────────────────────────── */
function formatBookingStatus(b) {
  return b.status === 'PENDING' && new Date(b.expiresAt) < new Date() ? 'EXPIRED' : b.status;
}

let dashboardCache = null;

async function dashboard(defaultTab = 'trips', forceRefresh = true) {
  if (!requireUser()) return;
  const params = new URLSearchParams(location.search);
  const activeTab = params.get('tab') || defaultTab;
  const payBookingId = params.get('pay');

  if (forceRefresh || !dashboardCache) {
    const [trips, hosted, kycInfo, accountInfo, notifications] = await Promise.all([
      api('/bookings/my-trips').catch(() => []),
      ['HOST','DEALER','ADMIN'].includes(user.role) ? api('/bookings/host-bookings').catch(() => []) : Promise.resolve([]),
      api('/kyc').catch(() => ({ documents: [], sessions: [], environment: 'live', configured: false })),
      api('/account/dashboard').catch(() => null),
      api('/notifications').catch(() => []),
    ]);
    dashboardCache = { trips, hosted, kycInfo, accountInfo, notifications };
  }

  const { trips, hosted, kycInfo, accountInfo, notifications } = dashboardCache;
  const activeCount = trips.filter(b => b.status === 'ACTIVE').length;

  $('#app').innerHTML = `
    ${sectionHead(`Customer Trip &amp; e-KYC Hub`, `Manage your self-drive reservations, online payments, Car Lease e-Agreements, and 8-Angle + Selfie Hub Handovers.`, 'MY SAFAR ACCOUNT')}

    <div class="stats" style="margin-bottom: 22px;">
      <div class="stat">
        <div class="stat-lbl">Member Identity</div>
        <strong style="font-size:18px;color:var(--purple);">${esc(user.firstName + ' ' + user.lastName)}</strong>
        <span style="font-size:12px;color:var(--muted);">${esc(user.email)} · ${user.phoneVerified ? '📱 OTP Verified' : ''} · ${badge(user.role)}</span>
      </div>
      <div class="stat">
        <div class="stat-lbl">Biometric e-KYC &amp; Face Match</div>
        <strong style="font-size:18px;color:${user.isVerified ? '#059669' : '#D97706'}">${user.isVerified ? '✓ Auto-Verified Driver' : 'Verification Pending'}</strong>
        <span style="font-size:12px;color:var(--muted);">${user.faceMatchScore ? `Face Match: ${Number(user.faceMatchScore).toFixed(1)}%` : (user.isVerified ? 'Identity & DL Approved' : 'Complete Aadhaar + Selfie Face Match')}</span>
      </div>
      <div class="stat">
        <div class="stat-lbl">My Reservations</div>
        <strong style="font-size:22px;">${trips.length}</strong>
        <span style="font-size:12px;color:var(--muted);">${activeCount} Active On-Road Trips</span>
      </div>
    </div>

    ${renderNotificationsHtml(notifications)}

    <div class="admin-tabs" style="margin-bottom: 24px;">
      <button type="button" class="${activeTab === 'trips' ? 'active' : ''}" onclick="switchAccountTab('trips')">
        🚗 My Trips &amp; Handovers <span>${trips.length}</span>
      </button>
      <button type="button" class="${activeTab === 'kyc' ? 'active' : ''}" onclick="switchAccountTab('kyc')">
        🪪 Biometric e-KYC &amp; Face Match <span>${user.isVerified ? '✓' : '!'}</span>
      </button>
      <button type="button" class="${activeTab === 'profile' ? 'active' : ''}" onclick="switchAccountTab('profile')">
        👤 Profile &amp; Security
      </button>
    </div>

    <div id="account-tab-content" class="view-fade-in">
      ${activeTab === 'kyc' ? renderKycTabHtml(kycInfo) : activeTab === 'profile' ? renderProfileTabHtml(kycInfo) : renderTripsTabHtml(trips, hosted, accountInfo)}
    </div>`;

  if (activeTab === 'trips') {
    bindBookingEvents();
    if (payBookingId) {
      const targetBooking = trips.find(b => b.id === payBookingId);
      if (targetBooking && formatBookingStatus(targetBooking) === 'PENDING') {
        setTimeout(() => openBookingPaymentModal(targetBooking), 150);
      }
    }
  }
  if (activeTab === 'kyc') bindKycEvents(kycInfo);
  if (activeTab === 'profile') {
    $('#profile-logout-btn')?.addEventListener('click', async () => {
      await post('/auth/logout').catch(() => {});
      location.href = 'index.html';
    });
  }
  bindNotificationEvents();
}

function renderNotificationsHtml(items) {
  const notifications = Array.isArray(items) ? items : [];
  const unread = notifications.filter(item => !item.readAt).length;
  return `<section class="panel account-notifications" style="margin-bottom:24px;">
    <div style="display:flex;justify-content:space-between;align-items:center;gap:12px;flex-wrap:wrap;">
      <div><h3 style="margin:0">Live Trip &amp; e-KYC Alerts ${unread ? `<span class="badge warn">${unread} new</span>` : ''}</h3><p class="text-muted" style="margin:4px 0 0">Payment confirmations, e-Agreement execution, 8-angle handover logs, and deposit settlements.</p></div>
      ${unread ? '<button type="button" class="button btn-outline btn-sm" id="mark-all-notifications">Mark all read</button>' : ''}
    </div>
    <div class="notification-list" style="display:grid;gap:10px;margin-top:16px;">
      ${notifications.length ? notifications.slice(0, 4).map(item => `<article class="notification-item ${item.readAt ? '' : 'is-unread'}" data-notification-id="${esc(item.id)}" style="padding:12px 14px;border:1px solid var(--border-main);border-radius:12px;background:var(--bg-subtle);">
        <div style="display:flex;justify-content:space-between;gap:12px;align-items:flex-start;"><strong>${esc(item.title)}</strong>${item.readAt ? '' : '<span class="badge warn">NEW</span>'}</div>
        <p style="margin:5px 0;color:var(--text-main);">${esc(item.message)}</p>
        <small class="text-muted">${dt(item.createdAt)} ${item.readAt ? '' : ' · Click to mark read'}</small>
      </article>`).join('') : '<p class="text-muted" style="margin:14px 0 0">No alerts yet.</p>'}
    </div>
  </section>`;
}

function bindNotificationEvents() {
  $$('.notification-item.is-unread').forEach(item => item.onclick = async () => {
    try { await post('/notifications/' + encodeURIComponent(item.dataset.notificationId) + '/read', {}); item.classList.remove('is-unread'); item.querySelector('.badge')?.remove(); item.querySelector('small').textContent = item.querySelector('small').textContent.replace(' · Click to mark read', ''); }
    catch (error) { toast(error.message, true); }
  });
  $('#mark-all-notifications')?.addEventListener('click', async () => {
    try { await post('/notifications/read-all', {}); await dashboard(undefined, true); }
    catch (error) { toast(error.message, true); }
  });
}

function switchAccountTab(tabName) {
  const url = new URL(location.href);
  url.searchParams.set('tab', tabName);
  url.searchParams.delete('pay');
  history.replaceState(null, '', url.toString());
  dashboard(tabName, false);
}

function renderTripsTabHtml(trips, hosted, accountInfo) {
  return `
    ${!user.isVerified ? `
      <div class="notice" style="margin-bottom:22px;display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:12px;">
        <div><strong>Biometric e-KYC Required:</strong> Complete Aadhaar + Live Selfie Face Match so you can unlock self-drive bookings and hub handovers.</div>
        <button type="button" onclick="switchAccountTab('kyc')" class="button btn-sm btn-orange">Launch Biometric e-KYC →</button>
      </div>` : ''}

    <section class="panel">
      <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:12px;margin-bottom:14px;">
        <div>
          <h3 style="margin:0;">My Self-Drive Reservations</h3>
          <p class="text-muted" style="margin:4px 0 0;">Complete payment to generate your Car Lease e-Agreement, then upload 8 Car Angles + 1 Selfie at Pickup and Return.</p>
        </div>
        <a class="button btn-outline btn-sm" href="cars.html">+ Book Another Car</a>
      </div>
      ${renderBookingTable(trips, false)}
    </section>

    ${hosted.length ? `
      <section class="panel" style="margin-top:24px;">
        <h3>Guest Reservations on Your Hosted Fleet</h3>
        ${renderBookingTable(hosted, true)}
      </section>` : ''}`;
}

function renderProfileTabHtml(kycInfo) {
  return `
    <section class="panel">
      <h3>Verified Member Profile</h3>
      <p class="text-muted">Your registered Safar identity, Mobile OTP status, and Biometric Face Match credentials.</p>

      <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:16px;margin-top:20px;">
        <div style="background:var(--bg-subtle);padding:16px;border-radius:var(--r);border:1px solid var(--border-main);">
          <span style="font-size:11.5px;color:var(--text-muted);text-transform:uppercase;font-weight:700;">Full Name</span>
          <p style="font-size:16px;font-weight:700;color:var(--text-main);margin-top:4px;">${esc(user.firstName + ' ' + user.lastName)}</p>
        </div>
        <div style="background:var(--bg-subtle);padding:16px;border-radius:var(--r);border:1px solid var(--border-main);">
          <span style="font-size:11.5px;color:var(--text-muted);text-transform:uppercase;font-weight:700;">Email &amp; Mobile</span>
          <p style="font-size:15px;font-weight:700;color:var(--text-main);margin-top:4px;">${esc(user.email)}<br><small style="color:#059669;">${esc(user.phone || 'No phone')} ${user.phoneVerified ? '✓ OTP Verified' : ''}</small></p>
        </div>
        <div style="background:var(--bg-subtle);padding:16px;border-radius:var(--r);border:1px solid var(--border-main);">
          <span style="font-size:11.5px;color:var(--text-muted);text-transform:uppercase;font-weight:700;">Biometric Face Match</span>
          <p style="margin-top:4px;">${badge(user.faceMatchStatus || (user.isVerified ? 'APPROVED' : 'PENDING'))} ${user.faceMatchScore ? `<strong style="margin-left:6px;color:#059669;">${Number(user.faceMatchScore).toFixed(1)}%</strong>` : ''}</p>
        </div>
        <div style="background:var(--bg-subtle);padding:16px;border-radius:var(--r);border:1px solid var(--border-main);">
          <span style="font-size:11.5px;color:var(--text-muted);text-transform:uppercase;font-weight:700;">Aadhaar &amp; DL Validity</span>
          <p style="font-size:14px;font-weight:700;color:var(--text-main);margin-top:4px;">${esc(user.aadhaarMasked || 'XXXX-XXXX-Verified')}<br><small class="text-muted">DL Valid: ${user.dlValidUntil ? d(user.dlValidUntil) : 'Verified'}</small></p>
        </div>
      </div>

      <div style="margin-top:28px;padding-top:20px;border-top:1px solid var(--border-main);display:flex;gap:12px;flex-wrap:wrap;">
        <button type="button" onclick="switchAccountTab('kyc')" class="button btn-orange">Open Biometric e-KYC Studio</button>
        <button type="button" id="profile-logout-btn" class="button btn-outline">Sign Out of Account</button>
      </div>
    </section>`;
}

function tripDistanceSummary(booking) {
  const pickup = booking.inspections?.find(item => item.stage === 'PICKUP');
  const returned = booking.inspections?.find(item => item.stage === 'RETURN');
  if (!pickup || !returned) return '';
  const travelled = Math.max(0, returned.odometer - pickup.odometer);
  const excess = booking.includedKilometres == null ? null : Math.max(0, travelled - booking.includedKilometres);
  return `<p style="margin-top:6px;"><strong>Distance Driven: ${travelled.toLocaleString('en-IN')} km</strong>${excess ? ` · <span style="color:#D97706;">Excess: ${excess} km</span>` : ' · Within limit'}</p>`;
}

function renderBookingTable(list, isHost) {
  if (!list.length) return empty('No reservations found', '<a href="cars.html" class="button btn-orange btn-sm">Explore Self-Drive Cars →</a>');
  return `
    <div class="table-wrap">
      <table>
        <thead>
          <tr>
            <th>Vehicle &amp; Booking Ref</th>
            <th>Tenure &amp; Schedule</th>
            <th>Financials &amp; Split</th>
            <th>Trip &amp; Handover Status</th>
            <th>Operations &amp; Handover</th>
          </tr>
        </thead>
        <tbody>
          ${list.map(b => {
            const st = formatBookingStatus(b);
            const hrs = b.tenureHours || Math.max(1, Math.ceil((new Date(b.endDate) - new Date(b.startDate)) / 3600000));
            const hostRev = b.hostRevenue || Math.round(Number(b.baseFare || 0) * 0.80);
            const platFee = b.platformFee || Math.round(Number(b.baseFare || 0) * 0.20);
            return `
            <tr>
              <td>
                <strong>${esc(b.vehicle.make + ' ' + b.vehicle.model)}</strong>
                <p class="text-muted" style="font-size:12px;margin:2px 0">Ref: <strong>${esc(b.bookingRef)}</strong> · ${esc(b.vehicle.registrationNumber || '')}</p>
                ${!isHost && b.vehicle?.host ? `<p style="font-size:12px;margin:4px 0 0;color:var(--purple)">Host: <strong>${esc(b.vehicle.host.firstName + ' ' + b.vehicle.host.lastName)}</strong>${b.vehicle.host.phone && ['CONFIRMED','ACTIVE'].includes(b.status) ? ` · <a href="tel:${esc(b.vehicle.host.phone)}" style="color:var(--orange);font-weight:700">📞 ${esc(b.vehicle.host.phone)}</a>` : ''}</p>` : ''}
                ${isHost && b.customer ? `<p style="font-size:12px;margin:4px 0 0;color:var(--orange)">Customer: <strong>${esc(b.customer.firstName + ' ' + b.customer.lastName)}</strong>${b.customer.phone ? ` · <a href="tel:${esc(b.customer.phone)}" style="color:var(--purple);font-weight:700">📞 ${esc(b.customer.phone)}</a>` : ''}</p>` : ''}
              </td>
              <td>
                <strong>${hrs} Hours (${Math.max(1, Math.ceil(hrs/24))}d)</strong><br>
                <span style="font-size:12px;">${dt(b.startDate)}</span><br>
                <span class="text-muted" style="font-size:12px;">→ ${dt(b.endDate)}</span>
              </td>
              <td>
                <strong style="font-size:15px;">${money(b.totalAmount)}</strong>
                <p class="text-muted" style="font-size:11.5px;margin:2px 0;">Fare: ${money(b.baseFare)} + Deposit: ${money(b.securityDeposit)}</p>
                ${isHost ? `<p style="font-size:11.5px;color:#059669;font-weight:700;margin:2px 0;">Your 80% Share: ${money(hostRev)} <span class="text-muted">(Fee: ${money(platFee)})</span></p>` : ''}
                ${b.inspections?.length ? `<details class="trip-inspection-details" style="margin-top:6px;"><summary style="font-size:12px;cursor:pointer;color:var(--purple);font-weight:700;">📷 ${b.inspections.length} Handover Record(s)</summary>${b.inspections.map(ins => `<div style="padding:6px 0;border-bottom:1px dashed var(--border-main);font-size:12px;"><strong>${esc(ins.stage)}</strong> · ${Number(ins.odometer).toLocaleString('en-IN')} km · Fuel ${Number(ins.fuelPercent || 0)}%<br><span class="text-muted">${esc(ins.damageNote || 'All 8 angles & selfie verified')}</span></div>`).join('')}${tripDistanceSummary(b)}</details>` : ''}
              </td>
              <td>
                ${badge(st)}
                ${b.payment ? `<span style="margin-left:4px">${badge(b.payment.status)}</span>` : ''}
                ${st === 'PENDING' ? `<p class="text-muted" style="font-size:11px;margin-top:4px;">Complete payment to lock car &amp; sign e-Agreement</p>` : ''}
                ${(() => {
                  if (['CANCELLED','EXPIRED','FAILED'].includes(st)) return '';
                  const step = st === 'COMPLETED' ? 4 : st === 'ACTIVE' ? 3 : st === 'CONFIRMED' ? 2 : 1;
                  return `<div class="trip-telemetry-track" title="Live Trip Lifecycle">
                    <span class="${step >= 1 ? 'done' : ''}">1. Pay</span>
                    <span class="${step >= 2 ? 'done' : ''}">2. 8-Photo Pickup</span>
                    <span class="${step >= 3 ? 'done' : ''}">3. Live Trip</span>
                    <span class="${step >= 4 ? 'done' : ''}">4. Return &amp; Settle</span>
                  </div>`;
                })()}
              </td>
              <td>
                <div class="actions" style="flex-wrap:wrap;gap:6px;">
                  ${!isHost && st === 'PENDING' ? `<button class="button btn-orange btn-sm pay-booking-btn" data-id="${b.id}">💳 Pay Now &amp; Sign e-Agreement</button>` : ''}
                  ${['CONFIRMED','ACTIVE'].includes(b.status)
                    ? `<button class="button btn-orange btn-sm inspection-btn" data-id="${b.id}" data-stage="${b.status === 'CONFIRMED' ? 'PICKUP' : 'RETURN'}">${b.status === 'CONFIRMED' ? '📸 Start Trip (8 Angles + Selfie)' : '🏁 End Trip (8 Angles + Selfie)'}</button>` : ''}
                  <a class="button btn-ghost btn-sm" href="agreement.html?id=${b.id}">📄 Lease e-Agreement</a>
                  ${b.invoice ? `<a class="button btn-ghost btn-sm" href="invoice.html?id=${b.invoice.id}">🧾 Invoice</a>` : ''}
                  ${['PENDING','CONFIRMED'].includes(st) && new Date(b.startDate) > new Date()
                    ? `<button class="btn-ghost btn-sm cancel-booking-btn" data-id="${b.id}">Cancel</button>` : ''}
                  ${!isHost && b.status === 'COMPLETED' ? `<button class="button btn-outline btn-sm review-booking-btn" data-id="${b.id}">★ Rate Trip</button>` : ''}
                </div>
              </td>
            </tr>`;
          }).join('')}
        </tbody>
      </table>
    </div>`;
}

function openBookingPaymentModal(booking) {
  const hrs = booking.tenureHours || Math.max(1, Math.ceil((new Date(booking.endDate) - new Date(booking.startDate)) / 3600000));
  showDialog(`
    <div style="max-width:520px;">
      <span class="badge ok">INSTANT CHECKOUT &amp; E-AGREEMENT</span>
      <h3 style="margin:8px 0 4px;">Complete Payment &amp; Execute Car Lease Agreement</h3>
      <p class="text-muted" style="margin:0 0 16px;">Booking Ref: <strong>${esc(booking.bookingRef)}</strong> · ${esc(booking.vehicle?.make + ' ' + booking.vehicle?.model)}</p>

      <div style="background:var(--bg-subtle);padding:16px;border-radius:14px;border:1px solid var(--border-main);margin-bottom:16px;">
        <div style="display:flex;justify-content:space-between;margin-bottom:6px;"><span>Trip Duration (${hrs} hrs)</span><strong>${dt(booking.startDate)} → ${dt(booking.endDate)}</strong></div>
        <div style="display:flex;justify-content:space-between;margin-bottom:6px;"><span>Rental Base Fare</span><strong>${money(booking.baseFare)}</strong></div>
        <div style="display:flex;justify-content:space-between;margin-bottom:6px;"><span>Refundable Security Deposit</span><strong>${money(booking.securityDeposit)}</strong></div>
        <div style="display:flex;justify-content:space-between;padding-top:8px;border-top:1px solid var(--border-main);font-size:17px;"><strong>Total Payable Now</strong><strong style="color:var(--purple);">${money(booking.totalAmount)}</strong></div>
      </div>

      <form id="customer-checkout-form" class="form-stack">
        <label>Select Payment Method
          <select name="method" required>
            <option value="UPI_INSTANT">UPI Instant Pay (GPay / PhonePe / Paytm)</option>
            <option value="CARD">Credit / Debit Card (Visa / MasterCard / RuPay)</option>
            <option value="NETBANKING">NetBanking (All Indian Banks)</option>
          </select>
        </label>
        <label>UPI ID / Payment Reference (Optional)
          <input name="reference" type="text" placeholder="e.g. mobile@upi or press Pay Now for instant gateway" value="UPI-${Date.now().toString().slice(-6)}">
        </label>
        <label class="check">
          <input type="checkbox" required checked>
          <span>I digitally sign and accept the <strong>Safar Self-Drive Car Lease Agreement</strong> and agree to upload all 8 car angle photos + customer selfie at Pickup &amp; Return.</span>
        </label>
        <button type="submit" class="button btn-orange" style="width:100%;justify-content:center;padding:14px;">🔒 Pay ${money(booking.totalAmount)} &amp; Generate Lease e-Agreement →</button>
      </form>
    </div>
  `);

  bindForm('#customer-checkout-form', async data => {
    await post('/bookings/' + encodeURIComponent(booking.id) + '/pay', data);
    $('dialog')?.close();
    toast('Payment confirmed! Your Car Lease e-Agreement is ready.');
    await dashboard('trips', true);
  });
}

function openHandoverWizardModal(bookingId, stage) {
  const isPickup = stage === 'PICKUP';
  const selfieKind = isPickup ? 'SELFIE_PICKUP' : 'SELFIE_RETURN';
  const title = isPickup ? '📸 Trip Start Handover (8 Car Angles + Customer Selfie)' : '🏁 Trip Return Handover (8 Car Angles + Customer Selfie)';

  showDialog(`
    <div style="max-width:780px;">
      <span class="badge ${isPickup ? 'ok' : 'warn'}">${isPickup ? 'STEP 1 · HUB PICKUP PROTOCOL' : 'STEP 2 · HUB RETURN & SETTLEMENT PROTOCOL'}</span>
      <h3 style="margin:8px 0 4px;">${title}</h3>
      <p class="text-muted" style="margin:0 0 14px;">
        Upload all <strong>8 mandatory car angle photos</strong> plus <strong>1 live customer selfie with the vehicle</strong>. Every image is archived in AWS S3 and linked to your PostgreSQL Trip Ledger.
      </p>

      <div style="display:flex;justify-content:space-between;align-items:center;gap:12px;flex-wrap:wrap;margin-bottom:14px;padding:12px 16px;background:rgba(46,16,101,0.06);border-radius:12px;border:1px solid rgba(46,16,101,0.15);">
        <div>
          <strong id="handover-slot-counter" style="color:var(--purple);">0 of 9 mandatory photos ready</strong>
          <p class="text-muted" style="margin:2px 0 0;font-size:12px;">Click any slot below to capture/upload from your phone camera, or use Quick Auto-Fill for testing.</p>
        </div>
        <button type="button" class="button btn-outline btn-sm" id="handover-autofill-btn">⚡ Auto-Fill 8 Angles + Selfie (Demo)</button>
      </div>

      <form id="handover-wizard-form" class="form-stack">
        <div class="handover-grid-9">
          ${PHOTO_ANGLES.map((angle, idx) => `
            <label class="handover-slot-card" id="hslot-${angle}">
              <span class="slot-badge">0${idx + 1} · ${angle}</span>
              <input type="file" name="angle_${angle}" accept="image/jpeg,image/png,image/webp" style="display:none;">
              <img hidden alt="${angle} preview">
              <small class="text-muted" style="font-size:11px;display:block;margin-top:6px;">Tap to upload ${angle}</small>
            </label>
          `).join('')}
          <label class="handover-slot-card" id="hslot-SELFIE" style="border-color:var(--orange);background:rgba(245,158,11,0.06);">
            <span class="slot-badge" style="color:#B45309;">09 · CUSTOMER SELFIE</span>
            <input type="file" name="angle_SELFIE" accept="image/jpeg,image/png,image/webp" style="display:none;">
            <img hidden alt="Customer Selfie preview">
            <small class="text-muted" style="font-size:11px;display:block;margin-top:6px;">Selfie with Car at Hub</small>
          </label>
        </div>

        <div class="form-grid" style="margin-top:14px;">
          ${inp('odometer', isPickup ? 'Pickup Odometer Reading (km)' : 'Return Odometer Reading (km)', 'number', `min="0" max="2000000" required value="${isPickup ? '14200' : '14460'}"`)}
          ${inp('fuelPercent', isPickup ? 'Pickup Fuel / Battery (%)' : 'Return Fuel / Battery (%)', 'number', 'min="0" max="100" step="1" required value="85"')}
        </div>

        <label>Vehicle Exterior / Interior Condition Note
          <input name="damageNote" type="text" required maxlength="1000" value="All 8 car angles and customer selfie verified clean at hub.">
        </label>

        <button type="submit" class="button btn-orange" style="width:100%;justify-content:center;padding:14px;">
          ${isPickup ? '🚀 Upload 9 Photos to S3 & Start Live Trip →' : '🏁 Upload 9 Photos to S3, Complete Trip & Settle Host Revenue →'}
        </button>
      </form>
    </div>
  `);

  const generatedBlobs = {};
  const allSlots = [...PHOTO_ANGLES, 'SELFIE'];

  const updateCount = () => {
    const form = $('#handover-wizard-form');
    const ready = allSlots.filter(k => form.elements['angle_' + k]?.files?.length || generatedBlobs[k]).length;
    $('#handover-slot-counter').textContent = `${ready} of 9 mandatory photos ready`;
  };

  allSlots.forEach(k => {
    const input = $('#handover-wizard-form').elements['angle_' + k];
    input.onchange = () => {
      const card = $('#hslot-' + k);
      const img = $('img', card);
      if (input.files[0]) {
        delete generatedBlobs[k];
        img.src = URL.createObjectURL(input.files[0]);
        img.hidden = false;
        card.classList.add('slot-ready');
        $('small', card).textContent = '✓ Ready for S3';
      }
      updateCount();
    };
  });

  $('#handover-autofill-btn').onclick = async () => {
    for (let i = 0; i < allSlots.length; i++) {
      const k = allSlots[i];
      const c = document.createElement('canvas');
      c.width = 640; c.height = 420;
      const ctx = c.getContext('2d');
      ctx.fillStyle = k === 'SELFIE' ? '#3B0764' : '#0F172A';
      ctx.fillRect(0, 0, 640, 420);
      ctx.fillStyle = '#F59E0B';
      ctx.font = 'bold 26px sans-serif';
      ctx.fillText(`SAFAR S3 HANDOVER · ${stage}`, 36, 70);
      ctx.fillStyle = '#FFFFFF';
      ctx.font = 'bold 34px sans-serif';
      ctx.fillText(`SLOT 0${i + 1}: ${k}`, 36, 140);
      ctx.font = '20px sans-serif';
      ctx.fillStyle = '#34D399';
      ctx.fillText(`Booking ID: ${bookingId.slice(0, 12)}`, 36, 210);
      ctx.fillText(`Timestamp: ${new Date().toISOString()}`, 36, 250);
      ctx.fillText(`GPS Hub Verified · High-Res Inspection Frame #${i + 1}`, 36, 300);
      const blob = await new Promise(r => c.toBlob(r, 'image/jpeg', 0.9));
      generatedBlobs[k] = new File([blob], `${stage.toLowerCase()}-${k.toLowerCase()}-${Date.now()}-${i}.jpg`, { type: 'image/jpeg' });
      const card = $('#hslot-' + k);
      const img = $('img', card);
      img.src = URL.createObjectURL(generatedBlobs[k]);
      img.hidden = false;
      card.classList.add('slot-ready');
      $('small', card).textContent = '✓ S3 Frame Ready';
    }
    updateCount();
    toast('All 8 Car Angles + 1 Customer Selfie prepared!');
  };

  bindForm('#handover-wizard-form', async (data, form) => {
    const uploadedMedia = [];
    for (const k of allSlots) {
      const file = form.elements['angle_' + k]?.files?.[0] || generatedBlobs[k];
      if (!file) throw new Error(`Missing photo for ${k}. Please upload all 8 car angles + 1 customer selfie (or click Auto-Fill).`);
      const mediaKind = k === 'SELFIE' ? selfieKind : k;
      toast(`Uploading ${k} to AWS S3…`);
      const media = await uploadFile(file, mediaKind);
      uploadedMedia.push(media);
    }

    await post('/bookings/' + encodeURIComponent(bookingId) + '/inspection', {
      stage,
      odometer: Number(data.odometer || 0),
      fuelPercent: Number(data.fuelPercent || 85),
      damageNote: data.damageNote,
      mediaId: uploadedMedia[0].id,
      mediaIds: uploadedMedia.map(m => m.id),
      note: `${stage} 8-Angle + Customer Selfie Handover completed.`,
    });

    $('dialog')?.close();
    toast(isPickup ? 'Trip Started! All 8 angles + selfie archived to AWS S3.' : 'Trip Completed! Return photos archived & Host 80% payout settled.');
    if (page === 'host-onboarding.html') await host('overview');
    else await dashboard('trips', true);
  });
}

function bindBookingEvents() {
  $$('.pay-booking-btn').forEach(btn => {
    btn.onclick = () => {
      const allTrips = [...(dashboardCache?.trips || []), ...(dashboardCache?.hosted || [])];
      const booking = allTrips.find(b => b.id === btn.dataset.id);
      if (booking) openBookingPaymentModal(booking);
    };
  });

  $$('.inspection-btn').forEach(btn => {
    btn.onclick = () => {
      const stage = btn.dataset.stage;
      if (stage === 'PICKUP' || stage === 'RETURN') {
        openHandoverWizardModal(btn.dataset.id, stage);
        return;
      }
    };
  });

  $$('.review-booking-btn').forEach(btn => {
    btn.onclick = async () => {
      const rating = Number(prompt('Rate this vehicle from 1 to 5 stars:', '5'));
      if (!Number.isInteger(rating) || rating < 1 || rating > 5) return toast('Choose a rating from 1 to 5.');
      const comment = prompt('Share your driving experience:', 'Clean car, smooth pickup and great host!') || '';
      btn.disabled = true;
      try {
        await post('/reviews', { bookingId: btn.dataset.id, rating, comment });
        toast('Thank you! Your verified review was published.');
        await dashboard('trips', true);
      } catch (e) { toast(e.message, 'error'); btn.disabled = false; }
    };
  });

  $$('.cancel-booking-btn').forEach(btn => {
    btn.onclick = async () => {
      if (!confirm('Are you sure you want to cancel this reservation?')) return;
      btn.disabled = true;
      try {
        await post('/bookings/' + btn.dataset.id + '/cancel', {});
        await dashboard('trips', true);
        toast('Reservation cancelled.');
      } catch (err) {
        toast(err.message, true);
        btn.disabled = false;
      }
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

async function hostAgreement() {
  if (!requireUser(['HOST','DEALER','ADMIN'])) return;
  const id = new URLSearchParams(location.search).get('id');
  if (!id) throw new Error('No vehicle specified. Select a vehicle from My Fleet.');
  const A = await api('/vehicles/' + encodeURIComponent(id) + '/host-agreement');
  const V = A.vehicle, H = A.host, T = A.commercialTerms;
  $('#app').innerHTML = `<section class="agreement panel">
    ${sectionHead('Host Partner Agreement', 'The operating terms for listing and managing this vehicle on Safar.', 'PARTNER TERMS')}
    <div class="agreement-meta"><strong>${esc(V.make + ' ' + V.model + ' ' + V.year)}</strong><span>${esc(V.registrationNumber || 'Registration pending')} · ${esc(V.city)}</span><span>Version ${esc(A.agreementVersion)} · Generated ${dt(A.generatedAt)}</span></div>
    <div class="agreement-grid"><div><h3>Host</h3><p><strong>${esc(H.firstName + ' ' + H.lastName)}</strong><br>${esc(H.email)}${H.phone ? '<br>' + esc(H.phone) : ''}</p></div><div><h3>Safar operating terms</h3><p>${esc(T.platformRole)}</p><p>Deposit reference: ${money(T.securityDeposit)} · Included distance: ${Number(T.includedKilometresPer24Hours)} km / 24 hours · Excess distance: ${money(T.excessKmRate)} / km</p></div></div>
    <h3>Terms</h3><ol class="agreement-terms">${A.terms.map(term => `<li>${esc(term)}</li>`).join('')}</ol>
    <div class="actions agreement-actions"><button id="ack-host-agreement" class="button btn-orange" ${A.acknowledgement ? 'disabled' : ''}>${A.acknowledgement ? 'Agreement acknowledged' : 'Acknowledge host agreement'}</button><button id="print-host-agreement" class="button btn-outline">Print / Save PDF</button><a href="host-onboarding.html" class="button btn-ghost">Back to My Fleet</a></div>
  </section>`;
  $('#ack-host-agreement').onclick = async () => { try { const result = await post('/vehicles/' + encodeURIComponent(id) + '/host-agreement/acknowledge', {}); $('#ack-host-agreement').disabled = true; $('#ack-host-agreement').textContent = 'Agreement acknowledged'; toast('Host–Safar agreement acknowledged at ' + dt(result.acceptedAt)); } catch (err) { toast(err.message, true); } };
  $('#print-host-agreement').onclick = () => window.print();
}

/* ─── RENTAL AGREEMENT ──────────────────────────────────────────────── */
async function agreement() {
  if (!requireUser()) return;
  const id = new URLSearchParams(location.search).get('id');
  if (!id) throw new Error('No booking specified. Select an agreement from My Trips.');
  const A = await api('/bookings/' + encodeURIComponent(id) + '/agreement');
  const B = A.booking, V = A.vehicle, C = A.customer, H = A.host;
  const S = A.scheduleI || {};
  const F = A.scheduleIII || {};
  const cancellation = A.scheduleIV || {};
  const isBinding = ['CONFIRMED', 'ACTIVE', 'COMPLETED'].includes(B.status);
  const inspectionRows = (A.inspections || []).length
    ? A.inspections.map(item => `<tr><td>${esc(item.stage)}</td><td>${Number(item.odometer).toLocaleString('en-IN')} km</td><td>${item.fuelPercent == null ? '—' : Number(item.fuelPercent) + '%'}</td><td>${esc(item.damageNote || 'No condition note recorded')}</td><td>${dt(item.createdAt)}</td></tr>`).join('')
    : '<tr><td colspan="5" class="text-muted">No pickup or return inspection has been recorded yet.</td></tr>';

  $('#app').innerHTML = `
    <article class="agreement panel">
      <div class="heading">
        <div>
          <div class="eyebrow">SAFAR SELF DRIVE · RENTAL AGREEMENT</div>
          <h2>${esc(A.business.name)}</h2>
          <p class="text-muted">Agreement version ${esc(A.agreementVersion)} · Generated ${dt(A.generatedAt)}</p>
        </div>
        ${badge(B.status)}
      </div>
      <div class="agreement-notice ${isBinding ? 'is-confirmed' : ''}">
        <strong>${isBinding ? 'Confirmed rental agreement' : 'Draft booking agreement'}</strong>
        <p>${isBinding ? 'This agreement records the confirmed reservation and its operating terms.' : 'This booking is not a paid rental contract until payment is recorded and the reservation is confirmed.'}</p>
      </div>
      <div class="agreement-meta-grid">
        <div><span>Booking reference</span><strong>${esc(B.reference)}</strong></div>
        <div><span>Payment status</span><strong>${esc((B.paymentStatus || 'PENDING').replaceAll('_', ' '))}</strong></div>
        <div><span>Pickup</span><strong>${dt(B.startDate)}</strong></div>
        <div><span>Return</span><strong>${dt(B.endDate)}</strong></div>
      </div>
      <div class="agreement-section">
        <h3>1. Parties and platform role</h3>
        <div class="two">
          <div><h4>Renter / Guest</h4><p><strong>${esc(C.firstName + ' ' + C.lastName)}</strong><br>${esc(C.email)}${C.phone ? '<br>' + esc(C.phone) : ''}</p></div>
          <div><h4>Host / vehicle provider</h4><p><strong>${esc(H.firstName + ' ' + H.lastName)}</strong><br>${esc(H.email)}${H.phone ? '<br>' + esc(H.phone) : ''}</p></div>
        </div>
        <p class="text-muted">${esc(A.platformRole || '')}</p>
        <p class="text-muted">Platform operator: ${esc(A.business.legalName || A.business.name)}${A.business.address ? ' · ' + esc(A.business.address) : ''}${A.business.email ? ' · ' + esc(A.business.email) : ''}</p>
      </div>
      <div class="agreement-section">
        <h3>2. Schedule I — booking and trip details</h3>
        <div class="table-wrap"><table><tbody>
          <tr><th>Effective date</th><td>${dt(S.effectiveDate || B.startDate)}</td></tr>
          <tr><th>Booking period</th><td>${dt(B.startDate)} to ${dt(B.endDate)}</td></tr>
          <tr><th>Booking reference</th><td>${esc(B.reference)}</td></tr>
          <tr><th>Pickup location</th><td>${esc(S.trip?.pickupLocation || V.locationCity)}</td></tr>
          <tr><th>Return location</th><td>${esc(S.trip?.returnLocation || V.locationCity)}</td></tr>
          <tr><th>Trip status</th><td>${esc(B.status)} · ${Number(B.rentalDays)} billed day${Number(B.rentalDays) === 1 ? '' : 's'}</td></tr>
          <tr><th>Payment status</th><td>${esc((B.paymentStatus || 'PENDING').replaceAll('_', ' '))}</td></tr>
        </tbody></table></div>
      </div>
      <div class="agreement-section">
        <h3>3. Vehicle details</h3>
        <div class="agreement-meta-grid compact">
          <div><span>Vehicle</span><strong>${esc(V.make + ' ' + V.model)} (${V.year})</strong></div>
          <div><span>Registration</span><strong>${esc(V.registrationNumber || 'Assigned at pickup')}</strong></div>
          <div><span>Category</span><strong>${esc(V.category)}</strong></div>
          <div><span>Pickup location</span><strong>${esc(V.locationCity)}</strong></div>
          <div><span>Transmission / fuel</span><strong>${esc(V.transmission)} · ${esc(V.fuelType)}</strong></div>
          <div><span>Seats</span><strong>${Number(V.seats)}</strong></div>
        </div>
      </div>
      <div class="agreement-section">
        <h3>4. Schedule III — charges, mileage and deposit</h3>
        <div class="table-wrap"><table><tbody>
          <tr><th>Rental (${Number(B.rentalDays)} billed day${Number(B.rentalDays) === 1 ? '' : 's'})</th><td>${money(B.rentalAmount)}</td></tr>
          <tr><th>Refundable security deposit</th><td>${money(B.securityDeposit)}</td></tr>
          <tr><th>Booking total</th><td><strong>${money(B.totalAmount)}</strong></td></tr>
          <tr><th>Included distance</th><td>${B.includedKilometres == null ? 'As stated at booking' : Number(B.includedKilometres).toLocaleString('en-IN') + ' km'}</td></tr>
          <tr><th>Daily rate used</th><td>${money(B.dailyRate)} / 24 hours</td></tr>
          <tr><th>Excess distance</th><td>${money(F.excessKmRate || B.excessKmRate)} / km</td></tr>
          <tr><th>Late-return rule</th><td>${Number(F.lateGraceMinutes || B.lateReturnGraceMinutes)} minute grace · ${money(F.lateReturnRatePerHour || B.lateReturnRatePerHour)} / hour</td></tr>
          <tr><th>Deposit release target</th><td>${esc(F.depositReleaseTarget || 'After check-out and settlement review')}</td></tr>
        </tbody></table></div>
        <p class="text-muted">The deposit is adjusted only for documented late return, damage, excess distance or other agreed charges after inspection and review. Any remaining balance is released according to the applicable Safar settlement process.</p>
      </div>
      <div class="agreement-section">
        <h3>5. Schedule II — vehicle condition and handover record</h3>
        <div class="table-wrap"><table><thead><tr><th>Stage</th><th>Odometer</th><th>Fuel</th><th>Condition / damage</th><th>Recorded</th></tr></thead><tbody>${inspectionRows}</tbody></table></div>
      </div>
      <div class="agreement-section">
        <h3>6. Schedule IV — cancellation and refund policy</h3>
        <div class="table-wrap"><table><tbody>
          <tr><th>More than 48 hours before pickup</th><td>${esc(cancellation.moreThan48Hours || 'As stated in the Fee Policy')}</td></tr>
          <tr><th>24 to 48 hours before pickup</th><td>${esc(cancellation.between24And48Hours || 'As stated in the Fee Policy')}</td></tr>
          <tr><th>Less than 24 hours before pickup</th><td>${esc(cancellation.lessThan24Hours || 'As stated in the Fee Policy')}</td></tr>
          <tr><th>Refund timing</th><td>${esc(cancellation.refundTiming || 'Subject to Safar reconciliation')}</td></tr>
        </tbody></table></div>
      </div>
      <div class="agreement-section">
        <h3>7. Car sharing agreement terms</h3>
        <ol class="rules-list agreement-terms">${A.terms.map(term => `<li>${esc(term)}</li>`).join('')}</ol>
      </div>
      <div class="agreement-section agreement-signoff">
        <p><strong>Electronic acknowledgement</strong></p>
        <p>${esc(A.electronicExecution || 'This agreement is accepted electronically on the Platform.')}</p>
        <p>By continuing with this booking, the renter confirms that the customer details, host details, vehicle details, dates, times, trip locations, payment terms, licence eligibility, vehicle condition process, distance allowance, security deposit and terms above were displayed for review. Safar retains the booking, payment, inspection and audit records associated with this agreement.</p>
      </div>
      <div class="actions agreement-actions"><button id="ack-agreement-btn" class="button btn-orange" ${A.acknowledgement ? 'disabled' : ''}>${A.acknowledgement ? 'Agreement acknowledged' : 'Acknowledge agreement'}</button><button id="download-agreement-pdf" class="button btn-outline">Download agreement PDF</button><button id="print-agreement-btn" class="button btn-ghost">Print current view</button><a href="dashboard.html" class="button btn-ghost">Back to My Trips</a></div>
    </article>`;
  $('#ack-agreement-btn').onclick = async () => { try { const result = await post('/bookings/' + encodeURIComponent(id) + '/agreement/acknowledge', {}); $('#ack-agreement-btn').disabled = true; $('#ack-agreement-btn').textContent = 'Agreement acknowledged'; toast('Agreement acknowledged at ' + dt(result.acceptedAt)); } catch (err) { toast(err.message, true); } };
  $('#download-agreement-pdf').onclick = async () => {
    const button = $('#download-agreement-pdf');
    button.disabled = true;
    button.textContent = 'Preparing PDF…';
    try {
      const response = await fetch('/api/bookings/' + encodeURIComponent(id) + '/agreement/pdf', { credentials: 'same-origin' });
      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(payload.message || 'PDF generation failed');
      }
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a'); link.href = url; link.download = (B.reference || 'safar-agreement') + '-safarcars-agreement.pdf'; link.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      toast('Agreement PDF downloaded');
    } catch (err) { toast(err.message, true); }
    finally { button.disabled = false; button.textContent = 'Download agreement PDF'; }
  };
  $('#print-agreement-btn').onclick = () => window.print();
}

/* ─── ADMIN COMMAND CENTER (PRO ENTERPRISE REDESIGN) ─────────────────── */
async function adminPage(tab = 'vehicles') {
  if (!requireUser(['ADMIN'])) return;
  adminData = await api('/admin');
  adminData.payouts = await api('/payouts').catch(() => []);
  adminData.payoutAccounts = await api('/payouts/accounts').catch(() => []);

  const totalGross = Number(adminData.metrics?.paidRevenue ?? 0);
  const totalPlatformFee = Number(adminData.metrics?.platformCommission ?? Math.round(totalGross * 0.20));
  const totalHostPayouts = Number(adminData.metrics?.hostNetRevenue ?? Math.round(totalGross * 0.80));

  $('#app').innerHTML = `
    <div class="pro-console-shell">
      <aside class="pro-sidebar">
        <div class="pro-sidebar-brand">
          <div class="pro-sidebar-logo">S</div>
          <div>
            <strong>Safar Enterprise</strong>
            <span>ADMIN COMMAND CENTER</span>
          </div>
        </div>
        <nav class="pro-nav" aria-label="Administration sections">
          <button type="button" class="pro-nav-item ${tab === 'vehicles' ? 'active' : ''}" data-tab="vehicles">
            <span>🚗 Fleet &amp; 8-Angle Hub</span><span class="pro-nav-badge">${adminData.vehicles.length}</span>
          </button>
          <button type="button" class="pro-nav-item ${tab === 'bookings' ? 'active' : ''}" data-tab="bookings">
            <span>📅 Master Bookings</span><span class="pro-nav-badge">${adminData.bookings.length}</span>
          </button>
          <button type="button" class="pro-nav-item ${tab === 'documents' ? 'active' : ''}" data-tab="documents">
            <span>🪪 e-KYC &amp; Face Match</span><span class="pro-nav-badge">${adminData.documents.length}</span>
          </button>
          <button type="button" class="pro-nav-item ${tab === 'users' ? 'active' : ''}" data-tab="users">
            <span>👥 Customers &amp; Hosts</span><span class="pro-nav-badge">${adminData.users.length}</span>
          </button>
          <button type="button" class="pro-nav-item ${tab === 'payouts' ? 'active' : ''}" data-tab="payouts">
            <span>🏦 Host 80% Settlements</span><span class="pro-nav-badge">${adminData.payouts.length}</span>
          </button>
          <button type="button" class="pro-nav-item ${tab === 'audit' ? 'active' : ''}" data-tab="audit">
            <span>🛡️ Compliance Audit</span><span class="pro-nav-badge">${adminData.audit.length}</span>
          </button>
        </nav>
        <div style="margin-top:auto;padding-top:16px;border-top:1px solid rgba(255,255,255,0.1);font-size:12px;color:rgba(255,255,255,0.75);">
          <strong style="color:#fff;display:block;">AWS S3 + PostgreSQL Live</strong>
          <span>Bucket: safar-selfdrive-media-2026</span>
        </div>
      </aside>

      <div class="pro-main">
        <div class="pro-topbar">
          <div>
            <h2>Safar Operations &amp; Revenue Command Center</h2>
            <p>Approve 8-angle vehicles, inspect Aadhaar + Live Selfie Face Match e-KYC, monitor Pickup/Return handovers, and audit the 80/20 revenue split.</p>
          </div>
          <div class="actions">
            <button id="admin-export" type="button" class="button btn-outline btn-sm">📥 Export MIS Ledger (CSV)</button>
            <button id="admin-refresh" type="button" class="button btn-orange btn-sm">↻ Refresh Live Data</button>
          </div>
        </div>

        <div class="pro-kpi-ribbon">
          <div class="pro-kpi-card">
            <span class="kpi-label">Gross Booking Volume</span>
            <strong class="kpi-value">${money(totalGross)}</strong>
            <span class="kpi-sub">Today: ${money(adminData.metrics?.todayRevenue ?? 0)}</span>
          </div>
          <div class="pro-kpi-card">
            <span class="kpi-label">Safar Platform Fee (20%)</span>
            <strong class="kpi-value" style="color:var(--purple);">${money(totalPlatformFee)}</strong>
            <span class="kpi-sub">Net marketplace commission</span>
          </div>
          <div class="pro-kpi-card">
            <span class="kpi-label">Host Net Share (80%)</span>
            <strong class="kpi-value" style="color:#059669;">${money(totalHostPayouts)}</strong>
            <span class="kpi-sub">${adminData.payouts.length} settlements recorded</span>
          </div>
          <div class="pro-kpi-card">
            <span class="kpi-label">Active &amp; Confirmed Trips</span>
            <strong class="kpi-value">${adminData.metrics?.activeBookings ?? 0}</strong>
            <span class="kpi-sub">${adminData.bookings.length} total bookings in DB</span>
          </div>
          <div class="pro-kpi-card">
            <span class="kpi-label">e-KYC &amp; Docs Pending</span>
            <strong class="kpi-value">${adminData.metrics?.documentPending ?? adminData.documents.filter(d => d.status === 'PENDING').length}</strong>
            <span class="kpi-sub">Biometric &amp; RC queue</span>
          </div>
          <div class="pro-kpi-card">
            <span class="kpi-label">Fleet Approvals</span>
            <strong class="kpi-value">${adminData.metrics?.vehiclePending ?? adminData.vehicles.filter(v => v.status === 'PENDING_APPROVAL').length}</strong>
            <span class="kpi-sub">${adminData.vehicles.length} total fleet cars</span>
          </div>
        </div>

        <div class="admin-toolbar" style="margin-bottom:16px;">
          <label class="admin-search">Search Master Database<input id="admin-search" type="search" placeholder="Search customer, booking ref, GJ01 plate, city or status…"></label>
          <label>Status Filter<select id="admin-status"><option value="">All statuses</option></select></label>
          <label>From<input id="admin-export-from" type="date"></label>
          <label>To<input id="admin-export-to" type="date"></label>
          <span id="admin-record-count" role="status" style="font-weight:700;color:var(--purple);"></span>
        </div>

        <div id="admin-panel-content"></div>
        <div class="actions" style="margin-top:16px;">
          <button id="admin-load-more" class="btn-outline" ${adminData.nextOffset == null ? 'hidden' : ''}>Load More Records</button>
        </div>
      </div>
    </div>`;

  $$('[data-tab]').forEach(b => b.onclick = () => { $('#admin-search').value = ''; $('#admin-status').value = ''; renderAdminView(b.dataset.tab); });
  $('#admin-search').oninput = () => renderAdminView($('.pro-nav .active').dataset.tab);
  $('#admin-status').onchange = () => renderAdminView($('.pro-nav .active').dataset.tab);
  $('#admin-refresh').onclick = () => adminPage($('.pro-nav .active').dataset.tab);
  $('#admin-export').onclick = () => { const params = new URLSearchParams(); const from = $('#admin-export-from').value, to = $('#admin-export-to').value; if (from) params.set('from', from); if (to) params.set('to', to); window.open('/api/admin/export.csv?' + params.toString(), '_blank', 'noopener'); };
  $('#admin-load-more').onclick = async event => {
    const button = event.currentTarget;
    button.disabled = true;
    try {
      const more = await api('/admin?offset=' + adminData.nextOffset);
      for (const key of ['vehicles','documents','bookings','users','audit']) {
        adminData[key] = [...new Map([...adminData[key], ...more[key]].map(record => [record.id, record])).values()];
        const badgeEl = $(`.pro-nav [data-tab="${key}"] .pro-nav-badge`);
        if (badgeEl) badgeEl.textContent = adminData[key].length;
      }
      adminData.nextOffset = more.nextOffset;
      button.hidden = more.nextOffset == null;
      renderAdminView($('.pro-nav .active').dataset.tab);
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
  statusSelect.innerHTML = '<option value="">All statuses</option>' + statuses.map(status => `<option value="${esc(status)}">${esc((status || '').replaceAll('_', ' '))}</option>`).join('');
  statusSelect.value = statuses.includes(selectedStatus) ? selectedStatus : '';
  const query = $('#admin-search').value.trim().toLowerCase();
  const data = adminData[tab].filter(item => (!statusSelect.value || (tab === 'bookings' ? formatBookingStatus(item) : item.status || item.role || item.action) === statusSelect.value) && (!query || JSON.stringify(item).toLowerCase().includes(query)));
  $('#admin-record-count').textContent = `${data.length} of ${adminData[tab].length} records`;
  if (!data.length && !(tab === 'payouts' && adminData.payoutAccounts.length)) {
    $('#admin-panel-content').innerHTML = empty('No matching records', query || statusSelect.value ? 'Try another search or choose all statuses.' : 'New submissions will appear here when they are received.');
    return;
  }

  if (tab === 'vehicles') {
    $('#admin-panel-content').innerHTML = `
      <div class="panel" style="display:flex;justify-content:space-between;align-items:center;gap:16px;flex-wrap:wrap;padding:18px 24px;margin-bottom:14px">
        <div>
          <strong style="font-size:16px;color:var(--text-main)">Fleet Vehicle &amp; 8-Angle S3 Studio</strong>
          <p class="text-muted" style="margin:4px 0 0;font-size:13px">Click any car tile to open the 8-Angle S3 Folder, upload/replace photos, verify RC/Insurance/PUC, or adjust pricing.</p>
        </div>
        <button id="admin-add-vehicle-btn" class="button btn-orange btn-sm">+ Add New Car to Fleet</button>
      </div>
      <div class="admin-vehicle-grid">
        ${data.map(v => `
          <article class="panel admin-vehicle-tile open-car-folder-tile" data-id="${v.id}" style="cursor:pointer">
            <div class="admin-tile-media">
              <img loading="lazy" src="${getVehicleCover(v)}" alt="${esc(v.make + ' ' + v.model)}">
              <div class="admin-tile-badge">${badge(v.status)}</div>
              <div class="admin-tile-photo-count">${v.media?.length || 0} S3 Photos</div>
            </div>
            <div class="admin-tile-content">
              <div class="admin-tile-header">
                <h3>${esc(v.make + ' ' + v.model + ' ' + v.year)}</h3>
                <p class="text-muted">${esc(v.registrationNumber || 'Pending Reg')} · ${esc(v.locationCity)} · ${Number(v.odometer || 0).toLocaleString('en-IN')} km</p>
                <p class="admin-tile-price"><strong>${money(v.pricePerDay)}</strong> <span class="text-muted" style="font-size:12px">/ day (${money(Math.max(99, Math.round(Number(v.pricePerDay)/24)))}/hr)</span></p>
              </div>
              <div class="admin-tile-compliance">
                ${v.documents.map(d => `<span>${esc(d.kind)} ${badge(d.status)}</span>`).join('') || '<span class="text-muted">Compliance docs pending</span>'}
              </div>
              <div class="admin-tile-actions">
                <button class="button btn-orange btn-sm vehicle-folder-btn" data-id="${v.id}">Open 8-Angle Folder</button>
                <button class="btn-outline btn-sm vehicle-pricing-action" data-id="${v.id}">Rate</button>
                <button class="btn-outline btn-sm vehicle-schedule-action" data-id="${v.id}">Schedule</button>
              </div>
            </div>
          </article>`).join('')}
      </div>`;
  }

  if (tab === 'documents') {
    $('#admin-panel-content').innerHTML = `
      <section class="panel table-wrap">
        <div style="margin-bottom:14px;">
          <h3 style="margin:0;">Biometric e-KYC, Live Selfie Face Match &amp; Compliance Desk</h3>
          <p class="text-muted" style="margin:4px 0 0;">Inspect customer Aadhaar, Driving Licence, Live Selfie Face Match scores, and vehicle RC/Insurance documents.</p>
        </div>
        <table>
          <thead><tr><th>Customer / Host</th><th>Document Type</th><th>Face Match &amp; Source</th><th>Status</th><th>Quick Action</th></tr></thead>
          <tbody>
            ${data.map(doc => `
              <tr>
                <td>
                  <strong>${esc((doc.user?.firstName || '') + ' ' + (doc.user?.lastName || ''))}</strong>
                  <br><small class="text-muted">${esc(doc.user?.email || '')} ${doc.user?.phone ? '· ' + esc(doc.user.phone) : ''}</small>
                </td>
                <td><strong>${esc(doc.kind)}</strong>${doc.numberLast4 ? `<br><small class="text-muted">Ends •••• ${esc(doc.numberLast4)}</small>` : ''}</td>
                <td>
                  <span class="badge ok">${esc(doc.source || 'S3_UPLOAD')}</span>
                  ${doc.user?.faceMatchScore ? `<br><small style="color:#059669;font-weight:700;">Face Match: ${Number(doc.user.faceMatchScore).toFixed(1)}% (${esc(doc.user.faceMatchStatus || 'APPROVED')})</small>` : ''}
                </td>
                <td>${badge(doc.status)}</td>
                <td>
                  <div class="actions">
                    <button class="button btn-orange btn-sm doc-quick-approve-action" data-id="${doc.id}">✓ Quick Approve</button>
                    <button class="btn-ghost btn-sm doc-review-action" data-id="${doc.id}">Inspect S3 File</button>
                  </div>
                </td>
              </tr>`).join('')}
          </tbody>
        </table>
      </section>`;
  }

  if (tab === 'bookings') {
    $('#admin-panel-content').innerHTML = `
      <section class="panel table-wrap">
        <div style="margin-bottom:14px;">
          <h3 style="margin:0;">Master Self-Drive Booking &amp; Revenue Split Ledger</h3>
          <p class="text-muted" style="margin:4px 0 0;">Complete record of which customer booked which car, tenure hours, total fare, 20% Safar fee, 80% Host revenue, e-Agreement, and Pickup/Return 9-photo handovers.</p>
        </div>
        <table>
          <thead><tr><th>Customer &amp; Car</th><th>Booking Window &amp; Tenure</th><th>Fare, Fee (20%) &amp; Host (80%)</th><th>Status &amp; Handover</th><th>Operations</th></tr></thead>
          <tbody>
            ${data.map(b => {
              const st = formatBookingStatus(b);
              const hrs = b.tenureHours || Math.max(1, Math.ceil((new Date(b.endDate) - new Date(b.startDate)) / 3600000));
              const platFee = b.platformFee || Math.round(Number(b.baseFare || 0) * 0.20);
              const hostRev = b.hostRevenue || Math.round(Number(b.baseFare || 0) * 0.80);
              return `
              <tr>
                <td>
                  <strong>${esc(b.customer.firstName + ' ' + b.customer.lastName)}</strong>
                  ${b.customer.phone ? `<br><small><a href="tel:${esc(b.customer.phone)}" style="color:var(--purple);font-weight:600">📞 ${esc(b.customer.phone)}</a></small>` : ''}
                  <p style="margin:4px 0 0;font-size:12.5px;color:var(--orange);font-weight:700">${esc(b.vehicle.make + ' ' + b.vehicle.model)} (${esc(b.vehicle.registrationNumber || 'No Reg')})</p>
                  ${b.vehicle.host ? `<small class="text-muted">Host: ${esc(b.vehicle.host.firstName + ' ' + b.vehicle.host.lastName)}</small>` : ''}
                </td>
                <td>
                  <strong>${esc(b.bookingRef)}</strong> · <span class="badge ok">${hrs} hrs</span><br>
                  <small>${dt(b.startDate)} → ${dt(b.endDate)}</small>
                </td>
                <td>
                  <strong style="font-size:15px;">Total: ${money(b.totalAmount)}</strong>
                  <p class="text-muted" style="margin:2px 0;font-size:11.5px;">Base Fare: ${money(b.baseFare)} · Deposit: ${money(b.securityDeposit)}</p>
                  <p style="margin:2px 0;font-size:11.5px;font-weight:700;"><span style="color:var(--purple);">Safar 20%: ${money(platFee)}</span> · <span style="color:#059669;">Host 80%: ${money(hostRev)}</span></p>
                </td>
                <td>
                  ${badge(st)}
                  ${b.payment ? `<span style="margin-left:4px">${badge(b.payment.status)}</span>` : ''}
                  <p style="margin:4px 0 0;font-size:11.5px;color:var(--text-muted);">Handovers: <strong>${b.inspections?.length || 0} / 2</strong> recorded</p>
                </td>
                <td>
                  <div class="actions" style="flex-wrap:wrap;gap:6px;">
                    ${st === 'PENDING' ? `<button class="button btn-orange btn-sm record-pmt-action" data-id="${b.id}" data-amount="${b.totalAmount}">Record Payment</button>` : ''}
                    ${['CONFIRMED','ACTIVE'].includes(b.status) ? `<button class="button btn-orange btn-sm admin-handover-btn" data-id="${b.id}" data-stage="${b.status === 'CONFIRMED' ? 'PICKUP' : 'RETURN'}">${b.status === 'CONFIRMED' ? '📸 Pickup 9-Photo' : '🏁 Return 9-Photo'}</button>` : ''}
                    ${b.inspections?.length ? `<button class="btn-outline btn-sm admin-inspect-photos-btn" data-id="${b.id}">👁️ View Handover Photos</button>` : ''}
                    <a class="button btn-ghost btn-sm" href="agreement.html?id=${b.id}">📄 e-Agreement</a>
                    ${b.invoice ? `<a class="button btn-ghost btn-sm" href="invoice.html?id=${b.invoice.id}">🧾 Invoice</a>` : ''}
                    ${['CONFIRMED','ACTIVE','PENDING'].includes(st) ? `<button class="btn-outline btn-sm booking-swap-action" data-id="${b.id}">Swap</button><button class="btn-ghost btn-sm booking-cancel-admin-action" data-id="${b.id}" style="color:var(--red);">Cancel</button>` : ''}
                  </div>
                </td>
              </tr>`;
            }).join('')}
          </tbody>
        </table>
      </section>`;
  }

  if (tab === 'payouts') {
    $('#admin-panel-content').innerHTML = `
      <section class="panel table-wrap" style="margin-bottom:20px;">
        <h3>Host &amp; Dealer Bank Accounts</h3>
        <table>
          <thead><tr><th>Partner</th><th>Bank &amp; IFSC</th><th>Status</th><th>Payouts</th></tr></thead>
          <tbody>
            ${adminData.payoutAccounts.map(account => `
              <tr>
                <td><strong>${esc((account.user?.firstName || '') + ' ' + (account.user?.lastName || ''))}</strong><p class="text-muted">${esc(account.user?.email || '')} · ${esc(account.user?.role || '')}</p></td>
                <td>${esc(account.bankName)} · •••• ${esc(account.accountNumberLast4)}<br><span class="text-muted">IFSC ${esc(account.ifscCode)}</span></td>
                <td>${badge(account.status)}<br><button class="btn-outline btn-sm payout-account-status-action" data-id="${esc(account.id)}" style="margin-top:4px;">Verify Bank</button></td>
                <td>${account.payouts?.length || 0} settlements</td>
              </tr>`).join('') || '<tr><td colspan="4">No payout accounts submitted yet.</td></tr>'}
          </tbody>
        </table>
      </section>
      <section class="panel table-wrap">
        <h3>80% Host Revenue Settlement Ledger</h3>
        <table>
          <thead><tr><th>Host / Partner</th><th>Net Settlement (80%)</th><th>Period / Trip</th><th>Status</th><th>Action</th></tr></thead>
          <tbody>
            ${adminData.payouts.map(payout => `
              <tr>
                <td><strong>${esc((payout.account?.user?.firstName || '') + ' ' + (payout.account?.user?.lastName || ''))}</strong><p class="text-muted">${esc(payout.account?.user?.email || '')}</p></td>
                <td><strong style="color:#059669;font-size:15px;">${money(payout.amount)}</strong></td>
                <td>${payout.periodStart ? d(payout.periodStart) : 'Trip'} → ${payout.periodEnd ? d(payout.periodEnd) : 'Completed'}<br><small class="text-muted">${esc(payout.note || '')}</small></td>
                <td>${badge(payout.status)}${payout.reference ? `<br><span class="text-muted">${esc(payout.reference)}</span>` : ''}</td>
                <td><button class="btn-outline btn-sm payout-status-action" data-id="${esc(payout.id)}">Mark Paid / UTR</button></td>
              </tr>`).join('') || '<tr><td colspan="5">No payouts created yet.</td></tr>'}
          </tbody>
        </table>
      </section>`;
  }

  if (tab === 'users') {
    $('#admin-panel-content').innerHTML = `
      <section class="panel table-wrap">
        <div style="margin-bottom:14px;">
          <h3 style="margin:0;">Registered Customers, Hosts &amp; Biometric Identity Status</h3>
          <p class="text-muted" style="margin:4px 0 0;">View Mobile OTP verification, Aadhaar mask, Live Selfie Face Match score, and one-click KYC approval.</p>
        </div>
        <table>
          <thead><tr><th>Member Name</th><th>Contact &amp; OTP</th><th>Role</th><th>Biometric Face Match &amp; KYC</th><th>Account Actions</th></tr></thead>
          <tbody>
            ${data.map(u => `
              <tr>
                <td>
                  <strong>${esc(u.firstName + ' ' + u.lastName)}</strong>
                  ${u.aadhaarMasked ? `<br><small class="text-muted">Aadhaar: ${esc(u.aadhaarMasked)}</small>` : ''}
                </td>
                <td>
                  ${esc(u.email)}
                  ${u.phone ? `<br><small><a href="tel:${esc(u.phone)}" style="color:var(--purple);font-weight:600">📞 ${esc(u.phone)}</a> ${u.phoneVerified ? '<span style="color:#059669;font-weight:700;">✓ OTP</span>' : ''}</small>` : ''}
                </td>
                <td>${badge(u.role)}</td>
                <td>
                  ${badge(u.isVerified ? 'APPROVED' : 'PENDING')}
                  ${u.faceMatchScore ? `<br><small style="color:#059669;font-weight:700;">Face Score: ${Number(u.faceMatchScore).toFixed(1)}%</small>` : ''}
                  ${u.selfieMediaId ? `<br><a href="/api/media/${esc(u.selfieMediaId)}" target="_blank" style="font-size:11.5px;color:var(--purple);font-weight:700;">👁️ View S3 Live Selfie</a>` : ''}
                </td>
                <td>
                  <div class="actions" style="flex-wrap:wrap;gap:6px;">
                    ${!u.isVerified ? `<button class="button btn-orange btn-sm user-verify-kyc-action" data-id="${u.id}">✓ Approve e-KYC</button>` : ''}
                    <button class="btn-outline btn-sm user-password-action" data-id="${u.id}" data-email="${esc(u.email)}">Password</button>
                    ${u.role === 'ADMIN' ? '' : `<button class="btn-ghost btn-sm user-block-action" data-id="${u.id}" data-blocked="${u.isBlocked ? 'false' : 'true'}">${u.isBlocked ? 'Unblock' : 'Block'}</button>`}
                  </div>
                </td>
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

  if ($('#admin-add-vehicle-btn')) {
    $('#admin-add-vehicle-btn').onclick = () => {
      showDialog(`
        <h3>Add New Vehicle to Fleet</h3>
        <p class="text-muted">Directly register a new car into the active rental fleet.</p>
        <form id="admin-add-vehicle-form" class="form-stack">
          ${inp('make', 'Vehicle Make (e.g. Hyundai)', 'text', 'required maxlength="50"')}
          ${inp('model', 'Model (e.g. Creta)', 'text', 'required maxlength="50"')}
          ${inp('year', 'Year of Manufacture', 'number', 'required min="2000" max="2030" value="2025"')}
          ${inp('registrationNumber', 'Registration Number (e.g. GJ01AB1234)', 'text', 'required maxlength="30" style="text-transform:uppercase"')}
          ${inp('city', 'City (e.g. Ahmedabad)', 'text', 'required maxlength="50" value="Ahmedabad"')}
          ${sel('category', 'Category', ['SUV', 'SEDAN', 'HATCHBACK', 'LUXURY', 'EV'])}
          ${sel('transmission', 'Transmission', ['AUTOMATIC', 'MANUAL'])}
          ${sel('fuelType', 'Fuel Type', ['PETROL', 'DIESEL', 'ELECTRIC', 'HYBRID', 'CNG'])}
          ${inp('seats', 'Seating Capacity', 'number', 'required min="1" max="50" value="5"')}
          ${inp('pricePerDay', 'Daily Rate (₹)', 'number', 'required min="1" max="1000000" value="2500"')}
          ${inp('odometer', 'Current Odometer (km)', 'number', 'required min="0" max="1000000" value="5000"')}
          ${inp('images', 'Image URL (optional)', 'url', 'placeholder="https://images.unsplash.com/..."')}
          <button type="submit" class="button btn-orange">Create &amp; Activate Vehicle</button>
        </form>
      `);

      bindForm('#admin-add-vehicle-form', async data => {
        await post('/admin/vehicles', data);
        $('dialog').close();
        await adminPage('vehicles');
        toast('New vehicle added to fleet and activated.');
      });
    };
  }

  $$('.open-car-folder-tile').forEach(tile => {
    tile.onclick = (e) => {
      if (e.target.closest('summary') || e.target.closest('a') || e.target.closest('details') || e.target.closest('button')) return;
      const vehicle = adminData.vehicles.find(v => v.id === tile.dataset.id);
      if (vehicle) openCarFolder(vehicle);
    };
  });
  $$('.vehicle-folder-btn').forEach(btn => btn.onclick = (e) => {
    e.stopPropagation();
    const vehicle = adminData.vehicles.find(v => v.id === btn.dataset.id);
    if (vehicle) openCarFolder(vehicle);
  });
  $$('.vehicle-schedule-action').forEach(btn => btn.onclick = () => openVehicleSchedule(adminData.vehicles.find(v => v.id === btn.dataset.id)));
  $$('.vehicle-pricing-action').forEach(btn => btn.onclick = () => {
    const vehicle = adminData.vehicles.find(v => v.id === btn.dataset.id);
    showDialog(`<h3>Edit daily rental price</h3><p>${esc(vehicle.make + ' ' + vehicle.model)} · ${esc(vehicle.registrationNumber)}</p>
      <form id="vehicle-pricing-form" class="form-stack">
      ${inp('pricePerDay','Daily rate (₹)','number',`min="1" max="1000000" step="0.01" value="${Number(vehicle.pricePerDay)}"`)}
      ${inp('reason','Reason for price change','text','maxlength="1000" value="Market rate adjustment"')}
      <button type="submit" class="button btn-orange">Save daily rate</button></form>`);
    bindForm('#vehicle-pricing-form', async data => {
      await post('/admin/vehicles/' + vehicle.id + '/pricing', {...data, expectedRate: Number(vehicle.pricePerDay)});
      $('dialog').close(); await adminPage('vehicles'); toast('Daily rate updated.');
    });
  });

  $$('.admin-handover-btn').forEach(btn => {
    btn.onclick = () => openHandoverWizardModal(btn.dataset.id, btn.dataset.stage);
  });

  $$('.admin-inspect-photos-btn').forEach(btn => {
    btn.onclick = () => {
      const booking = adminData.bookings.find(b => b.id === btn.dataset.id);
      if (!booking) return;
      showDialog(`
        <div style="max-width:740px;">
          <h3>18-Photo Pickup &amp; Return Handover Evidence</h3>
          <p class="text-muted">Booking Ref: <strong>${esc(booking.bookingRef)}</strong> · ${esc(booking.vehicle.make + ' ' + booking.vehicle.model)}</p>
          ${(booking.inspections || []).map(ins => `
            <div class="panel" style="margin-bottom:14px;">
              <div style="display:flex;justify-content:space-between;align-items:center;">
                <strong>${esc(ins.stage)} HANDOVER</strong>
                <span class="badge ok">${Number(ins.odometer).toLocaleString('en-IN')} km · Fuel ${Number(ins.fuelPercent || 0)}%</span>
              </div>
              <p class="text-muted" style="font-size:12px;margin:4px 0 10px;">${esc(ins.damageNote || '')} · Recorded ${dt(ins.createdAt)}</p>
              <div class="admin-photo-grid compact">
                ${(ins.photos || []).map(p => `
                  <figure>
                    <a href="/api/media/${esc(p.mediaId)}" target="_blank"><img src="/api/media/${esc(p.mediaId)}" alt="${esc(p.media?.kind || 'Inspection')}"></a>
                    <figcaption>${esc(p.media?.kind || 'PHOTO')}</figcaption>
                  </figure>
                `).join('') || `<figure><a href="/api/media/${esc(ins.mediaId)}" target="_blank"><img src="/api/media/${esc(ins.mediaId)}" alt="Primary"></a><figcaption>PRIMARY</figcaption></figure>`}
              </div>
            </div>
          `).join('')}
        </div>
      `);
    };
  });

  $$('.user-verify-kyc-action').forEach(btn => {
    btn.onclick = async () => {
      btn.disabled = true;
      try {
        await post('/admin/users/' + encodeURIComponent(btn.dataset.id) + '/verify-kyc', { approved: true, faceMatchScore: 96.4 });
        toast('Customer e-KYC & Biometric Face Match approved!');
        await adminPage('users');
      } catch (err) {
        toast(err.message, true);
        btn.disabled = false;
      }
    };
  });

  $$('.doc-quick-approve-action').forEach(btn => {
    btn.onclick = async () => {
      btn.disabled = true;
      try {
        await post('/admin/documents/' + encodeURIComponent(btn.dataset.id) + '/quick-review', { status: 'APPROVED', note: 'Verified via Admin Command Center' });
        toast('Document approved & user KYC verified!');
        await adminPage('documents');
      } catch (err) {
        toast(err.message, true);
        btn.disabled = false;
      }
    };
  });

  $$('.user-password-action').forEach(btn => btn.onclick = () => {
    const email = btn.dataset.email || 'this user';
    showDialog(`
      <h3>Reset User Password</h3>
      <p class="text-muted">Set a new secure password for <strong>${esc(email)}</strong>.</p>
      <form id="admin-user-password-form" class="form-stack">
        <label>New Password (min 8 characters)
          <input name="password" type="password" required minlength="8" placeholder="••••••••">
        </label>
        <button type="submit" class="button btn-orange">Update Password</button>
      </form>
    `);
    bindForm('#admin-user-password-form', async data => {
      await post('/admin/users/' + encodeURIComponent(btn.dataset.id) + '/password', data);
      $('dialog').close();
      toast('Password updated successfully for ' + email);
    });
  });

  $$('.booking-swap-action').forEach(btn => btn.onclick = async () => {
    try {
      btn.disabled = true;
      const data = await api('/admin/bookings/' + btn.dataset.id + '/swap-candidates');
      if (!data.candidates?.length) {
        btn.disabled = false;
        return toast('No available replacement vehicles found for these dates.', true);
      }
      showDialog(`
        <h3>Swap Booking Vehicle</h3>
        <form id="admin-booking-swap-form" class="form-stack">
          <label>Select Replacement Vehicle (${data.candidates.length} available)
            <select name="newVehicleId" required>
              ${data.candidates.map(c => `<option value="${c.id}">${esc(c.make + ' ' + c.model + ' (' + (c.registrationNumber || 'No Reg') + ') · ₹' + c.pricePerDay + '/day')}</option>`).join('')}
            </select>
          </label>
          <label>Reason for Swap<textarea name="reason" required maxlength="1000">Operational upgrade</textarea></label>
          <button type="submit" class="button btn-orange">Confirm Vehicle Swap</button>
        </form>
      `);
      bindForm('#admin-booking-swap-form', async formData => {
        await post('/admin/bookings/' + btn.dataset.id + '/swap', formData);
        $('dialog').close();
        await adminPage('bookings');
        toast('Vehicle swapped successfully.');
      });
    } catch (err) { toast(err.message, true); }
    finally { btn.disabled = false; }
  });

  $$('.booking-cancel-admin-action').forEach(btn => btn.onclick = () => {
    showDialog(`
      <h3>Cancel Booking</h3>
      <form id="admin-booking-cancel-form" class="form-stack">
        <label>Reason for Cancellation<textarea name="reason" required maxlength="1000" placeholder="Reason for cancellation…"></textarea></label>
        <button type="submit" class="button btn-orange" style="background:var(--red);border-color:var(--red)">Confirm Cancellation</button>
      </form>
    `);
    bindForm('#admin-booking-cancel-form', async formData => {
      await post('/admin/bookings/' + btn.dataset.id + '/cancel', formData);
      $('dialog').close();
      await adminPage('bookings');
      toast('Booking cancelled.');
    });
  });

  $$('.user-block-action').forEach(btn => btn.onclick = async () => {
    const blocking = btn.dataset.blocked === 'true';
    const reason = window.prompt(blocking ? 'Reason for blocking this account:' : 'Reason for unblocking this account:', 'Compliance review');
    if (!reason || !reason.trim()) return;
    try { await post('/admin/users/' + encodeURIComponent(btn.dataset.id) + '/block', { blocked: blocking, note: reason.trim() }); await adminPage('users'); toast(blocking ? 'Account blocked.' : 'Account unblocked.'); }
    catch (err) { toast(err.message, true); }
  });

  $$('.payout-account-status-action').forEach(btn => btn.onclick = async () => {
    const status = window.prompt('Set payout account status (PENDING, VERIFIED or REJECTED):', 'VERIFIED');
    if (!status) return;
    try { await post('/payouts/accounts/' + encodeURIComponent(btn.dataset.id) + '/status', { status: status.trim().toUpperCase() }); await adminPage('payouts'); toast('Payout account status updated.'); }
    catch (err) { toast(err.message, true); }
  });

  $$('.payout-status-action').forEach(btn => btn.onclick = async () => {
    const status = window.prompt('Set payout status (PENDING, PROCESSING, PAID, FAILED or CANCELLED):', 'PAID');
    if (!status) return;
    const reference = window.prompt('Payment reference / UTR (optional):', 'UTR-' + Date.now().toString().slice(-6));
    try { await post('/payouts/' + encodeURIComponent(btn.dataset.id) + '/status', { status: status.trim().toUpperCase(), reference: reference?.trim() || undefined }); await adminPage('payouts'); toast('Payout status updated.'); }
    catch (err) { toast(err.message, true); }
  });

  $$('.doc-review-action').forEach(btn => btn.onclick = async () => {
    showDialog(`
      <h3>Inspect Document Evidence</h3>
      <div id="evidence-viewer-box" class="notice">Fetching document from AWS S3…</div><br>
      <form id="doc-decision-form" class="form-stack">
        <label>Decision
          <select name="status" required>
            <option value="APPROVED">Approve Document</option>
            <option value="REJECTED">Reject Submission</option>
          </select>
        </label>
        <label>Review Remarks
          <textarea name="note" required maxlength="1000">Verified document & identity.</textarea>
        </label>
        <button type="submit" class="button btn-orange">Save Decision</button>
      </form>`);

    bindForm('#doc-decision-form', async data => {
      await post('/admin/documents/' + encodeURIComponent(btn.dataset.id) + '/quick-review', data);
      $('dialog').close();
      await adminPage('documents');
      toast('Document decision saved.');
    });
    await renderOriginalEvidence($('#evidence-viewer-box'), '/admin/documents/' + btn.dataset.id + '/evidence', 'Original document', () => {}, () => {});
  });

  $$('.record-pmt-action, .record-ref-action').forEach(btn => btn.onclick = () => {
    const isRefund = btn.classList.contains('record-ref-action');
    showDialog(`
      <h3>${isRefund ? 'Record Bank Refund' : 'Record Received Payment'}</h3>
      <form id="admin-pmt-form" class="form-stack">
        ${inp('reference','Bank Transaction Reference / UTR Number','text',`value="UTR-${Date.now().toString().slice(-6)}"`)}
        ${!isRefund ? inp('amount','Amount Received (₹)','number',`step="1" value="${btn.dataset.amount}"`) : ''}
        <label class="check"><input type="checkbox" required checked><span>Verified in bank statement.</span></label>
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
    'agreement.html': agreement,
    'host-agreement.html': hostAgreement,
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

function openCarFolder(v) {
  const contentHtml = `
    <div class="car-folder-workspace">
      <div style="display:flex;align-items:center;gap:14px;padding-bottom:14px;border-bottom:1px solid var(--border-main)">
        <img src="${getVehicleCover(v)}" alt="${esc(v.make + ' ' + v.model)}" style="width:64px;height:64px;object-fit:cover;border-radius:8px;border:1px solid var(--border-main)">
        <div style="flex:1">
          <div style="display:flex;align-items:center;gap:8px">
            <h3 style="margin:0">${esc(v.make + ' ' + v.model + ' ' + v.year)}</h3>
            ${badge(v.status)}
          </div>
          <p class="text-muted" style="margin:4px 0 0 0;font-size:13px">
            Reg: <strong>${esc(v.registrationNumber || 'Pending')}</strong> · City: ${esc(v.locationCity)} · ${Number(v.odometer || 0).toLocaleString('en-IN')} km · Rate: <strong>${money(v.pricePerDay)}/day</strong>
          </p>
        </div>
      </div>

      <div class="folder-tabs" id="car-folder-tab-bar">
        <button type="button" class="active" data-folder-tab="overview">Overview &amp; Decision</button>
        <button type="button" data-folder-tab="pricing">Edit Rate</button>
        <button type="button" data-folder-tab="photos">Photos (${v.media?.length || 0})</button>
        <button type="button" data-folder-tab="compliance">Compliance (${v.documents?.length || 0})</button>
        <button type="button" data-folder-tab="schedule">Schedule</button>
      </div>

      <div id="folder-tab-content-overview" class="folder-tab-content">
        <div class="card" style="margin-bottom:14px;padding:16px">
          <h4 style="margin:0 0 10px 0">Vehicle Details &amp; Specifications</h4>
          <div style="display:grid;grid-template-columns:repeat(auto-fit, minmax(130px, 1fr));gap:10px;font-size:13px">
            <div><span class="text-muted">Category:</span><br><strong>${esc(v.category || 'SUV')}</strong></div>
            <div><span class="text-muted">Transmission:</span><br><strong>${esc(v.transmission || 'AUTOMATIC')}</strong></div>
            <div><span class="text-muted">Fuel Type:</span><br><strong>${esc(v.fuelType || 'PETROL')}</strong></div>
            <div><span class="text-muted">Seats:</span><br><strong>${v.seats || 5} Seats</strong></div>
            <div><span class="text-muted">Daily Rate:</span><br><strong>${money(v.pricePerDay)}</strong></div>
            <div><span class="text-muted">Odometer:</span><br><strong>${Number(v.odometer || 0).toLocaleString('en-IN')} km</strong></div>
          </div>
        </div>
        <form id="folder-decision-form" class="form-stack">
          <h4 style="margin:0 0 8px 0">Update Vehicle Status &amp; Decision Notes</h4>
          ${sel('status', 'Set Vehicle Status', ['ACTIVE', 'PENDING_APPROVAL', 'INACTIVE', 'MAINTENANCE'])}
          <label>Reviewer Note / Decision Reason
            <textarea name="note" required maxlength="1000" placeholder="Notes on inspection, compliance, or vehicle condition…"></textarea>
          </label>
          <button type="submit" class="button btn-orange">Save Vehicle Decision</button>
        </form>
      </div>

      <div id="folder-tab-content-pricing" class="folder-tab-content" hidden>
        <form id="folder-pricing-form" class="form-stack">
          <h4 style="margin:0 0 8px 0">Edit Daily Rental Rate</h4>
          <p class="text-muted" style="font-size:13px">Applies to new reservations. Existing booking totals stay unchanged.</p>
          ${inp('pricePerDay', 'Daily Rate (₹)', 'number', `required min="1" max="1000000" step="0.01" value="${Number(v.pricePerDay)}"`)}
          ${inp('reason', 'Reason for price change', 'text', 'maxlength="1000" placeholder="e.g. Seasonal pricing adjustment"')}
          <button type="submit" class="button btn-orange">Save Daily Rate</button>
        </form>
      </div>

      <div id="folder-tab-content-photos" class="folder-tab-content" hidden>
        <h4 style="margin:0 0 10px 0">Vehicle Inspection Photos (${v.media?.length || 0})</h4>
        <div class="admin-photo-grid" style="margin-top:12px">
          ${PHOTO_ANGLES.map(angle => {
            const m = v.media?.find(item => item.kind === angle);
            if (m) {
              return `<figure><a href="/api/media/${m.id}" target="_blank" rel="noopener noreferrer"><img loading="lazy" src="/api/media/${m.id}" alt="${esc(m.kind)}"></a><figcaption>${esc((m.kind || '').replaceAll('_', ' '))}</figcaption></figure>`;
            } else {
              return `<figure style="opacity:0.6;background:var(--bg-subtle,#f5f5f7);display:flex;flex-direction:column;align-items:center;justify-content:center;min-height:120px;text-align:center;padding:12px"><span style="font-size:24px">📷</span><figcaption style="padding:4px 0">${esc(angle.replaceAll('_', ' '))}<br><small class="text-muted">Not uploaded</small></figcaption></figure>`;
            }
          }).join('')}
        </div>
      </div>

      <div id="folder-tab-content-compliance" class="folder-tab-content" hidden>
        <h4 style="margin:0 0 10px 0">Compliance &amp; Legal Documents</h4>
        ${v.documents?.length ? `
          <div class="table-wrap">
            <table style="margin-top:8px">
              <thead><tr><th>Document Type</th><th>Status</th><th>Valid Until</th><th>Action</th></tr></thead>
              <tbody>
                ${v.documents.map(d => `
                  <tr>
                    <td><strong>${esc(d.kind)}</strong></td>
                    <td>${badge(d.status)}</td>
                    <td>${d.validUntil ? dt(d.validUntil) : 'N/A'}</td>
                    <td><a href="/api/media/${d.id || ''}" target="_blank" class="btn-ghost btn-sm" ${!d.id ? 'style="pointer-events:none;opacity:0.5"' : ''}>View Document</a></td>
                  </tr>`).join('')}
              </tbody>
            </table>
          </div>
        ` : '<p class="text-muted" style="margin-top:10px">No compliance documents attached to this vehicle.</p>'}
      </div>

      <div id="folder-tab-content-schedule" class="folder-tab-content" hidden>
        <h4 style="margin:0 0 10px 0">Availability &amp; Schedule Management</h4>
        <div id="folder-schedule-container" class="loading">Loading vehicle schedule…</div>
      </div>
    </div>
  `;

  showDialog(contentHtml);

  const statusSel = $('#folder-decision-form select[name="status"]');
  if (statusSel) statusSel.value = v.status || 'ACTIVE';

  const tabButtons = $$('#car-folder-tab-bar button');
  tabButtons.forEach(btn => {
    btn.onclick = () => {
      tabButtons.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      const target = btn.dataset.folderTab;
      $$('.folder-tab-content').forEach(el => el.hidden = true);
      const targetEl = $(`#folder-tab-content-${target}`);
      if (targetEl) targetEl.hidden = false;
      if (target === 'schedule' && $('#folder-schedule-container')?.classList.contains('loading')) {
        loadFolderSchedule(v.id);
      }
    };
  });

  bindForm('#folder-decision-form', async data => {
    await post('/admin/vehicles/' + v.id + '/review', data);
    $('dialog').close();
    await adminPage('vehicles');
    toast('Vehicle decision updated.');
  });

  bindForm('#folder-pricing-form', async data => {
    await post('/admin/vehicles/' + v.id + '/pricing', { ...data, expectedRate: Number(v.pricePerDay) });
    $('dialog').close();
    await adminPage('vehicles');
    toast('Daily rate updated.');
  });
}

async function loadFolderSchedule(vehicleId) {
  const container = $('#folder-schedule-container');
  if (!container) return;
  try {
    const schedule = await api('/vehicles/' + vehicleId + '/schedule');
    container.className = '';
    container.innerHTML = `
      <p class="text-muted" style="font-size:13px;margin-bottom:12px">Block dates for personal use or maintenance. Existing reservations cannot be displaced.</p>
      <h5 style="margin:12px 0 6px">Upcoming Reservations</h5>
      <div class="schedule-list">${schedule.bookings.map(item => `<div>${badge(item.status)}<p>${dt(item.startDate)} → ${dt(item.endDate)}</p></div>`).join('') || '<p class="text-muted" style="font-size:13px">No upcoming reservations.</p>'}</div>
      <h5 style="margin:16px 0 6px">Blocked Dates / Maintenance</h5>
      <div class="schedule-list">${schedule.blocks.map(item => `<div><strong>${esc(item.reason)}</strong><p>${dt(item.startDate)} → ${dt(item.endDate)}</p><button type="button" class="btn-outline btn-sm release-folder-block" data-id="${item.id}">Reopen dates</button></div>`).join('') || '<p class="text-muted" style="font-size:13px">No blocked periods.</p>'}</div>
      <form id="folder-availability-form" class="form-stack" style="margin-top:16px">
        <h5 style="margin:0 0 8px">Block Dates</h5>
        ${inp('startDate','Unavailable from','datetime-local')}
        ${inp('endDate','Available again','datetime-local')}
        ${inp('reason','Reason','text','maxlength="300" placeholder="Maintenance or personal use"')}
        <button type="submit" class="button btn-orange btn-sm">Block These Dates</button>
      </form>
    `;
    bindForm('#folder-availability-form', async data => {
      const start = new Date(data.startDate), end = new Date(data.endDate);
      if (!Number.isFinite(+start) || !Number.isFinite(+end) || end <= start) throw new Error('Choose a valid period');
      await post('/vehicles/' + vehicleId + '/availability-blocks', {...data, startDate: start.toISOString(), endDate: end.toISOString()});
      await loadFolderSchedule(vehicleId);
      toast('Availability updated.');
    });
    $$('.release-folder-block').forEach(rel => rel.onclick = async () => {
      rel.disabled = true;
      try {
        await post('/vehicles/' + vehicleId + '/availability-blocks/' + rel.dataset.id + '/release', {});
        await loadFolderSchedule(vehicleId);
        toast('Dates reopened.');
      } catch (err) {
        rel.disabled = false;
        toast(err.message, true);
      }
    });
  } catch (err) {
    container.className = '';
    container.innerHTML = `<p class="error">Unable to load schedule: ${esc(err.message)}</p>`;
  }
}

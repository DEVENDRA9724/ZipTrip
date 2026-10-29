'use strict';

function safeUuid() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

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
      card.append(name, format);
      // Inline preview for uploaded images served by this site (DigiLocker originals keep their own format and links).
      const contentType = String(file.metadata?.ContentType || '');
      const isImage = /^image\/(jpeg|png|webp)$/i.test(contentType) || /^(JPE?G|PNG|WEBP)$/.test(extension || '');
      if (isImage && new URL(file.url, location.origin).origin === location.origin) {
        const preview = document.createElement('a');
        preview.href = file.url;
        preview.target = '_blank';
        preview.rel = 'noopener noreferrer';
        preview.referrerPolicy = 'no-referrer';
        preview.className = 'evidence-preview';
        preview.title = 'Open full size';
        preview.onclick = () => onOpen(evidence);
        const img = document.createElement('img');
        img.src = file.url;
        img.alt = (file.metadata?.description || title) + ' preview';
        img.loading = 'lazy';
        img.onerror = () => { preview.replaceWith(Object.assign(document.createElement('p'), { className: 'text-muted', textContent: 'Preview unavailable. Use Open or Download.' })); };
        preview.append(img);
        card.append(preview);
      }
      const actions = document.createElement('div');
      actions.className = 'evidence-actions';
      actions.append(link, download);
      card.append(actions);
      box.append(card);
    }
    // DigiLocker links expire, so they can be refreshed; uploaded images are served from this site and never expire.
    if (evidence.source === 'DIGILOCKER') {
      const refresh = document.createElement('button');
      refresh.type = 'button';
      refresh.className = 'button btn-ghost btn-sm';
      refresh.textContent = 'Refresh links';
      refresh.onclick = () => renderOriginalEvidence(box, endpoint, title, onEvidence, onOpen);
      box.append(refresh);
    }
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

/* ─── Vehicle Images ─────────────────────────────────────────────────
   Vehicle.images is untrusted: it may hold an admin-typed URL, a JSON list of /api/media links or legacy values.
   URLs are allow-listed (uploaded media, bundled car assets, or absolute https) and never written into HTML strings.
   Templates emit vehicleImageSlot(url); the URL is assigned through img.src after the markup is inserted. */
const CAR_IMAGE_MAP = {
  thar: 'cars/thar.jpg',
  creta: 'cars/creta.jpg',
  fortuner: 'cars/fortuner.jpg',
  innova: 'cars/innova.jpg',
  swift: 'cars/swift.jpg',
  bmw: 'cars/bmw.jpg',
  city: 'cars/city.jpg',
  scorpio: 'cars/scorpio.jpg',
  dzire: 'cars/dzire.jpg',
  i20: 'cars/i20.jpg',
  venue: 'cars/venue.jpg',
  mercedes: 'cars/mercedes.jpg',
  carens: 'cars/carens.jpg',
};

function getCarStockPhoto(car) {
  const text = `${car?.make || ''} ${car?.model || ''} ${car?.category || ''}`.toLowerCase();
  for (const [key, path] of Object.entries(CAR_IMAGE_MAP)) {
    if (text.includes(key)) return path;
  }
  return 'cars/creta.jpg';
}

// Vehicle data is untrusted: only allow-listed URLs (safeVehicleImageUrl) are returned, so callers may place the result
// in an attribute; anything else falls back to the bundled model photo.
function getVehicleCover(v) {
  const url = vehicleCoverUrl(v);
  return url === VEHICLE_IMAGE_FALLBACK ? getCarStockPhoto(v) : url;
}

const badge = s => {
  const cls = ['ACTIVE','APPROVED','CONFIRMED','PAID','COMPLETED','SUCCESS','VERIFIED'].includes(s) ? 'good'
    : ['REJECTED','CANCELLED','FAILED','EXPIRED'].includes(s) ? 'red' : 'warn';
  const val = String(s || '');
  return `<span class="badge ${cls}">${esc(val.replaceAll('_',' '))}</span>`;
};

/* ─── ICON LIBRARY (Lucide, ISC licence — inline SVG paths) ──────────── */
const ICONS = {
  car: '<path d="M19 17h2c.6 0 1-.4 1-1v-3c0-.9-.7-1.7-1.5-1.9C18.7 10.6 16 10 16 10s-1.3-1.4-2.2-2.3c-.5-.4-1.1-.7-1.8-.7H5c-.6 0-1.1.4-1.4.9l-1.4 2.9A3.7 3.7 0 0 0 2 12v4c0 .6.4 1 1 1h2"/><circle cx="7" cy="17" r="2"/><path d="M9 17h6"/><circle cx="17" cy="17" r="2"/>',
  pin: '<path d="M20 10c0 4.993-5.539 10.193-7.399 11.799a1 1 0 0 1-1.202 0C9.539 20.193 4 14.993 4 10a8 8 0 0 1 16 0"/><circle cx="12" cy="10" r="3"/>',
  calendar: '<path d="M8 2v4"/><path d="M16 2v4"/><rect width="18" height="18" x="3" y="4" rx="2"/><path d="M3 10h18"/>',
  shield: '<path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z"/><path d="m9 12 2 2 4-4"/>',
  card: '<rect width="20" height="14" x="2" y="5" rx="2"/><line x1="2" x2="22" y1="10" y2="10"/>',
  support: '<circle cx="12" cy="12" r="10"/><path d="m4.93 4.93 4.24 4.24"/><path d="m14.83 9.17 4.24-4.24"/><path d="m14.83 14.83 4.24 4.24"/><path d="m9.17 14.83-4.24 4.24"/><circle cx="12" cy="12" r="4"/>',
  file: '<path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z"/><path d="M14 2v4a2 2 0 0 0 2 2h4"/><path d="M10 9H8"/><path d="M16 13H8"/><path d="M16 17H8"/>',
  idcard: '<path d="M16 10h2"/><path d="M16 14h2"/><path d="M6.17 15a3 3 0 0 1 5.66 0"/><circle cx="9" cy="11" r="2"/><rect x="2" y="5" width="20" height="14" rx="2"/>',
  key: '<path d="m15.5 7.5 2.3 2.3a1 1 0 0 0 1.4 0l2.1-2.1a1 1 0 0 0 0-1.4L19 4"/><path d="m21 2-9.6 9.6"/><circle cx="7.5" cy="15.5" r="5.5"/>',
  user: '<path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>',
  users: '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>',
  fuel: '<line x1="3" x2="15" y1="22" y2="22"/><line x1="4" x2="14" y1="9" y2="9"/><path d="M14 22V4a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v18"/><path d="M14 13h2a2 2 0 0 1 2 2v2a2 2 0 0 0 2 2a2 2 0 0 0 2-2V9.83a2 2 0 0 0-.59-1.42L18 5"/>',
  gauge: '<path d="m12 14 4-4"/><path d="M3.34 19a10 10 0 1 1 17.32 0"/>',
  gear: '<path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/><circle cx="12" cy="12" r="3"/>',
  transmission: '<circle cx="6" cy="6" r="2"/><circle cx="12" cy="6" r="2"/><circle cx="18" cy="6" r="2"/><circle cx="6" cy="18" r="2"/><circle cx="12" cy="18" r="2"/><path d="M6 8v8"/><path d="M12 8v8"/><path d="M18 8v4H6"/>',
  star: '<path d="M11.525 2.295a.53.53 0 0 1 .95 0l2.31 4.679a2.123 2.123 0 0 0 1.595 1.16l5.166.756a.53.53 0 0 1 .294.904l-3.736 3.638a2.123 2.123 0 0 0-.611 1.878l.882 5.14a.53.53 0 0 1-.771.56l-4.618-2.428a2.122 2.122 0 0 0-1.973 0L6.396 21.01a.53.53 0 0 1-.77-.56l.881-5.139a2.122 2.122 0 0 0-.611-1.879L2.16 9.795a.53.53 0 0 1 .294-.906l5.165-.755a2.122 2.122 0 0 0 1.597-1.16z"/>',
  check: '<path d="M20 6 9 17l-5-5"/>',
  checkCircle: '<circle cx="12" cy="12" r="10"/><path d="m9 12 2 2 4-4"/>',
  xCircle: '<circle cx="12" cy="12" r="10"/><path d="m15 9-6 6"/><path d="m9 9 6 6"/>',
  clock: '<circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>',
  alert: '<circle cx="12" cy="12" r="10"/><line x1="12" x2="12" y1="8" y2="12"/><line x1="12" x2="12.01" y1="16" y2="16"/>',
  logout: '<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" x2="9" y1="12" y2="12"/>',
  bell: '<path d="M10.268 21a2 2 0 0 0 3.464 0"/><path d="M3.262 15.326A1 1 0 0 0 4 17h16a1 1 0 0 0 .74-1.673C19.41 13.956 18 12.499 18 8A6 6 0 0 0 6 8c0 4.499-1.411 5.956-2.738 7.326"/>',
  receipt: '<path d="M4 2v20l2-1 2 1 2-1 2 1 2-1 2 1 2-1 2 1V2l-2 1-2-1-2 1-2-1-2 1-2-1-2 1Z"/><path d="M16 8h-6a2 2 0 1 0 0 4h4a2 2 0 1 1 0 4H8"/><path d="M12 17.5v-11"/>',
  camera: '<path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z"/><circle cx="12" cy="13" r="3"/>',
  wallet: '<path d="M19 7V4a1 1 0 0 0-1-1H5a2 2 0 0 0 0 4h15a1 1 0 0 1 1 1v4h-3a2 2 0 0 0 0 4h3a1 1 0 0 0 1-1v-2a1 1 0 0 0-1-1"/><path d="M3 5v14a2 2 0 0 0 2 2h15a1 1 0 0 0 1-1v-4"/>',
  search: '<circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/>',
  menu: '<line x1="4" x2="20" y1="12" y2="12"/><line x1="4" x2="20" y1="6" y2="6"/><line x1="4" x2="20" y1="18" y2="18"/>',
  phone: '<path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/>',
  mail: '<rect width="20" height="16" x="2" y="4" rx="2"/><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/>',
  message: '<path d="M7.9 20A9 9 0 1 0 4 16.1L2 22Z"/>',
  chevronRight: '<path d="m9 18 6-6-6-6"/>',
  arrowRight: '<path d="M5 12h14"/><path d="m12 5 7 7-7 7"/>',
  upload: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" x2="12" y1="3" y2="15"/>',
  download: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" x2="12" y1="15" y2="3"/>',
  home: '<path d="M15 21v-8a1 1 0 0 0-1-1h-4a1 1 0 0 0-1 1v8"/><path d="M3 10a2 2 0 0 1 .709-1.528l7-5.999a2 2 0 0 1 2.582 0l7 5.999A2 2 0 0 1 21 10v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>',
  chart: '<path d="M3 3v16a2 2 0 0 0 2 2h16"/><path d="M18 17V9"/><path d="M13 17V5"/><path d="M8 17v-3"/>',
  layers: '<path d="m12.83 2.18a2 2 0 0 0-1.66 0L2.6 6.08a1 1 0 0 0 0 1.83l8.58 3.91a2 2 0 0 0 1.66 0l8.58-3.9a1 1 0 0 0 0-1.83Z"/><path d="m22 17.65-9.17 4.16a2 2 0 0 1-1.66 0L2 17.65"/><path d="m22 12.65-9.17 4.16a2 2 0 0 1-1.66 0L2 12.65"/>',
  banknote: '<rect width="20" height="12" x="2" y="6" rx="2"/><circle cx="12" cy="12" r="2"/><path d="M6 12h.01M18 12h.01"/>',
  lock: '<rect width="18" height="11" x="3" y="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>',
  history: '<path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/><path d="M12 7v5l4 2"/>',
  route: '<circle cx="6" cy="19" r="3"/><path d="M9 19h8.5a3.5 3.5 0 0 0 0-7h-11a3.5 3.5 0 0 1 0-7H15"/><circle cx="18" cy="5" r="3"/>',
  truck: '<path d="M14 18V6a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v11a1 1 0 0 0 1 1h2"/><path d="M15 18H9"/><path d="M19 18h2a1 1 0 0 0 1-1v-3.65a1 1 0 0 0-.22-.624l-3.48-4.35A1 1 0 0 0 17.52 8H14"/><circle cx="17" cy="18" r="2"/><circle cx="7" cy="18" r="2"/>',
  plus: '<path d="M5 12h14"/><path d="M12 5v14"/>',
  refresh: '<path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"/><path d="M21 3v5h-5"/><path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16"/><path d="M8 16H3v5"/>',
  eye: '<path d="M2.062 12.348a1 1 0 0 1 0-.696 10.75 10.75 0 0 1 19.876 0 1 1 0 0 1 0 .696 10.75 10.75 0 0 1-19.876 0"/><circle cx="12" cy="12" r="3"/>',
  scale: '<path d="m16 16 3-8 3 8c-.87.65-1.92 1-3 1s-2.13-.35-3-1Z"/><path d="m2 16 3-8 3 8c-.87.65-1.92 1-3 1s-2.13-.35-3-1Z"/><path d="M7 21h10"/><path d="M12 3v18"/><path d="M3 7h2c2 0 5-1 7-2 2 1 5 2 7 2h2"/>',
  seat: '<path d="M7 18v-6a5 5 0 1 1 10 0v6"/><path d="M5 21a1 1 0 0 0 1-1v-1a2 2 0 0 0-4 0v1a1 1 0 0 0 1 1z"/><path d="M21 20a1 1 0 0 0 1-1v-1a2 2 0 0 0-4 0v1a1 1 0 0 0 1 1z"/><path d="M7 18h10"/>',
};
function icon(name, cls = '') {
  return `<svg class="ic ${cls}" viewBox="0 0 24 24" aria-hidden="true" focusable="false">${ICONS[name] || ICONS.alert}</svg>`;
}
/* Vector brand mark: a road curve forming an "S" inside a rounded tile */
function brandMark(size = 34, light = false) {
  const tile = light ? '#FFFFFF' : '#3B123F';
  const road = light ? '#3B123F' : '#FFFFFF';
  return `<svg width="${size}" height="${size}" viewBox="0 0 40 40" aria-hidden="true"><rect width="40" height="40" rx="10" fill="${tile}"/><path d="M27 11.5c-2-1.6-4.4-2.2-7-2-4 .3-6.6 2.6-6.6 5.6 0 6.6 13.4 3.4 13.4 10 0 3.2-3 5.5-7.2 5.5-2.9 0-5.4-1-7.3-2.8" fill="none" stroke="${road}" stroke-width="3.4" stroke-linecap="round"/><circle cx="27.4" cy="11.6" r="2.4" fill="#F07818"/></svg>`;
}
function brandLockup(light = false) {
  return `<span class="ds-brand"><img class="ds-brand-logo" src="safar-logo.png" alt="Safar Self Drive"><span class="ds-brand-word">Safar<small>SELF DRIVE</small></span></span>`;
}

const page = location.pathname.split('/').pop() || 'index.html';
let user = null, adminData;

/* ─── API Client ─────────────────────────────────────────────────────── */
async function api(path, opts = {}) {
  const token = localStorage.getItem('safar_token');
  const headers = opts.body instanceof FormData
    ? (token ? { 'Authorization': 'Bearer ' + token } : {})
    : { 'Content-Type': 'application/json', ...(token ? { 'Authorization': 'Bearer ' + token } : {}), ...(opts.headers || {}) };

  const res = await fetch('/api' + path, {
    credentials: 'same-origin', ...opts,
    headers,
  });
  if (res.status === 401 && path !== '/auth/login' && path !== '/auth/register' && path !== '/auth/login/otp/verify') {
    localStorage.removeItem('safar_token');
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const error = new Error(Array.isArray(data.message) ? data.message.join(', ') : data.message || `Request failed (${res.status})`);
    if (Array.isArray(data.reasons)) error.reasons = data.reasons;
    throw error;
  }
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
function loadError(title, message, retryLabel = 'Try again') {
  return `<div class="load-error-panel" role="alert"><h3>${esc(title || 'Something went wrong')}</h3><p>${esc(message || 'Please try again in a moment.')}</p><button type="button" class="button btn-orange retry-load-btn">${esc(retryLabel)}</button></div>`;
}
async function uploadFile(file, kind) {
  if (!file?.size) throw new Error(`Please choose a ${kind.toLowerCase()} image`);
  const fd = new FormData(); fd.append('file', file);
  return api('/media?kind=' + kind, {method:'POST', body: fd});
}
function photoUrl(car) {
  const m = car.media?.find(x => x.kind === 'FRONT') || car.media?.[0];
  if (m?.id) return safeVehicleImageUrl('/api/media/' + m.id) || getCarStockPhoto(car);
  return getVehicleCover(car);
}
function requireUser(roles) {
  if (!user) { location.replace('auth.html?redirect=' + encodeURIComponent(page + location.search)); return false; }
  if (roles && !roles.includes(user.role)) {
    $('#app').innerHTML = empty('Access Denied', `This page requires a ${roles.join(' or ')} account.`);
    return false;
  }
  return true;
}

/* ─── COMPANY CONFIG ─────────────────────────────────────────────────── */
// Filled from GET /api/contact (server BUSINESS_* settings) before the page renders; unset values stay null and are not shown.
const COMPANY = { name: 'Safar Self Drive', phone: null, phoneHref: null, email: null, address: null };
async function loadCompany() {
  try {
    const c = await api('/contact');
    Object.assign(COMPANY, {
      name: c.name || COMPANY.name,
      phone: c.phone || null,
      phoneHref: c.phone ? '+' + String(c.phone).replace(/[^0-9]/g, '') : null,
      email: c.email || null,
      address: c.address || null,
    });
  } catch {}
}
const DEFAULT_CITIES = ['Ahmedabad', 'Surat', 'Vadodara', 'Rajkot', 'Gandhinagar'];
const getCity = () => localStorage.getItem('safar-city') || '';
const setCity = c => localStorage.setItem('safar-city', c || '');
const initials = u => ((u?.firstName || '?')[0] + (u?.lastName || '')[0] || '').toUpperCase();

/* ─── HEADER / SHELL ─────────────────────────────────────────────────── */
/* ─── Merged from new-change: compliance, image safety, role menus, owner panel helpers ─── */
const VEHICLE_IMAGE_FALLBACK = 'safar-logo.png';
const vehicleImageSlots = new Map();
let vehicleImageSlotSeq = 0;
function safeVehicleImageUrl(value) {
  if (typeof value !== 'string') return null;
  const raw = value.trim();
  if (!raw || raw.length > 2048 || /[\s"'<>`\\]|[\u0000-\u001f\u007f]/.test(raw)) return null;
  if (/^\/api\/media\/[A-Za-z0-9-]{1,64}$/.test(raw)) return raw;
  if (/^cars\/[A-Za-z0-9_-]{1,64}\.(jpe?g|png|webp)$/i.test(raw)) return raw;
  try {
    const url = new URL(raw);
    return url.protocol === 'https:' && !url.username && !url.password && url.hostname ? url.href : null;
  } catch { return null; }
}
function vehicleImageCandidates(images) {
  if (Array.isArray(images)) return images;
  if (typeof images !== 'string' || !images.trim()) return [];
  if (images.trim().startsWith('[')) { try { const list = JSON.parse(images); return Array.isArray(list) ? list : []; } catch { return []; } }
  return images.split(',');
}
function vehicleCoverUrl(v) {
  const photo = v?.media?.find(m => m.kind === 'FRONT') || v?.media?.find(m => PHOTO_ANGLES.includes(m.kind));
  if (photo?.id) return '/api/media/' + encodeURIComponent(photo.id);
  return vehicleImageCandidates(v?.images).map(safeVehicleImageUrl).find(Boolean) || VEHICLE_IMAGE_FALLBACK;
}
// Returns attributes for an <img>: a slot id (resolved below) and a marker used by the broken-image fallback.
function vehicleImageSlot(url) {
  const id = String(++vehicleImageSlotSeq);
  vehicleImageSlots.set(id, safeVehicleImageUrl(url) || VEHICLE_IMAGE_FALLBACK);
  return `data-vehicle-image data-img-slot="${id}"`;
}
function hydrateVehicleImages(root) {
  if (!root?.querySelectorAll) return;
  const images = root.matches?.('img[data-img-slot]') ? [root] : [...root.querySelectorAll('img[data-img-slot]')];
  for (const img of images) {
    const url = vehicleImageSlots.get(img.dataset.imgSlot);
    vehicleImageSlots.delete(img.dataset.imgSlot);
    img.removeAttribute('data-img-slot');
    img.src = url || VEHICLE_IMAGE_FALLBACK;
  }
}
new MutationObserver(records => records.forEach(r => r.addedNodes.forEach(hydrateVehicleImages))).observe(document.documentElement, { childList: true, subtree: true });
// Delegated actions replace inline onclick/onerror attributes so pages run under a CSP without 'unsafe-inline'.
document.addEventListener('click', e => {
  const tab = e.target.closest?.('[data-account-tab]');
  if (tab) return switchAccountTab(tab.dataset.accountTab);
  const action = e.target.closest?.('[data-action]')?.dataset.action;
  if (action === 'close-dialog') e.target.closest('dialog')?.close();
  else if (action === 'reload') location.reload();
  else if (action === 'admin-export') document.getElementById('admin-export')?.click();
});
document.addEventListener('error', e => {
  if (e.target instanceof HTMLImageElement && e.target.hasAttribute('data-hide-on-error')) e.target.style.display = 'none';
}, true);
// Missing or unreachable vehicle photos fall back to the bundled model photo first, then logo if needed.
document.addEventListener('error', e => {
  const img = e.target;
  if (!(img instanceof HTMLImageElement) || !img.hasAttribute('data-vehicle-image')) return;
  if (!img.dataset.fallbackApplied) {
    img.dataset.fallbackApplied = '1';
    const stock = getCarStockPhoto({ make: img.alt || '', model: img.alt || '' });
    if (stock && !img.src.endsWith(stock)) {
      img.src = stock;
      return;
    }
  }
  if (img.dataset.fallbackApplied === '1') {
    img.dataset.fallbackApplied = '2';
    img.classList.add('vehicle-image-fallback');
    img.src = VEHICLE_IMAGE_FALLBACK;
  }
}, true);

const DOC_NAMES = { RC: 'RC', INSURANCE: 'Insurance', PUC: 'PUC' };
const DOC_PROBLEMS = {
  EXPIRES_BEFORE_RETURN: 'expires before the trip ends', EXPIRED: 'has expired', EXPIRY_MISSING: 'has no recorded expiry date',
  UNVERIFIED: 'is an unverified record with no evidence file. Upload the original document', PENDING_REVIEW: 'is awaiting review',
  REJECTED: 'was rejected. Upload a new copy', MISSING: 'has not been uploaded',
};
const STATE_TEXT = {
  UNAVAILABLE: 'Paused: not accepting new bookings',
  APPROVAL_DRAFT: 'Listing incomplete: add the registration number and all eight photos, then submit for review',
  APPROVAL_PENDING_APPROVAL: 'Awaiting administrator review',
  APPROVAL_REJECTED: 'Rejected: fix the issues noted and resubmit',
  RESTRICTED_ADMIN_SUSPENDED: 'Suspended by Safar: only an administrator can lift this',
  RESTRICTED_MAINTENANCE: 'In maintenance: only an administrator can lift this',
  RESTRICTED_REVIEW_REQUIRED: 'Held for Safar review: only an administrator can lift this',
};
// Mirrors ADMINISTRATIVE_RESTRICTIONS on the server, which enforces it.
const ADMIN_RESTRICTIONS = ['ADMIN_SUSPENDED', 'MAINTENANCE', 'REVIEW_REQUIRED'];
const AVAILABILITY_REASON_TEXT = { OWNER_PAUSED: 'paused by the owner', ADMIN_SUSPENDED: 'suspended by an administrator', MAINTENANCE: 'in maintenance', REVIEW_REQUIRED: 'held until reviewed' };
function eligibilityText(reason) {
  if (STATE_TEXT[reason]) return STATE_TEXT[reason];
  const [kind, ...rest] = String(reason).split('_');
  const problem = DOC_PROBLEMS[rest.join('_')];
  return DOC_NAMES[kind] && problem ? `${DOC_NAMES[kind]} ${problem}` : String(reason).replaceAll('_', ' ');
}
const eligibilityList = reasons => reasons?.length
  ? `<ul class="eligibility-reasons" data-testid="eligibility-reasons">${reasons.map(r => `<li>${esc(eligibilityText(r))}</li>`).join('')}</ul>` : '';
// Compact status chips: a coloured dot plus a short label (approval, then availability with its reason).
const APPROVAL_CHIP = { DRAFT: ['Draft', 'muted'], PENDING_APPROVAL: ['Pending approval', 'warn'], APPROVED: ['Approved', 'good'], REJECTED: ['Rejected', 'bad'] };
const stateChip = (label, tone, title = label) => `<span class="state-chip state-${tone}" title="${esc(title)}"><i aria-hidden="true"></i>${esc(label)}</span>`;
const vehicleStateBadges = v => {
  const [approval, tone] = APPROVAL_CHIP[v.approvalStatus] || [String(v.approvalStatus || 'Draft'), 'muted'];
  const active = v.availability === 'ACTIVE';
  const reason = !active && v.availabilityReason ? AVAILABILITY_REASON_TEXT[v.availabilityReason] || v.availabilityReason : '';
  return `<span class="vehicle-state" data-testid="vehicle-state">${stateChip(approval, tone)}${stateChip(active ? 'Active' : 'Inactive' + (reason ? ' · ' + reason : ''), active ? 'good' : 'muted')}</span>`;
};
// Demo seed and provider-test records never count as verification.
// Local demo mode (server DEMO_VERIFICATION, never in production): labelled demo records count, and are shown as demo.
const demoCounted = d => Boolean(user?.demoVerification) && d.source === 'DEMO_SEED';
const unverifiedDocument = d => ['DEMO_SEED', 'DIGILOCKER_TEST'].includes(d.source) && !demoCounted(d);
const sourceCell = (d, fallback) => demoCounted(d) ? '<span class="badge warn">Demo record (local demo mode)</span>'
  : unverifiedDocument(d) ? '<span class="badge warn">Unverified demo/test record</span>' : esc(fallback);
// One icon per compliance document. A green check only for an approved, evidenced, genuine and unexpired document;
// approved-but-unverified (demo/test or no evidence file) and expired documents show a warning, never a check.
const DOC_ICON = {
  ok: '<path d="M3.5 8.5l3 3 6-7"/>',
  warn: '<path d="M8 2.5l6 11H2z"/><path d="M8 6.5v3.2M8 11.7v.1"/>',
  pending: '<circle cx="8" cy="8" r="5.5"/><path d="M8 5v3.2l2 1.3"/>',
  bad: '<path d="M4.5 4.5l7 7M11.5 4.5l-7 7"/>',
};
/* Audit log presentation. Everything is escaped; unknown actions and fields fall back to a humanised code. */
const humanize = code => String(code ?? '').replace(/([a-z])([A-Z])/g, '$1 $2').replaceAll('_', ' ').toLowerCase().replace(/^\w/, c => c.toUpperCase()).replace(/ ([a-z])$/, (m, c) => ' ' + c.toUpperCase());
const AUDIT_EVENTS = {
  VEHICLE_SUBMITTED: ['Listing submitted for review', 'info'], VEHICLE_APPROVED: ['Listing approved', 'good'], VEHICLE_REJECTED: ['Listing rejected', 'bad'],
  VEHICLE_APPROVAL_REVOKED: ['Approval revoked', 'bad'], VEHICLE_AVAILABILITY_CHANGED: ['Availability changed', 'info'], VEHICLE_STATUS_BACKFILLED: ['Status migrated', 'muted'],
  VEHICLE_CREATED_BY_ADMIN: ['Car added by admin', 'info'], VEHICLE_PHOTOS_ADDED: ['Photos added', 'info'], VEHICLE_PRICE_UPDATED: ['Daily rate changed', 'info'],
  VEHICLE_ACTIVE: ['Listing activated (legacy)', 'good'], VEHICLE_INACTIVE: ['Listing deactivated (legacy)', 'muted'],
  DOCUMENT_APPROVED: ['Document approved', 'good'], DOCUMENT_REJECTED: ['Document rejected', 'bad'], DOCUMENT_VIEWED: ['Document evidence viewed', 'muted'],
  DOCUMENT_CONSENT: ['Document consent given', 'muted'], DOCUMENT_RELABELLED_DEMO: ['Marked as unverified demo record', 'warn'],
  USER_VERIFICATION_RECOMPUTED: ['Customer verification recalculated', 'warn'], USER_BLOCKED: ['User blocked', 'bad'], USER_UNBLOCKED: ['User unblocked', 'good'],
  BOOKING_CREATED: ['Booking created', 'info'], BOOKING_HOLD: ['Booking hold changed', 'info'], BOOKING_CANCELLED: ['Booking cancelled', 'bad'],
  BOOKING_REVIEW_FLAGGED: ['Booking flagged for review', 'warn'], BOOKING_AGREEMENT_ACKNOWLEDGED: ['Rental agreement accepted', 'info'], HOLD_EXPIRED: ['Payment hold expired', 'muted'],
  BOOKINGS_EXPORTED: ['Bookings exported (CSV)', 'muted'], PAYMENT_RECORDED: ['Payment recorded', 'good'], REFUND_RECORDED: ['Refund recorded', 'info'],
  INSPECTION_PICKUP: ['Pickup inspection', 'info'], INSPECTION_RETURN: ['Return inspection', 'info'], DAMAGE_REPORTED: ['Damage reported', 'bad'],
  AVAILABILITY_BLOCKED: ['Dates blocked', 'muted'], AVAILABILITY_RELEASED: ['Dates reopened', 'muted'], HOST_AGREEMENT_ACKNOWLEDGED: ['Host agreement accepted', 'info'],
  PAYOUT_CREATED: ['Payout created', 'info'], PAYOUT_PROCESSING: ['Payout processing', 'info'], PAYOUT_PAID: ['Payout paid', 'good'], PAYOUT_FAILED: ['Payout failed', 'bad'],
  PAYOUT_CANCELLED: ['Payout cancelled', 'muted'], PAYOUT_RECONCILED: ['Payout reconciled', 'info'], PAYOUT_SNAPSHOT_CREATED: ['Payout destination recorded', 'muted'],
  PAYOUT_BLOCKED_UNVERIFIED_DESTINATION: ['Payout blocked: account not verified', 'bad'], PAYOUT_ACCOUNT_CHANGE_INITIATED: ['Bank details changed', 'warn'],
  PAYOUT_ACCOUNT_VERIFIED: ['Bank account verified', 'good'], PAYOUT_ACCOUNT_VERIFICATION_INVALIDATED: ['Bank verification invalidated', 'warn'],
  PAYOUT_ACCOUNT_RESUBMITTED_UNCHANGED: ['Bank details resubmitted', 'muted'], PAYOUT_ACCOUNT_SELF_APPROVAL_REJECTED: ['Self-approval refused', 'bad'],
};
const AUDIT_FIELDS = {
  previousStatus: 'Previous status', approvalStatus: 'Approval', availability: 'Availability', availabilityReason: 'Availability reason',
  approvedById: 'Approved by', approvedAt: 'Approved at', migration: 'Migration', previousSource: 'Previous source', previousReviewNote: 'Previous note',
  remediation: 'Remediation', isVerified: 'Verified', dlValidUntil: 'DL valid until', reason: 'Reason', from: 'From', to: 'To', note: 'Note',
  previousReason: 'Previous reason', capacity: 'Acting as', previousAvailability: 'Previous availability', previousAvailabilityReason: 'Previous reason',
  documentKind: 'Document', documentId: 'Document id', vehicleId: 'Car', bookingStatus: 'Booking status', startDate: 'Trip start', automatic: 'Automatic',
};
const ISO_DATE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/;
const auditValue = (key, value) => {
  if (value === null || value === undefined || value === '') return '<span class="text-muted">–</span>';
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  if (typeof value === 'string' && ISO_DATE.test(value)) return esc(dt(value));
  if (typeof value === 'string' && /Id$/.test(key)) return `<code title="${esc(value)}">${esc(value.slice(0, 8))}…</code>`;
  if (typeof value === 'string' && /^[A-Z][A-Z0-9_]+$/.test(value)) return esc(humanize(value));
  return esc(typeof value === 'object' ? JSON.stringify(value) : String(value));
};
const auditDetail = raw => {
  let parsed;
  try { parsed = JSON.parse(raw); } catch { parsed = null; }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return raw ? `<span>${esc(/^[A-Z][A-Z0-9_]+$/.test(raw) ? humanize(raw) : raw)}</span>` : '<span class="text-muted">–</span>';
  // Flatten one level of nesting, e.g. { previous: { isVerified } } -> "Previous · Verified".
  const rows = Object.entries(parsed).flatMap(([k, v]) => v && typeof v === 'object' && !Array.isArray(v)
    ? Object.entries(v).map(([k2, v2]) => [`${AUDIT_FIELDS[k] || humanize(k)} · ${AUDIT_FIELDS[k2] || humanize(k2)}`, k2, v2])
    : [[AUDIT_FIELDS[k] || humanize(k), k, v]]);
  return `<dl class="audit-fields">${rows.map(([label, key, value]) => `<dt>${esc(label)}</dt><dd>${auditValue(key, value)}</dd>`).join('')}</dl>`;
};
const auditEvent = action => {
  const [label, tone] = AUDIT_EVENTS[action] || [humanize(action), 'muted'];
  return `<span class="audit-event-label audit-${tone}">${esc(label)}</span><code class="audit-code">${esc(action)}</code>`;
};
const auditActor = actorId => {
  if (actorId === 'SYSTEM') return '<span class="audit-system">System</span>';
  const u = adminData?.users?.find(x => x.id === actorId);
  return u ? `<strong>${esc(u.firstName + ' ' + u.lastName)}</strong><small>${esc(u.email)}</small>` : `<code title="${esc(actorId)}">${esc(String(actorId).slice(0, 8))}…</code>`;
};
const auditTarget = targetId => {
  const v = adminData?.vehicles?.find(x => x.id === targetId);
  if (v) return `<strong>${esc(v.make + ' ' + v.model)}</strong><small>${esc(v.registrationNumber || 'Car')}</small>`;
  const d = adminData?.documents?.find(x => x.id === targetId);
  if (d) return `<strong>${esc(DOC_NAMES[d.kind] || humanize(d.kind))}</strong><small>${esc(d.user ? d.user.firstName + ' ' + d.user.lastName : 'Document')}</small>`;
  const b = adminData?.bookings?.find(x => x.id === targetId);
  if (b) return `<strong>Booking ${esc(b.bookingRef)}</strong><small>${esc(b.vehicle ? b.vehicle.make + ' ' + b.vehicle.model : '')}</small>`;
  const u = adminData?.users?.find(x => x.id === targetId);
  if (u) return `<strong>${esc(u.firstName + ' ' + u.lastName)}</strong><small>User</small>`;
  return targetId ? `<code title="${esc(targetId)}">${esc(String(targetId).slice(0, 12))}${String(targetId).length > 12 ? '…' : ''}</code>` : '<span class="text-muted">–</span>';
};
// What a compliance document really counts as. A record marked APPROVED without an evidence file, or from demo/test
// data, does NOT count, so it must never be shown as a plain green "Approved".
const docStanding = d => {
  const expired = d.validUntil && new Date(d.validUntil) < new Date();
  return d.status === 'REJECTED' ? ['bad', 'Rejected', 'Rejected']
    : d.status !== 'APPROVED' ? ['pending', 'Awaiting review', 'Pending review']
    // Vehicle documents need an uploaded file; personal KYC from DigiLocker is verified without one.
    : demoCounted(d) ? (expired ? ['warn', 'Expired', 'Expired'] : ['ok', 'Demo record: counts in local demo mode only', 'Demo verified'])
    : unverifiedDocument(d) || (d.vehicleId && !d.mediaId) ? ['warn', unverifiedDocument(d) ? 'Demo/test record: does not count as verified' : 'Approved record, unverified: no evidence file', 'Not verified']
    : expired ? ['warn', 'Expired', 'Expired'] : ['ok', 'Approved and verified', 'Verified'];
};
const DOC_STANDING_BADGE = { ok: 'good', warn: 'warn', bad: 'red', pending: 'warn' };
const docStatusBadge = d => {
  const [tone, detail, short] = docStanding(d);
  return `<span class="badge ${DOC_STANDING_BADGE[tone]}" title="${esc(detail)}" data-testid="doc-status">${esc(short)}</span>`;
};
const docChip = d => {
  const name = DOC_NAMES[d.kind] || d.kind;
  const [tone, status] = docStanding(d);
  const label = `${name}: ${status}${d.validUntil ? ' (valid until ' + new Date(d.validUntil).toLocaleDateString('en-IN') + ')' : ''}`;
  return `<span class="doc-chip doc-${tone}" title="${esc(label)}" aria-label="${esc(label)}"><svg viewBox="0 0 16 16" aria-hidden="true">${DOC_ICON[tone]}</svg>${esc(name)}</span>`;
};
// One blocking reason per line (forms show errors with white-space: pre-line).
const errorWithReasons = err => err.message + (err.reasons?.length ? ':\n' + err.reasons.map(r => '• ' + eligibilityText(r)).join('\n') : '');

const ADMIN_SECTIONS = ['dashboard', 'approvals', 'vehicles', 'documents', 'bookings', 'disputes', 'users', 'payouts', 'pricing', 'reports', 'audit'];
let currentAdminTab = 'dashboard';
const adminSectionFromUrl = () => { const t = new URLSearchParams(location.search).get('tab'); return ADMIN_SECTIONS.includes(t) ? t : 'dashboard'; };
// Section counts in the header badges (filled once the admin data has loaded).
function updateAdminCounts() { $$('[data-admin-count]').forEach(el => { el.textContent = adminData?.[el.dataset.adminCount]?.length ?? ''; }); }

/* Customer account sections, shown as the header menu for customers. */
const CUSTOMER_SECTIONS = [['trips', 'My Trips'], ['kyc', 'Verification'], ['profile', 'Profile']];
const CUSTOMER_SECTION_HEADS = {
  trips: ['My Trips', 'Your bookings, receipts and rental agreements.'],
  kyc: ['Verification', 'Your Aadhaar and driving licence checks. Both are needed before you can book.'],
  profile: ['Profile', 'Your account details.'],
  disputes: ['Booking Disputes', 'Raise and follow up issues with a booking or refund.'],
  history: ['Trip & Damage History', 'Your completed trips and any recorded damage.'],
  reviews: ['Reviews & Ratings', 'Reviews you have written and ratings you have received.'],
  saved: ['Saved Vehicles & Alerts', 'Cars you saved and your notifications.'],
};
// The account section on this page ('' elsewhere). kyc.html is the verification page.
const customerSectionFromPage = () => page === 'kyc.html' ? 'kyc'
  : page === 'dashboard.html' || page === 'payment.html' ? (Object.hasOwn(CUSTOMER_SECTION_HEADS, new URLSearchParams(location.search).get('tab') || '') ? new URLSearchParams(location.search).get('tab') : 'trips') : '';
const syncCustomerMenu = () => { $$('[data-account-link]').forEach(a => a.classList.toggle('active', a.dataset.accountLink === customerSectionFromPage())); };

/* ─── HEADER / SHELL (WITH MOBILE BOTTOM NAVIGATION) ─────────────────── */
const PREVIEW_MODE = ['localhost', '127.0.0.1'].includes(location.hostname);
const PREVIEW_CARS = [
  ['Hyundai', 'Creta', 2024, 'SUV', 'Automatic', 'Petrol', 5, 3200, 'Ahmedabad', 'creta'],
  ['Maruti Suzuki', 'Swift', 2023, 'Hatchback', 'Manual', 'Petrol', 5, 1800, 'Vadodara', 'swift'],
  ['Mahindra', 'Thar 4x4', 2024, 'SUV', 'Manual', 'Diesel', 4, 4500, 'Ahmedabad', 'thar'],
  ['Toyota', 'Innova Crysta', 2023, 'MUV', 'Manual', 'Diesel', 7, 3800, 'Surat', 'innova'],
  ['Honda', 'City', 2023, 'Sedan', 'Automatic', 'Petrol', 5, 2600, 'Ahmedabad', 'city'],
  ['Toyota', 'Fortuner', 2024, 'SUV', 'Automatic', 'Diesel', 7, 7500, 'Gandhinagar', 'fortuner'],
  ['Maruti Suzuki', 'Dzire', 2023, 'Sedan', 'Manual', 'CNG', 5, 1700, 'Rajkot', 'dzire'],
  ['Hyundai', 'i20', 2023, 'Hatchback', 'Automatic', 'Petrol', 5, 2000, 'Surat', 'i20'],
  ['Mercedes-Benz', 'C-Class', 2023, 'Luxury', 'Automatic', 'Petrol', 5, 8500, 'Ahmedabad', 'mercedes'],
].map(([make, model, year, category, transmission, fuelType, seats, pricePerDay, locationCity, image]) =>
  ({ id: 'preview-' + image, preview: true, make, model, year, category, transmission, fuelType, seats, pricePerDay, locationCity, image: 'cars/' + image + '.jpg' }));

function previewCard(car) {
  const specs = [car.transmission, car.fuelType, car.seats + ' Seats', car.year].join(' · ');
  return `
    <div class="car-card is-preview" data-testid="preview-car" aria-label="${esc(car.make + ' ' + car.model)}: preview sample, not bookable">
      <div class="car-card-media">
        <img ${vehicleImageSlot(car.image)} alt="${esc(car.make + ' ' + car.model)}" loading="lazy">
        <span class="car-card-badge preview-badge">Preview · Sample</span>
      </div>
      <div class="car-card-info">
        <div class="car-card-name">${esc(car.make + ' ' + car.model + ' ' + car.year)}</div>
        <div class="car-card-specs">${esc(specs)}</div>
        <div class="car-card-badges"><span class="cc-badge cc-badge-gray">${esc(car.category.toUpperCase())}</span></div>
        <div class="car-card-dist">
          <svg width="11" height="11" viewBox="0 0 24 24" fill="var(--orange)"><polygon points="3 11 22 2 13 21 11 13 3 11"/></svg>
          <span>${esc(car.locationCity)}</span>
        </div>
        <div class="car-card-footer">
          <div class="car-card-price-row">
            <div>
              <div class="car-card-price">${money(car.pricePerDay)}<small>/day</small></div>
              <div class="car-card-daily">Sample price</div>
            </div>
            <span class="btn-book btn-book-disabled" aria-disabled="true">Not bookable</span>
          </div>
        </div>
      </div>
    </div>`;
}

const PICKUP_CITIES = ['Ahmedabad', 'Surat', 'Vadodara', 'Rajkot', 'Gandhinagar'];

const VEHICLE_DOCUMENT_KINDS = ['RC', 'INSURANCE', 'PUC'];
const DOCUMENT_UPLOAD_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const DOCUMENT_UPLOAD_MAX_BYTES = 8 * 1024 * 1024;

const HOST_SECTIONS = [['fleet', 'My Fleet'], ['add', 'Add Car'], ['documents', 'Car Documents'], ['bookings', 'Bookings'], ['payouts', 'Payouts']];
const HOST_SECTION_IDS = HOST_SECTIONS.map(([id]) => id);
const hostSectionFromUrl = () => { const t = new URLSearchParams(location.search).get('tab'); return HOST_SECTION_IDS.includes(t) ? t : 'fleet'; };
const HOST_SECTION_HEADS = {
  fleet: ['My Fleet', 'Your cars, their approval status and whether they are accepting bookings.'],
  add: ['Add a Car', 'Register a car with its details and eight photos. You upload its RC, Insurance and PUC next.'],
  documents: ['Car Documents', 'RC, Insurance and PUC for each of your cars. A car can be approved only when all three are verified.'],
  bookings: ['Bookings on Your Cars', 'Reservations and trips customers have booked on your cars.'],
  payouts: ['Payouts', 'The bank account Safar pays your settlements into.'],
};

// One card per car on the Car Documents page: each required document with its real standing and an upload action.
function carDocumentsCard(v) {
  const rows = VEHICLE_DOCUMENT_KINDS.map(kind => {
    const docs = (v.documents || []).filter(x => x.kind === kind).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    // The record that matters: a verified one if any, otherwise the newest.
    const current = docs.find(x => docStanding(x)[0] === 'ok') || docs[0];
    const tone = current ? docStanding(current)[0] : 'missing';
    // A newer upload (for example a renewal) still waiting for review is mentioned even when an older one is verified.
    const pendingNewer = docs.find(x => x !== current && x.status === 'PENDING' && new Date(x.createdAt) > new Date(current?.createdAt || 0));
    const uploadLabel = !current || unverifiedDocument(current) || !current.mediaId ? 'Upload' : tone === 'ok' ? 'Upload renewal' : 'Replace';
    return `
      <tr data-kind="${kind}">
        <td><strong>${esc(DOC_NAMES[kind])}</strong></td>
        <td>${current ? docStatusBadge(current) : '<span class="badge warn" data-testid="doc-status">Not uploaded</span>'}</td>
        <td>${current?.validUntil && (current.mediaId || demoCounted(current)) && !unverifiedDocument(current) ? d(current.validUntil) : '—'}</td>
        <td class="text-muted">${esc(current ? (unverifiedDocument(current) ? 'Demo record with no file. Upload the original document.' : current.reviewNote || 'Waiting for a Safar administrator to review it.') : 'Not uploaded yet.')}${pendingNewer ? '<br><strong class="doc-pending-newer">A newer upload is waiting for review.</strong>' : ''}</td>
        <td class="car-doc-actions">
          ${current?.mediaId ? `<button type="button" class="button btn-ghost btn-sm car-doc-view" data-id="${esc(current.id)}" data-kind="${kind}">View</button>` : ''}
          <button type="button" class="button ${tone === 'ok' ? 'btn-outline' : 'btn-orange'} btn-sm car-doc-upload" data-vehicle="${esc(v.id)}" data-kind="${kind}">${uploadLabel}</button>
        </td>
      </tr>`;
  });
  const verified = VEHICLE_DOCUMENT_KINDS.filter(kind => (v.documents || []).some(x => x.kind === kind && docStanding(x)[0] === 'ok')).length;
  return `
    <article class="panel car-docs-card" id="car-docs-${esc(v.id)}" data-vehicle="${esc(v.id)}">
      <div class="car-docs-head">
        <img loading="lazy" ${vehicleImageSlot(vehicleCoverUrl(v))} alt="${esc(v.make + ' ' + v.model)}">
        <div>
          <h3>${esc(v.make + ' ' + v.model + ' ' + v.year)}</h3>
          <p class="text-muted">${esc(v.registrationNumber || 'Registration pending')} · ${esc(v.locationCity)}</p>
        </div>
        <div class="car-docs-summary">${stateChip(...(APPROVAL_CHIP[v.approvalStatus] || ['Draft', 'muted']))}<span class="${verified === 3 ? 'docs-complete' : 'docs-incomplete'}">${verified} of 3 verified</span></div>
      </div>
      <div class="table-wrap"><table class="car-docs-table">
        <thead><tr><th>Document</th><th>Status</th><th>Valid until</th><th>Notes</th><th></th></tr></thead>
        <tbody>${rows.join('')}</tbody>
      </table></div>
    </article>`;
}

// Upload one document for one car (owner).
function openCarDocumentUpload(vehicle, kind) {
  showDialog(`
    <h3>Upload ${esc(DOC_NAMES[kind])}</h3>
    <p class="text-muted">${esc(vehicle.make + ' ' + vehicle.model)} · ${esc(vehicle.registrationNumber || '')}</p>
    <form id="car-doc-upload-form" class="form-stack">
      <label>Document image (JPG, PNG or WebP, up to 8 MB)
        <input type="file" name="file" accept="image/jpeg,image/png,image/webp" required>
      </label>
      <label class="check">
        <input type="checkbox" name="consent" required>
        <span>I certify this document is genuine and consent to storage for rental verification.</span>
      </label>
      <button type="submit" class="button btn-orange">Submit ${esc(DOC_NAMES[kind])} for review</button>
    </form>`);
  bindForm('#car-doc-upload-form', async (data, form) => {
    const file = form.file.files[0];
    if (file && !DOCUMENT_UPLOAD_TYPES.includes(file.type)) throw new Error('Upload a JPEG, PNG or WebP image.');
    if (file && file.size > DOCUMENT_UPLOAD_MAX_BYTES) throw new Error('The image must be 8 MB or smaller.');
    const media = await uploadFile(file, kind);
    await post('/kyc/documents', { kind, mediaId: media.id, vehicleId: vehicle.id, consent: true });
    $('dialog').close();
    toast(`${DOC_NAMES[kind]} submitted for verification review.`);
    await host('documents', vehicle.id);
  });
}

function openOwnDocument(id, kind) {
  showDialog(`
    <h3>${esc(DOC_NAMES[kind] || kind)} document</h3>
    <div id="own-doc-view-box" style="padding:16px;background:var(--line-soft);border-radius:var(--r);margin-top:12px;text-align:center">Loading document…</div>`);
  renderOriginalEvidence($('#own-doc-view-box'), '/kyc/documents/' + encodeURIComponent(id) + '/evidence', DOC_NAMES[kind] || kind);
}

// Shows one owner section in place and keeps the header menu and address in sync.
function showHostSection(tab, vehicleId) {
  for (const id of HOST_SECTION_IDS) { const el = $('#host-section-' + id); if (el) el.hidden = id !== tab; }
  const [title, sub] = HOST_SECTION_HEADS[tab];
  $('#host-head h2').textContent = title;
  $('#host-head p').textContent = sub;
  $$('#header [data-host-tab]').forEach(a => { const on = a.dataset.hostTab === tab; a.classList.toggle('active', on); if (on) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current'); });
  history.replaceState(null, '', 'host-onboarding.html?tab=' + tab + (vehicleId ? '&vehicle=' + encodeURIComponent(vehicleId) : ''));
  if (tab === 'documents' && vehicleId) {
    const card = $('#car-docs-' + CSS.escape(vehicleId));
    if (card) { card.classList.add('is-focused'); card.scrollIntoView({ block: 'start', behavior: 'smooth' }); }
  } else window.scrollTo(0, 0);
}

async function openDocumentReview(docId, afterSave = () => adminPage('documents')) {
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
    await post('/admin/documents/' + (reviewDocumentId || docId) + '/review', {
      ...data,
      identityChecked: data.identityChecked === 'on',
    });
    $('dialog').close();
    toast('Document decision saved.');
    await afterSave();
  });
  await renderOriginalEvidence($('#evidence-viewer-box'), '/admin/documents/' + encodeURIComponent(docId) + '/evidence', 'Original document', evidence => {
    reviewDocumentId = evidence?.documentId || null;
    opened = false;
    reviewForm.elements.identityChecked.checked = false;
    updateApproval();
  }, () => { opened = true; updateApproval(); });
}

function shell() {
  // Menus follow the account's role. Guests see the marketing links; customers their renting tasks; owners (hosts and
  // dealers) their fleet tasks plus Account; administrators the admin sections with live counts.
  const isPartner = ['HOST', 'DEALER'].includes(user?.role);
  const isAdmin = user?.role === 'ADMIN';
  const links = !user ? [
      ['cars.html', 'Explore Cars'],
      ['index.html#how-it-works', 'How It Works'],
      ['host-onboarding.html', 'Become a Host'],
      ['index.html#support', 'Help & Support'],
    ]
    : isAdmin ? ADMIN_SECTIONS.map(t => ['admin.html?tab=' + t, t[0].toUpperCase() + t.slice(1), t])
    : isPartner ? [...HOST_SECTIONS.map(([t, label]) => ['host-onboarding.html?tab=' + t, label, null, t]), ['dashboard.html', 'Account']]
    : [['cars.html', 'Explore Cars'], ...CUSTOMER_SECTIONS.map(([t, label]) => ['dashboard.html?tab=' + t, label, null, null, t])];
  const city = getCity();
  const cityOptions = ['', ...DEFAULT_CITIES].map(c => `<option value="${esc(c)}" ${c === city ? 'selected' : ''}>${c ? esc(c) : 'All Cities'}</option>`).join('');
  const isActive = ([href, , section, hostTab, accountTab]) => accountTab ? customerSectionFromPage() === accountTab
    : section ? page === 'admin.html' && adminSectionFromUrl() === section
    : hostTab ? page === 'host-onboarding.html' && hostSectionFromUrl() === hostTab
    : (page === href.split('#')[0] && !href.includes('#')) || (href === 'dashboard.html' && page === 'kyc.html');
  const navLink = link => {
    const [href, label, section, hostTab, accountTab] = link;
    const attrs = accountTab ? ` data-account-link="${accountTab}"` : section ? ` data-tab="${section}"` : hostTab ? ` data-host-tab="${hostTab}"` : '';
    return `<a href="${href}"${attrs} class="${isActive(link) ? 'active' : ''}">${label}${section ? `<span class="nav-count" data-admin-count="${section}"></span>` : ''}</a>`;
  };
  // Account menu: the sections that are not already in the header for this role.
  const menuItems = !user ? [] : [
    ...(isAdmin ? [] : [['dashboard.html?tab=trips', 'calendar', 'My Bookings']]),
    ...(isAdmin || isPartner ? [['dashboard.html?tab=kyc', 'idcard', 'KYC &amp; Verification']] : []),
    ['dashboard.html?tab=disputes', 'scale', 'Booking Disputes'],
    ['dashboard.html?tab=history', 'history', 'Trip &amp; Damage History'],
    ...(isAdmin || isPartner ? [] : [['dashboard.html?tab=reviews', 'star', 'Reviews &amp; Ratings'], ['dashboard.html?tab=saved', 'bell', 'Saved Vehicles &amp; Alerts']]),
    ...(isAdmin || isPartner ? [['dashboard.html?tab=profile', 'user', 'Account Information']] : []),
    ...(isPartner ? [['host-onboarding.html?tab=fleet', 'car', 'Owner Panel']] : []),
    ...(isAdmin ? [['admin.html?tab=dashboard', 'layers', 'Admin Panel']] : []),
  ].filter(([href]) => !links.some(([h]) => h === href));

  $('#header').innerHTML = `
    <a href="index.html" aria-label="Safar Self Drive Home" style="text-decoration:none">${brandLockup()}</a>
    <nav class="ds-nav nav${isAdmin ? ' admin-nav' : ''}" aria-label="${isAdmin ? 'Administration sections' : 'Main Navigation'}">
      ${links.map(navLink).join('')}
    </nav>
    <div class="ds-head-right">
      ${isAdmin || isPartner ? '' : `<div class="ds-city" title="Select pickup city">${icon('pin', 'ic-sm')}<select id="ds-city-select" aria-label="Select pickup city">${cityOptions}</select></div>`}
      ${user ? `
        <details class="ds-user-menu">
          <summary aria-label="Account menu"><span class="ds-avatar">${esc(initials(user))}</span><span class="ds-hide-m user-pill">Hi, ${esc(user.firstName)}</span></summary>
          <div class="ds-menu-pop" role="menu">
            ${menuItems.map(([href, ic, label]) => `<a href="${href}" role="menuitem">${icon(ic)} ${label}</a>`).join('')}
            <hr>
            <button type="button" id="logout-btn" role="menuitem">${icon('logout')} Sign out</button>
          </div>
        </details>`
      : `<a class="button btn-ghost btn-sm ds-hide-m" href="auth.html">Log In</a>
         <a class="button btn-orange btn-sm" href="auth.html?tab=register">Sign Up</a>`}
      <button type="button" class="ds-burger btn-sm" id="ds-burger" aria-expanded="false" aria-controls="ds-drawer" aria-label="Open menu">${icon('menu')}</button>
    </div>
    <nav class="ds-drawer" id="ds-drawer" hidden aria-label="Compact navigation">
      ${links.map(link => `<a href="${link[0]}" ${isActive(link) ? 'aria-current="page"' : ''}>${link[1]}</a>`).join('')}
      ${user ? menuItems.map(([href, , label]) => `<a href="${href}">${label}</a>`).join('') : '<a href="auth.html">Log In / Sign Up</a>'}
    </nav>`;

  if (!document.querySelector('.skip-link')) {
    const skip = document.createElement('a');
    skip.className = 'skip-link';
    skip.href = '#app';
    skip.textContent = 'Skip to main content';
    document.body.prepend(skip);
  }
  if (!document.querySelector('.page-progress')) {
    const progress = document.createElement('div');
    progress.className = 'page-progress';
    progress.setAttribute('aria-hidden', 'true');
    document.body.prepend(progress);
    const updateProgress = () => {
      const max = Math.max(1, document.documentElement.scrollHeight - window.innerHeight);
      progress.style.transform = `scaleX(${Math.min(1, Math.max(0, window.scrollY / max))})`;
    };
    window.addEventListener('scroll', updateProgress, { passive: true });
    window.addEventListener('resize', updateProgress, { passive: true });
    updateProgress();
  }

  document.documentElement.dataset.theme = '';
  $('#ds-city-select')?.addEventListener('change', e => {
    setCity(e.target.value);
    if (page === 'cars.html' && !new URLSearchParams(location.search).get('id')) {
      const p = new URLSearchParams(location.search);
      e.target.value ? p.set('city', e.target.value) : p.delete('city');
      location.search = p.toString();
    } else if (page === 'index.html' || page === '') home();
  });
  $('#ds-burger')?.addEventListener('click', e => {
    const d = $('#ds-drawer'); d.hidden = !d.hidden;
    e.currentTarget.setAttribute('aria-expanded', String(!d.hidden));
  });
  document.addEventListener('click', e => {
    const m = $('.ds-user-menu');
    if (m?.open && !m.contains(e.target)) m.open = false;
  });
  $('#logout-btn')?.addEventListener('click', async () => {
    localStorage.removeItem('safar_token');
    await post('/auth/logout', {}).catch(() => {});
    location.href = 'auth.html';
  });

  // Mobile bottom bar. Guests: Home + Login. Customers: Cars, My Trips, Verification, Profile. Owners: their fleet tasks + Account.
  // Administrators use the menu button (their admin sections) instead.
  if (!$('#mobile-bnav') && !isAdmin) {
    const hostTab = page === 'host-onboarding.html' ? hostSectionFromUrl() : '';
    const onAccount = page === 'dashboard.html' || page === 'kyc.html';
    const items = !user
      ? [['index.html', 'Home', 'home', page === 'index.html' || page === ''], ['auth.html', 'Login', 'user', page === 'auth.html']]
      : isPartner
        ? [['host-onboarding.html?tab=fleet', 'My Fleet', 'car', hostTab === 'fleet' || hostTab === 'add'],
           ['host-onboarding.html?tab=documents', 'Documents', 'file', hostTab === 'documents'],
           ['host-onboarding.html?tab=bookings', 'Bookings', 'calendar', hostTab === 'bookings' || hostTab === 'payouts'],
           ['dashboard.html', 'Account', 'user', onAccount]]
        : [['cars.html', 'Cars', 'car', page === 'cars.html'], ['dashboard.html?tab=trips', 'My Trips', 'calendar', customerSectionFromPage() === 'trips'],
           ['dashboard.html?tab=kyc', 'Verification', 'idcard', customerSectionFromPage() === 'kyc'], ['dashboard.html?tab=profile', 'Profile', 'user', customerSectionFromPage() === 'profile']];
    const bnav = document.createElement('nav');
    bnav.id = 'mobile-bnav';
    bnav.className = 'mobile-bnav';
    bnav.setAttribute('aria-label', 'Mobile Navigation');
    bnav.innerHTML = items.map(([href, label, ic, active]) => `
      <a class="bnav-item ${active ? 'active' : ''}" href="${href}">${icon(ic)}<span>${label}</span></a>`).join('');
    document.body.appendChild(bnav);
  }

  renderFooter();
}

// Footer contact details come from the server's BUSINESS_* settings (GET /api/contact); nothing is shown when unset.
function renderFooter() {
  const footer = $('footer.footer');
  if (!footer) return;
  const contact = [
    COMPANY.phone ? `<a href="tel:${esc(COMPANY.phoneHref)}">${esc(COMPANY.phone)}</a>` : '',
    COMPANY.email ? `<a href="mailto:${esc(COMPANY.email)}">${esc(COMPANY.email)}</a>` : '',
    COMPANY.address ? `<p style="margin:4px 0 0;font-size:12.5px">${esc(COMPANY.address)}</p>` : '',
  ].join('') || '<a href="contact.html">Contact Us</a>';
  footer.innerHTML = `
    <div class="ds-foot-grid">
      <div class="ds-foot-brand">
        ${brandLockup(true)}
        <p style="margin-top:14px;max-width:320px">Verified self-drive car rentals with transparent pricing, documented vehicle handovers, and digital lease agreements.</p>
      </div>
      <div><h4>Book &amp; Drive</h4><a href="cars.html">Explore Cars</a><a href="index.html#how-it-works">How It Works</a><a href="index.html#faq">Frequently Asked Questions</a></div>
      <div><h4>Company &amp; Hosts</h4><a href="about.html">About Safar</a><a href="host-onboarding.html">List Your Car</a><a href="services.html">Mobility Services</a><a href="contact.html">Contact Us</a></div>
      <div><h4>Customer Support</h4>${contact}</div>
    </div>
    <div class="ds-foot-bottom">
      <span>© ${new Date().getFullYear()} ${esc(COMPANY.name)}. All rights reserved.</span>
      <span><a href="index.html#policies" style="color:inherit">Terms &amp; Conditions</a> · <a href="index.html#policies" style="color:inherit">Privacy Policy</a> · <a href="index.html#policies" style="color:inherit">Cancellation &amp; Refund Policy</a></span>
    </div>`;
}

/* ─── VEHICLE CARD (CLEAN MARKETPLACE DESIGN — REAL DATA ONLY) ───────── */
function carCard(car) {
  const specs = [car.transmission, car.fuelType, car.seats + ' Seats', car.year].filter(Boolean).join(' · ');
  const rating = ratingSummary(car);
  const hasRating = rating.count > 0;
  const numRating = hasRating ? Number(rating.value) : 0;
  const perDay = Number(car.pricePerDay || 0);
  const kmDay = Number(car.includedKilometresPerDay || 300);
  const extraKm = Number(car.extraKmCharge || 12);
  const pickup = car.currentHub?.hubName || car.pickupAddress || car.locationCity || 'Ahmedabad';
  const verified = car.status === 'ACTIVE';
  const params = new URLSearchParams(location.search);
  const hasDates = params.has('startDate') && params.has('endDate');
  const title = `${car.make || ''} ${car.model || ''}`.trim();
  const hashNum = (car.id || '1').split('').reduce((a, c) => a + c.charCodeAt(0), 0);

  return `
    <a class="vcard car-card" href="${esc(carLink(car.id))}"
       data-category="${esc((car.category || '').toLowerCase())}"
       data-transmission="${esc((car.transmission || '').toLowerCase())}"
       data-rating="${hasRating ? numRating : 4.5}"
       data-year="${Number(car.year) || 2024}">
      <div class="vcard-media">
        <img src="${photoUrl(car)}" alt="${esc(title)}" loading="lazy" data-vehicle-image>
        ${verified ? `<span class="vcard-tag">${icon('shield', 'ic-sm')} Verified Listing</span>` : ''}
      </div>
      <div class="vcard-body">
        <div class="vcard-title">
          <div>
            <h3 class="car-card-name">${esc(title)}</h3>
            <div class="sub">${esc([car.year, car.category].filter(Boolean).join(' · '))}</div>
          </div>
          ${hasRating
            ? `<span class="vcard-rating" title="${rating.count} verified customer review(s)">${icon('star')} ${rating.value} <span style="color:var(--ink-2);font-weight:500">(${rating.count})</span></span>`
            : `<span class="vcard-rating new">New listing</span>`}
        </div>
        <div class="car-card-specs" style="display:none">${esc(specs)}</div>
        <div class="vcard-specs">
          ${car.transmission ? `<span>${icon('transmission', 'ic-sm')} ${esc(car.transmission)}</span>` : ''}
          ${car.fuelType ? `<span>${icon('fuel', 'ic-sm')} ${esc(car.fuelType)}</span>` : ''}
          ${car.seats ? `<span>${icon('users', 'ic-sm')} ${Number(car.seats)} Seats</span>` : ''}
        </div>
        <div class="vcard-meta">${icon('pin', 'ic-sm')} <span>${esc(pickup)}</span></div>
        ${hasDates ? `<div class="vcard-meta" style="color:var(--ok)">${icon('checkCircle', 'ic-sm')} <span>Available for selected dates</span></div>` : ''}
        <div class="vcard-foot">
          <div>
            <div class="vcard-price">${money(perDay)}<small> / day</small></div>
            <div class="vcard-price-note">${kmDay} km/day incl. · ${money(extraKm)}/km extra</div>
          </div>
          <span class="button btn-orange">View Details</span>
        </div>
      </div>
    </a>`;
}

/* ─── LANDING PAGE (10-SECTION PREMIUM AUTOMOTIVE REDESIGN) ─────────── */
async function home() {
  const pad = n => String(n).padStart(2, '0');
  const toLocal = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  const start = new Date(); start.setDate(start.getDate() + 1); start.setHours(10, 0, 0, 0);
  const end = new Date(start); end.setDate(end.getDate() + 1);
  const minNow = new Date(Date.now() + 60 * 60000); minNow.setMinutes(0, 0, 0);
  const city = getCity();

  $('#app').innerHTML = `
    <section class="lp-hero" aria-labelledby="lp-title">
      <img class="lp-hero-img" src="https://images.unsplash.com/photo-1533473359331-0135ef1b58bf?auto=format&fit=crop&w=2000&q=85" alt="Self-drive car on open highway" fetchpriority="high">
      <div class="lp-hero-inner">
        <div style="display:grid;gap:14px">
          <span class="eyebrow" style="color:#F5D9A8">SELF-DRIVE CAR RENTALS</span>
          <h1 id="lp-title">Your Next Drive Starts Here.</h1>
          <p>Discover verified self-drive cars, transparent pricing, and convenient bookings for your next trip.</p>
          <div class="lp-hero-ctas">
            <a class="button btn-orange btn-lg" href="cars.html">Explore Cars</a>
            <a class="button btn-outline btn-lg" href="host-onboarding.html">List Your Car</a>
          </div>
          <!-- Filled from the live /vehicles listing; hidden if it cannot be loaded. No fixed marketing numbers. -->
          <div class="hero-stats" id="hero-stats" data-testid="hero-stats" hidden>
            <div class="hero-stat"><div class="hero-stat-num" id="stat-cars" data-testid="stat-cars"></div><div class="hero-stat-lbl">Cars Listed</div></div>
            <div class="hero-stat"><div class="hero-stat-num is-orange" id="stat-cities" data-testid="stat-cities"></div><div class="hero-stat-lbl" id="stat-cities-lbl">Cities</div></div>
          </div>
        </div>
        <form class="lp-search" id="lp-search" novalidate aria-label="Search available cars">
          <label>Pickup Location
            <select name="city" id="lp-city">${['', ...DEFAULT_CITIES].map(c => `<option value="${esc(c)}" ${c === city ? 'selected' : ''}>${c || 'All Cities (Gujarat)'}</option>`).join('')}</select>
          </label>
          <label>Pickup Date &amp; Time<input type="datetime-local" name="start" id="lp-start" value="${toLocal(start)}" min="${toLocal(minNow)}" step="1800"></label>
          <label>Return Date &amp; Time<input type="datetime-local" name="end" id="lp-end" value="${toLocal(end)}" min="${toLocal(start)}" step="1800"></label>
          <button type="submit" class="btn-orange">${icon('search')} Search Cars</button>
          <p id="lp-search-err" class="error" role="alert" hidden style="grid-column:1/-1;margin:0"></p>
        </form>
      </div>
    </section>

    <section class="lp-section" aria-labelledby="lp-pop">
      <div class="lp-section-head">
        <div>
          <div class="eyebrow">Verified Fleet</div>
          <h2 id="lp-pop">${city ? `Cars Available in ${esc(city)}` : 'Popular Self-Drive Cars'}</h2>
        </div>
        <a class="button btn-outline btn-sm" href="cars.html${city ? '?city=' + encodeURIComponent(city) : ''}">View All Cars ${icon('arrowRight', 'ic-sm')}</a>
      </div>
      <div class="lp-cats" id="lp-cats" role="group" aria-label="Filter by vehicle category"></div>
      <div class="car-grid" id="fleet">${[1, 2, 3].map(() => '<div class="skeleton-card"><div class="sk-media skeleton-pulse"></div><div class="sk-info"><div class="sk-title skeleton-pulse"></div><div class="sk-sub skeleton-pulse"></div></div></div>').join('')}</div>
    </section>

    <section class="lp-section" id="how-it-works" aria-labelledby="lp-how">
      <div class="lp-section-head">
        <div>
          <div class="eyebrow">How It Works</div>
          <h2 id="lp-how">Book a Self-Drive Car in Four Steps</h2>
        </div>
      </div>
      <div class="lp-steps">
        <div class="lp-step"><span class="num">1</span><h3>Search &amp; Compare</h3><p>Select your pickup city, dates, and times to compare available cars and complete price breakdowns.</p></div>
        <div class="lp-step"><span class="num">2</span><h3>Verify Your Identity</h3><p>Complete driving licence and government ID verification once from your account dashboard.</p></div>
        <div class="lp-step"><span class="num">3</span><h3>Confirm &amp; Pay Online</h3><p>Review the rental agreement, included kilometres, and security deposit before completing checkout.</p></div>
        <div class="lp-step"><span class="num">4</span><h3>Inspect &amp; Drive</h3><p>Record pre-trip and post-trip condition photos and odometer readings at pickup and return.</p></div>
      </div>
    </section>

    <section class="lp-section alt" aria-labelledby="lp-why">
      <div class="lp-section-head">
        <div>
          <div class="eyebrow">Why Customers Choose Safar</div>
          <h2 id="lp-why">Built Around Clarity, Documentation &amp; Trust</h2>
        </div>
      </div>
      <div class="lp-values">
        <div class="lp-value"><span class="ico">${icon('shield')}</span><div><h3>Verified Customer &amp; Vehicle Documentation</h3><p>Every listed vehicle undergoes RC, insurance, and photo verification before activation, and renters complete identity and driving licence checks.</p></div></div>
        <div class="lp-value"><span class="ico">${icon('receipt')}</span><div><h3>Transparent Rental Pricing</h3><p>Daily rates, included kilometre allowances, excess kilometre charges, and refundable security deposits are itemized upfront before payment.</p></div></div>
        <div class="lp-value"><span class="ico">${icon('card')}</span><div><h3>Secure Online Payments</h3><p>Each confirmed reservation generates an official digital rental agreement and downloadable tax invoice.</p></div></div>
        <div class="lp-value"><span class="ico">${icon('camera')}</span><div><h3>Documented Pickup &amp; Return</h3><p>Multi-angle vehicle photos and odometer readings at both pickup and return protect both guests and hosts.</p></div></div>
        <div class="lp-value"><span class="ico">${icon('clock')}</span><div><h3>Clear Cancellation &amp; Refund Policies</h3><p>Cancellation timelines and security deposit settlement calculations are documented in your rental agreement.</p></div></div>
        <div class="lp-value"><span class="ico">${icon('support')}</span><div><h3>Responsive Booking Support</h3><p>Dedicated support team and an online dispute resolution tracker directly inside your customer account.</p></div></div>
      </div>
    </section>

    <section class="lp-section" aria-labelledby="lp-host">
      <div class="lp-host">
        <div class="lp-host-copy">
          <div class="eyebrow" style="color:#E5C9E6">Host &amp; Vehicle-Owner Onboarding</div>
          <h2 id="lp-host">Share Your Car on Safar</h2>
          <p>List your personal car or dealership fleet with structured inspections, verified renters, and transparent payout settlements.</p>
          <ul>
            <li>${icon('check')} Register your vehicle with 8-angle inspection photos, RC, and insurance documentation.</li>
            <li>${icon('check')} Manage your availability calendar, daily pricing, and upcoming guest handovers in one console.</li>
            <li>${icon('check')} Receive the configured host settlement directly to your verified bank account.</li>
          </ul>
          <div><a class="button btn-orange" href="host-onboarding.html">Become a Host</a></div>
        </div>
        <img src="https://images.unsplash.com/photo-1494976388531-d1058494cdd8?auto=format&fit=crop&w=1200&q=80" alt="Vehicle owner handing over car keys" loading="lazy">
      </div>
    </section>

    <section class="lp-section" id="lp-reviews-wrap" hidden aria-labelledby="lp-rev">
      <div class="lp-section-head">
        <div>
          <div class="eyebrow">Customer Reviews</div>
          <h2 id="lp-rev">Feedback from Completed Bookings</h2>
        </div>
      </div>
      <div class="lp-reviews" id="lp-reviews"></div>
    </section>

    <section class="lp-section" id="faq" aria-labelledby="lp-faq">
      <div class="lp-section-head">
        <div>
          <div class="eyebrow">Frequently Asked Questions</div>
          <h2 id="lp-faq">Common Questions About Self-Drive Rentals</h2>
        </div>
      </div>
      <div class="faq">
        <details><summary>What documents are required to book and pick up a car?</summary><p>A valid Indian Driving Licence appropriate for the vehicle category and a government-issued identity document (Aadhaar). You can complete verification online from <a href="dashboard.html?tab=kyc">your account</a> prior to pickup.</p></details>
        <details><summary>How does fuel policy work?</summary><p>Rates exclude fuel. Vehicles are handed over with a recorded fuel percentage at pickup and must be returned with the same fuel level. Any shortfall is adjusted during settlement.</p></details>
        <details><summary>What is the included kilometre allowance?</summary><p>Each vehicle card and detail page specifies the included kilometres per day (typically 300 km/day) and the applicable per-kilometre charge for additional distance.</p></details>
        <details><summary>When is the refundable security deposit returned?</summary><p>Following the return inspection and odometer/fuel verification, the refundable deposit is processed within 2–5 business days after deducting any documented excess distance, late return, or damage charges.</p></details>
        <details><summary>How can I cancel or raise a dispute on a booking?</summary><p>Upcoming reservations can be cancelled directly from <a href="dashboard.html?tab=trips">My Bookings</a> according to the Schedule IV cancellation policy. For billing or condition issues on any trip, use the <a href="dashboard.html?tab=disputes">Booking Disputes</a> tab in your account.</p></details>
        <details id="policies"><summary>Where can I review the Lease Agreement, Privacy Policy, and Cancellation Terms?</summary><p>Every reservation includes a complete digital Car Sharing Lease Agreement covering party responsibilities, mileage schedules, deposit rules, and cancellation tiers. You can view or download it as a PDF at any time from your booking record.</p></details>
      </div>
    </section>

    <section class="lp-section" id="support" aria-labelledby="lp-sup">
      <div class="lp-section-head">
        <div>
          <div class="eyebrow">Customer Support</div>
          <h2 id="lp-sup">We Are Here to Help</h2>
        </div>
      </div>
      <div class="lp-support">
        ${COMPANY.phone ? `<a class="ds-card" href="tel:${esc(COMPANY.phoneHref)}"><span class="lp-value"><span class="ico">${icon('phone')}</span></span><div><strong>Booking Helpline</strong><p style="margin:2px 0 0">${esc(COMPANY.phone)}</p></div></a>` : ''}
        ${COMPANY.email ? `<a class="ds-card" href="mailto:${esc(COMPANY.email)}"><span class="lp-value"><span class="ico">${icon('mail')}</span></span><div><strong>Email Support</strong><p style="margin:2px 0 0">${esc(COMPANY.email)}</p></div></a>` : `<a class="ds-card" href="contact.html"><span class="lp-value"><span class="ico">${icon('mail')}</span></span><div><strong>Contact Us</strong><p style="margin:2px 0 0">Send us your question</p></div></a>`}
        <a class="ds-card" href="dashboard.html?tab=disputes"><span class="lp-value"><span class="ico">${icon('scale')}</span></span><div><strong>Dispute &amp; Issue Tracker</strong><p style="margin:2px 0 0">Raise and track booking or refund inquiries online.</p></div></a>
      </div>
    </section>`;

  const startEl = $('#lp-start'), endEl = $('#lp-end'), err = $('#lp-search-err');
  startEl.addEventListener('change', () => {
    endEl.min = startEl.value;
    if (endEl.value <= startEl.value) { const s = new Date(startEl.value); s.setDate(s.getDate() + 1); endEl.value = toLocal(s); }
  });
  $('#lp-search').addEventListener('submit', e => {
    e.preventDefault();
    const s = new Date(startEl.value), en = new Date(endEl.value);
    let msg = '';
    if (!Number.isFinite(+s) || !Number.isFinite(+en)) msg = 'Please select both pickup and return dates and times.';
    else if (s < new Date(Date.now() - 5 * 60000)) msg = 'Pickup date and time must be in the future.';
    else if (en - s < 4 * 3600000) msg = 'Return time must be at least 4 hours after pickup.';
    if (msg) { err.textContent = msg; err.hidden = false; return; }
    err.hidden = true;
    const c = $('#lp-city').value; setCity(c);
    const p = new URLSearchParams({ startDate: s.toISOString(), endDate: en.toISOString() });
    if (c) p.set('city', c);
    location.assign('cars.html?' + p);
  });

  try {
    const all = await api('/vehicles');
    // Real figures from the public listing (the API returns at most 100 approved cars per request).
    const listedCities = [...new Set(all.map(c => (c.locationCity || '').trim()).filter(Boolean))].sort((a, b) => a.localeCompare(b));
    if (all.length) {
      $('#stat-cars').textContent = all.length >= 100 ? '100+' : String(all.length);
      $('#stat-cities').textContent = String(listedCities.length);
      $('#stat-cities-lbl').textContent = listedCities.length === 1 ? 'City' : 'Cities';
      $('#hero-stats').hidden = false;
    }
    // The fixed service cities are always offered; a listed car in any other city adds that city too.
    for (const c of listedCities) if (!DEFAULT_CITIES.includes(c)) $('#lp-city').append(new Option(c, c));
    const pool = city ? all.filter(c => (c.locationCity || '').toLowerCase().includes(city.toLowerCase())) : all;
    const cats = [...new Set(pool.map(c => c.category).filter(Boolean))];
    const render = cat => {
      const list = (cat ? pool.filter(c => c.category === cat) : pool)
        .slice().sort((a, b) => ratingSummary(b).count - ratingSummary(a).count).slice(0, 6);
      $('#fleet').innerHTML = list.length ? list.map(carCard).join('')
        : empty('No vehicles available for this filter', city ? `No active listings found in ${esc(city)}. Select All Cities to browse the complete fleet.` : 'New vehicles are being onboarded.');
    };
    $('#lp-cats').innerHTML = cats.length > 1
      ? [`<button type="button" class="chip active" data-cat="">All Categories</button>`, ...cats.map(c => `<button type="button" class="chip" data-cat="${esc(c)}">${esc(c)}</button>`)].join('')
      : '';
    $$('#lp-cats .chip').forEach(b => b.onclick = () => {
      $$('#lp-cats .chip').forEach(x => x.classList.toggle('active', x === b));
      render(b.dataset.cat);
    });
    render('');

    const reviews = all.flatMap(c => (c.reviews || []).filter(r => r.comment && Number(r.rating) >= 1).map(r => ({ ...r, car: `${c.make} ${c.model}` })))
      .sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0)).slice(0, 3);
    if (reviews.length) {
      $('#lp-reviews').innerHTML = reviews.map(r => `
        <figure class="lp-review">
          <div class="stars" aria-label="${Number(r.rating)} out of 5 stars">${'★'.repeat(Math.round(r.rating))}${'☆'.repeat(5 - Math.round(r.rating))}</div>
          <blockquote style="margin:10px 0;color:var(--ink)">${esc(r.comment)}</blockquote>
          <figcaption class="text-muted" style="font-size:13px">${esc(r.author?.firstName || 'Verified Customer')} · ${esc(r.car)}</figcaption>
        </figure>`).join('');
      $('#lp-reviews-wrap').hidden = false;
    }
  } catch (e) {
    $('#fleet').innerHTML = loadError('Fleet unavailable', e.message, 'Reload fleet');
    $('.retry-load-btn')?.addEventListener('click', () => home());
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
function auth(forceRegister, loginMode = 'password') {
  const isReg = forceRegister ?? (new URLSearchParams(location.search).get('tab') === 'register');
  const isOtpLogin = !isReg && loginMode === 'otp';

  $('#app').innerHTML = `
    <div class="auth-box">
      <aside class="auth-banner">
        <div>
          <img src="safar-logo.png" alt="Safar" class="auth-banner-logo" data-hide-on-error>
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
        <p class="text-muted">${isReg ? 'Register as a customer or vehicle host.' : (isOtpLogin ? 'Enter your mobile number and we will send a one-time password.' : 'Enter your email and password to continue.')}</p>

        <form id="auth-form" class="form-stack">
          ${!isReg && !isOtpLogin ? `
            <div style="margin-bottom:14px;padding:12px;background:rgba(240,120,24,0.06);border:1px solid rgba(240,120,24,0.22);border-radius:10px">
              <div style="font-size:11.5px;font-weight:700;color:var(--brand);margin-bottom:8px;text-transform:uppercase;letter-spacing:0.04em">Quick Demo Logins (1-Click Fill)</div>
              <div style="display:flex;gap:6px;flex-wrap:wrap">
                <button type="button" class="button btn-outline btn-sm fill-demo-btn" data-email="admin@safar.com" data-pass="Admin@12345678" style="font-size:12px;padding:5px 10px;cursor:pointer">👑 Admin</button>
                <button type="button" class="button btn-outline btn-sm fill-demo-btn" data-email="host@safar.com" data-pass="Host@12345678" style="font-size:12px;padding:5px 10px;cursor:pointer">🚗 Host</button>
                <button type="button" class="button btn-outline btn-sm fill-demo-btn" data-email="customer@safar.com" data-pass="Customer@12345678" style="font-size:12px;padding:5px 10px;cursor:pointer">👤 Customer</button>
              </div>
            </div>` : ''}

          ${isReg ? `
            <div class="form-grid">
              ${inp('firstName', 'First name', 'text', 'autocomplete="given-name" maxlength="60" placeholder="e.g. Rahul"')}
              ${inp('lastName', 'Last name', 'text', 'autocomplete="family-name" maxlength="60" placeholder="e.g. Sharma"')}
            </div>` : ''}

          ${isOtpLogin
            ? inp('phone', 'Mobile number (+91)', 'tel', 'autocomplete="tel" inputmode="tel" maxlength="20" placeholder="+919876543210"')
            : `${inp('email', 'Email address', 'email', 'autocomplete="email" maxlength="254" placeholder="you@example.com"')}
               ${inp('password', 'Password', 'password', `autocomplete="${isReg ? 'new-password' : 'current-password'}" minlength="${isReg ? 8 : 1}" maxlength="72" placeholder="${isReg ? 'At least 8 characters' : 'Enter password'}"`)}`}

          ${isReg ? `
            ${inp('phone', 'Mobile number (+91)', 'tel', 'autocomplete="tel" required placeholder="+919876543210"')}
            ${sel('role', 'Account Type', ['CUSTOMER', 'HOST', 'DEALER'])}
            <p class="text-muted" style="font-size:12px;margin:0">A 6-digit Mobile OTP will be sent to verify your number before identity verification.</p>
          ` : ''}

          <button type="submit" class="button btn-orange" style="width:100%;margin-top:8px">
            ${isReg ? 'Send Mobile OTP &amp; Create Account →' : (isOtpLogin ? 'Send Login OTP →' : 'Sign In →')}
          </button>
        </form>

        ${!isReg ? `<p style="font-size:13px;color:var(--muted);margin:14px 0 0;text-align:center"><a href="#" id="toggle-login-mode">${isOtpLogin ? 'Use password instead' : 'Sign in with mobile OTP'}</a></p>` : ''}

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
  $('#toggle-login-mode')?.addEventListener('click', e => { e.preventDefault(); auth(false, isOtpLogin ? 'password' : 'otp'); });

  $$('.fill-demo-btn').forEach(btn => {
    btn.onclick = () => {
      const emailInput = $('input[name="email"]', $('#auth-form'));
      const passInput = $('input[name="password"]', $('#auth-form'));
      if (emailInput && passInput) {
        emailInput.value = btn.dataset.email;
        passInput.value = btn.dataset.pass;
      }
    };
  });

  bindForm('#auth-form', async data => {
    if (isOtpLogin) {
      const res = await post('/auth/login/otp/request', { phone: data.phone });
      const devOtpCode = res.devOtp;
      showDialog(`
        <div style="text-align:center;padding:8px 4px">
          <div style="width:56px;height:56px;border-radius:16px;background:rgba(59,18,63,0.08);color:var(--brand);display:inline-flex;align-items:center;justify-content:center;margin-bottom:12px"><span class="ico">${icon('phone')}</span></div>
          <h3 style="margin:0 0 6px">Enter your login OTP</h3>
          <p class="text-muted" style="margin:0 0 16px;font-size:13.5px">We sent a 6-digit OTP to <strong>${esc(res.maskedPhone || data.phone)}</strong>.</p>
          ${devOtpCode ? `<div class="notice info" style="margin-bottom:16px;text-align:left"><strong>Development OTP:</strong> <code style="font-size:16px;font-weight:800;color:var(--brand)">${esc(devOtpCode)}</code></div>` : ''}
          <form id="login-otp-modal-form" class="form-stack" style="text-align:left">
            <label>Enter 6-Digit OTP
              <input name="otp" type="text" inputmode="numeric" pattern="[0-9]{6}" maxlength="6" required ${devOtpCode ? `value="${esc(devOtpCode)}"` : ''} style="font-size:22px;font-weight:800;letter-spacing:0.35em;text-align:center">
            </label>
            <button type="submit" class="button btn-orange" style="width:100%">Verify &amp; Sign In →</button>
          </form>
        </div>`);
      bindForm('#login-otp-modal-form', async otpData => {
        const login = await post('/auth/login/otp/verify', { phone: data.phone, otp: otpData.otp });
        if (login?.token) localStorage.setItem('safar_token', login.token);
        $('dialog').close();
        finishLogin(login);
      });
      return;
    }
    const res = await post('/auth/' + (isReg ? 'register' : 'login'), data);
    if (isReg) {
      const devOtpCode = res.devOtp;
      showDialog(`
        <div style="text-align:center;padding:8px 4px">
          <div style="width:56px;height:56px;border-radius:16px;background:rgba(59,18,63,0.08);color:var(--brand);display:inline-flex;align-items:center;justify-content:center;margin-bottom:12px"><span class="ico">${icon('phone')}</span></div>
          <h3 style="margin:0 0 6px">Verify Your Mobile Number</h3>
          <p class="text-muted" style="margin:0 0 16px;font-size:13.5px">We sent a 6-digit verification OTP to <strong>${esc(data.phone || 'your mobile')}</strong>.</p>
          ${devOtpCode ? `<div class="notice info" style="margin-bottom:16px;display:flex;align-items:center;justify-content:space-between;gap:10px;text-align:left">
            <span><strong>Development OTP:</strong> <code style="font-size:16px;font-weight:800;color:var(--brand)">${esc(devOtpCode)}</code></span>
            <button type="button" id="autofill-otp-btn" class="btn-outline btn-sm">Auto-Fill OTP</button>
          </div>` : ''}
          <form id="otp-verify-modal-form" class="form-stack" style="text-align:left">
            <label>Enter 6-Digit Mobile OTP
              <input name="otp" id="otp-modal-input" type="text" inputmode="numeric" pattern="[0-9]{6}" maxlength="6" required ${devOtpCode ? `value="${esc(devOtpCode)}"` : ''} style="font-size:22px;font-weight:800;letter-spacing:0.35em;text-align:center">
            </label>
            <button type="submit" class="button btn-orange" style="width:100%">Verify OTP &amp; Proceed to e-KYC →</button>
          </form>
        </div>
      `);
      $('#autofill-otp-btn')?.addEventListener('click', () => {
        $('#otp-modal-input').value = devOtpCode;
      });
      bindForm('#otp-verify-modal-form', async otpData => {
        const verifyRes = await post('/auth/otp/verify', { otp: otpData.otp });
        if (verifyRes?.token) localStorage.setItem('safar_token', verifyRes.token);
        $('dialog').close();
        toast('Mobile number verified. Next: identity verification.');
        setTimeout(() => {
          location.href = data.role === 'HOST' || data.role === 'DEALER' ? 'host-onboarding.html' : 'kyc.html?new=1';
        }, 500);
      });
    } else {
      finishLogin(res);
    }
  });

  function finishLogin(res) {
    if (res?.token) {
      localStorage.setItem('safar_token', res.token);
    }
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
}

/* ─── VEHICLE BROWSE & DISCOVERY STUDIO ──────────────────────────────── */
let allCars = [];

async function cars() {
  const id = new URLSearchParams(location.search).get('id');
  if (id) return carDetails(id);

  $('#app').innerHTML = `
    <div class="cars-page-wrap">
      <!-- Top Search & Schedule Command Bar -->
      <div class="horizon-search-bar">
        <div class="horizon-search-top">
          <div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap">
            <span class="horizon-location-pill">
              <span class="ico">${icon('pin')}</span> <strong>${esc(getCity() || 'All cities')}</strong>
            </span>
            <span class="badge ok">${icon('shield')} Reviewed listings</span>
          </div>
        </div>

        <form id="availability-search" class="availability-search">
          <div class="availability-heading">
            <strong>Search Available Vehicles</strong>
            <span>Transparent Pricing · Digital Lease Agreement · Verified Handover</span>
          </div>
          <label>Hub / City<input name="city" placeholder="Ahmedabad, Surat, Vadodara…" maxlength="120"></label>
          <fieldset class="trip-date-range"><legend>Trip Schedule</legend>
            <label>Pick-up<input name="startDate" type="datetime-local" required></label>
            <label>Drop-off<input name="endDate" type="datetime-local" required></label>
          </fieldset>
          <button type="submit" class="button btn-orange">Update Search</button>
        </form>
      </div>

      <!-- Search & Sort Row -->
      <div class="cars-search-row">
        <div class="search-input-box">
          <svg class="search-icon-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2">
            <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
          </svg>
          <input id="car-search" type="search" placeholder="Search by make, model, city, transmission, fuel type…" autocomplete="off">
        </div>
        <select id="car-sort" class="sort-dropdown">
          <option value="">Sort: Recommended</option>
          <option value="price_asc">Price: Low to High</option>
          <option value="price_desc">Price: High to Low</option>
          <option value="rating_desc">Rating: Highest Rated</option>
        </select>
      </div>

      <!-- Quick Filter Pills (Clean SVG Icons, Zero Emojis) -->
      <div class="chip-row" id="chip-row">
        <button type="button" class="chip-btn active" data-filter="all">${icon('car')} All Verified Cars</button>
        <button type="button" class="chip-btn" data-filter="SUV">SUV &amp; 4x4</button>
        <button type="button" class="chip-btn" data-filter="Sedan">Sedan</button>
        <button type="button" class="chip-btn" data-filter="Hatchback">Hatchback</button>
        <button type="button" class="chip-btn" data-filter="Automatic">${icon('sliders')} Automatic</button>
        <button type="button" class="chip-btn" data-filter="Diesel">${icon('fuel')} Diesel</button>
        <button type="button" class="chip-btn" data-filter="7seater">${icon('users')} 6/7 Seater</button>
        <button type="button" class="chip-btn" data-filter="newmodel">Model 2023+</button>
        <button type="button" class="chip-btn" data-filter="superhost">${icon('star')} Top Rated</button>
      </div>

      <!-- Two-Column Layout: Left Filter Studio + Right Fleet Grid -->
      <div class="cars-layout">
        <button type="button" class="mobile-filter-toggle btn-outline" aria-expanded="false" aria-controls="vehicle-search-filters">Show Filters</button>
        <aside class="sidebar-filters" id="vehicle-search-filters">
          <div class="filter-header-top">
            <h3>Filters</h3>
            <button type="button" class="filter-reset-btn" id="clear-filters-btn">Reset All</button>
          </div>


          <!-- Delivery Type -->
          <div class="filter-group">
            <div class="filter-title">Handover Option</div>
            <label class="checkbox-item">
              <input type="checkbox" id="filter-home-delivery" />
              <span>Hub Pickup &amp; Doorstep Delivery</span>
            </label>
            <small class="text-muted" style="display:block;font-size:11px;margin-top:4px">8-angle inspection performed at handover.</small>
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
            <div class="filter-title">Segment / Body Type</div>
            <label class="checkbox-item"><input type="checkbox" class="cat-cb" value="hatchback" checked /><span>Hatchback</span></label>
            <label class="checkbox-item"><input type="checkbox" class="cat-cb" value="suv,compact suv" checked /><span>SUV / Compact SUV</span></label>
            <label class="checkbox-item"><input type="checkbox" class="cat-cb" value="sedan" checked /><span>Sedan</span></label>
            <label class="checkbox-item"><input type="checkbox" class="cat-cb" value="muv" checked /><span>MUV / 7-Seater</span></label>
            <label class="checkbox-item"><input type="checkbox" class="cat-cb" value="luxury" checked /><span>Luxury &amp; Executive</span></label>
          </div>

          <!-- Transmission -->
          <div class="filter-group">
            <div class="filter-title">Transmission</div>
            <label class="checkbox-item"><input type="checkbox" class="trans-cb" value="Automatic" checked /><span>Automatic</span></label>
            <label class="checkbox-item"><input type="checkbox" class="trans-cb" value="Manual" checked /><span>Manual</span></label>
          </div>

          <!-- Fuel Type -->
          <div class="filter-group">
            <div class="filter-title">Fuel Type</div>
            <label class="checkbox-item"><input type="checkbox" class="fuel-cb" value="Petrol" checked /><span>Petrol</span></label>
            <label class="checkbox-item"><input type="checkbox" class="fuel-cb" value="Diesel" checked /><span>Diesel</span></label>
            <label class="checkbox-item"><input type="checkbox" class="fuel-cb" value="CNG" checked /><span>CNG</span></label>
            <label class="checkbox-item"><input type="checkbox" class="fuel-cb" value="Electric" checked /><span>Electric (EV)</span></label>
            <label class="checkbox-item"><input type="checkbox" class="fuel-cb" value="Hybrid" checked /><span>Hybrid</span></label>
          </div>

          <!-- Minimum Guest Rating -->
          <div class="filter-group">
            <div class="filter-title">Customer Rating</div>
            <label class="checkbox-item"><input type="radio" name="minRating" class="rating-rb" value="4.5" /><span>4.5+ Rated</span></label>
            <label class="checkbox-item"><input type="radio" name="minRating" class="rating-rb" value="4.0" /><span>4.0+ Rated</span></label>
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

          <!-- Verification Standards -->
          <div class="filter-group" style="border-bottom: none; margin-bottom: 0; padding-bottom: 0;">
            <div class="filter-title">Verification Standards</div>
            <label class="checkbox-item"><input type="checkbox" id="addon-fastag" checked /><span>Active FASTag Equipped</span></label>
            <label class="checkbox-item"><input type="checkbox" id="addon-s3" checked /><span>8-Angle S3 Pre-Inspected</span></label>
            <label class="checkbox-item"><input type="checkbox" id="addon-superhost" /><span>Top Rated Hosts Only</span></label>
          </div>
        </aside>

        <!-- RIGHT CARS CONTENT -->
        <div class="cars-results-wrap">
          <div class="cars-count-bar" style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px">
            <span id="cars-count-text" role="status" aria-live="polite" style="font-weight:800;font-size:15px">Loading verified fleet…</span>
            <span style="font-size:12px;color:var(--text-muted)">Base fare includes 300 km/day · Refundable deposit shown at checkout</span>
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
    // Local dev only, plain browsing only (no trip dates): show labelled samples while nothing real is listed.
    if (!allCars.length && PREVIEW_MODE && !query.has('startDate')) allCars = PREVIEW_CARS.map(car => ({ ...car }));
    const maximum = Math.max(2500, ...allCars.map(car => Math.ceil(Number(car.pricePerDay) / 500) * 500));
    $('#price-slider').max = maximum;
    $('#price-slider').value = maximum;
    $('#price-val-label').textContent = 'Any budget';
    $('#budget-maximum').textContent = money(maximum);
    applyCarFilters();
  } catch (e) {
    $('#fleet-grid').innerHTML = loadError('Unable to load available cars', e.message, 'Retry search');
    $('.retry-load-btn')?.addEventListener('click', () => cars());
  }

  $('.mobile-filter-toggle').onclick = event => {
    const expanded = event.currentTarget.getAttribute('aria-expanded') !== 'true';
    event.currentTarget.setAttribute('aria-expanded', String(expanded));
    event.currentTarget.textContent = expanded ? 'Hide Filters' : 'Show Filters';
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

  $('#clear-filters-btn').onclick = () => {
    $$('#chip-row .chip-btn').forEach((b, i) => b.classList.toggle('active', i === 0));
    $$('.cat-cb, .trans-cb, .fuel-cb').forEach(cb => { cb.checked = true; });
    $$('.rating-rb').forEach(rb => { rb.checked = rb.value === '0'; });
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

  const getRating = c => {
    const r = ratingSummary(c);
    return r.count > 0 ? Number(r.value) : 0;
  };

  const q = $('#car-search')?.value?.trim().toLowerCase() || '';
  if (q) {
    list = list.filter(c => (c.make + ' ' + c.model + ' ' + c.category + ' ' + c.locationCity + ' ' + c.fuelType + ' ' + c.transmission).toLowerCase().includes(q));
  }

  const activeChip = $('#chip-row .chip-btn.active')?.dataset?.filter || 'all';
  if (activeChip !== 'all') {
    if (['Manual','Automatic'].includes(activeChip)) list = list.filter(c => (c.transmission || '').toLowerCase() === activeChip.toLowerCase());
    else if (['Petrol','Diesel','Electric','CNG','Hybrid'].includes(activeChip)) list = list.filter(c => (c.fuelType || '').toLowerCase() === activeChip.toLowerCase());
    else if (activeChip === 'superhost') list = list.filter(c => getRating(c) >= 4.5);
    else if (activeChip === 'newmodel') list = list.filter(c => Number(c.year || 2024) >= 2023);
    else if (activeChip === '7seater') list = list.filter(c => Number(c.seats || 5) >= 6 || (c.category || '').toLowerCase().includes('muv'));
    else list = list.filter(c => (c.category || '').toLowerCase().includes(activeChip.toLowerCase()));
  }

  const selCats  = $$('.cat-cb:checked').map(x => x.value.toLowerCase());
  const selTxs   = $$('.trans-cb:checked').map(x => x.value.toLowerCase());
  const selFuels = $$('.fuel-cb:checked').map(x => x.value.toLowerCase());
  const maxPrice = Number($('#price-slider')?.value || 99999);
  const minYear  = Number($('#year-slider')?.value || 2018);
  const minRating = Number(document.querySelector('.rating-rb:checked')?.value || 0);

  list = list.filter(c => selCats.some(group => group.split(',').includes((c.category || '').toLowerCase())));
  list = list.filter(c => selTxs.includes((c.transmission || '').toLowerCase()));
  list = list.filter(c => selFuels.includes((c.fuelType || '').toLowerCase()));
  list = list.filter(c => Number(c.pricePerDay) <= maxPrice);
  list = list.filter(c => Number(c.year || 2024) >= minYear);
  if (minRating > 0) list = list.filter(c => getRating(c) >= minRating);

  const sort = $('#car-sort')?.value || '';
  if (sort === 'price_asc')  list.sort((a, b) => Number(a.pricePerDay) - Number(b.pricePerDay));
  if (sort === 'price_desc') list.sort((a, b) => Number(b.pricePerDay) - Number(a.pricePerDay));
  if (sort === 'rating_desc') list.sort((a, b) => getRating(b) - getRating(a));

  const datesSelected = new URLSearchParams(location.search).has('startDate') && new URLSearchParams(location.search).has('endDate');
  const preview = allCars.some(car => car.preview);
  $('#cars-count-text').textContent = preview
    ? `${list.length} sample car${list.length !== 1 ? 's' : ''} · Preview only, not bookable`
    : datesSelected
      ? `Showing ${list.length} Verified Car${list.length !== 1 ? 's' : ''} Available for Your Trip`
      : `Showing ${list.length} Self-Drive Car${list.length !== 1 ? 's' : ''} · Select trip dates to check availability`;
  const banner = preview ? `<div class="preview-banner" role="note" data-testid="preview-banner"><strong>Preview mode (local only).</strong> No cars are listed yet, so these sample cars show how the page will look. They aren't real listings and can't be booked; real cars appear here once an administrator approves them.</div>` : '';
  $('#fleet-grid').innerHTML = banner + (list.length
    ? list.map(car => car.preview ? previewCard(car) : carCard(car)).join('')
    : empty('No cars match your exact filter combination', 'Click "Reset All" in the filter sidebar to see all available vehicles.'));
}

/* ─── VEHICLE DETAIL PAGE & BOOKING CONFIGURATOR ─────────────────────── */
const PHOTO_ANGLES = ['FRONT','REAR','LEFT','RIGHT','INTERIOR','BOOT','BONNET','ODOMETER'];

async function carDetails(id) {
  $('#app').innerHTML = `<p class="loading">Loading vehicle details &amp; inspection gallery…</p>`;
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

  const mediaList = (car.media || []).filter(m => PHOTO_ANGLES.includes(m.kind));
  const mainMedia = mediaList.find(m => m.kind === 'FRONT') || mediaList[0];
  const hostName = car.host?.firstName ? `${car.host.firstName} ${car.host.lastName || ''}`.trim() : 'Verified Safar Partner';
  const rating = ratingSummary(car);
  const hasReviews = rating.count > 0;
  const hashNum = (car.id || '1').split('').reduce((a, c) => a + c.charCodeAt(0), 0);
  const terms = car.commercialTerms || {};
  const depositText = terms.securityDeposit != null ? money(terms.securityDeposit) : 'shown in your quote';
  const kmText = terms.includedKilometresPer24Hours ? terms.includedKilometresPer24Hours + ' km per 24 hours' : 'shown in your quote';
  const excessText = terms.excessKmRate != null ? money(terms.excessKmRate) + '/km' : 'shown in your rental agreement';
  const hubText = car.currentHub?.name ? esc(car.currentHub.name) : 'Exact pickup point shared after booking';
  const otherCars = (similarCars || []).filter(c => c.id !== car.id).slice(0, 3);

  const aiAnswers = {
    fuel: `<strong>Fuel Policy (Level-to-Level):</strong> Fuel is not included in the base rental fare. Your ${esc(car.make + ' ' + car.model)} (${esc(car.fuelType)}) is handed over with a verified fuel percentage recorded in the 8-Angle Hub Inspection. Return it at the same fuel level to avoid refuelling charges.`,
    deposit: `<strong>Refundable Security Deposit (${depositText}):</strong> Held during the trip and refunded after return inspection once the 8-Angle Return Photos and odometer reading are verified.`,
    cancel: `<strong>Cancellation &amp; Refund Policy:</strong> Full rental refund when you cancel more than 48 hours before pickup, 50% between 24 and 48 hours, and no rental refund within 24 hours. The security deposit is returned if no settlement is due. Gateway charges are not refundable.`,
    km: `<strong>Kilometre Allowance:</strong> Bookings include <strong>${kmText}</strong>. Extra distance is charged at ${excessText}, as stated in your rental agreement.`,
    docs: `<strong>Pickup Requirements:</strong> Complete your Aadhaar + Driving Licence + Live Selfie verification on Safar. At handover, capture the 8 car angle photos + 1 selfie to begin your trip.`,
    location: `<strong>Pickup Location:</strong> ${esc(car.locationCity)} · <strong>${hubText}</strong>. Exact pickup instructions and host contact details are provided upon booking confirmation.`,
  };

  $('#app').innerHTML = `
    <div class="details-back-bar" style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:10px">
      <a href="cars.html">← Back to All Self-Drive Cars</a>
      <span style="font-size:12.5px;color:var(--text-muted)">${icon('pin')} ${esc(car.locationCity || '')}</span>
    </div>

    <!-- Quick Section Jump Navigation -->
    <nav class="horizon-jump-nav" aria-label="Vehicle sections">
      <a href="#sec-gallery">${icon('camera')} 8-Angle Gallery</a>
      <a href="#sec-location">${icon('pin')} Location</a>
      <a href="#sec-ai-concierge">${icon('help')} Policy Q&amp;A</a>
      <a href="#sec-host">${icon('user')} Host</a>
      <a href="#sec-reviews">${icon('star')} Reviews (${hasReviews ? rating.value : 'New'})</a>
      <a href="#sec-features">${icon('check')} Specifications</a>
      <a href="#sec-cancellation">${icon('shield')} Cancellation</a>
      <a href="#sec-inclusions">${icon('file')} Rental Rules</a>
      ${otherCars.length ? `<a href="#sec-similar">${icon('car')} Similar Cars</a>` : ''}
    </nav>

    <div class="details-layout">
      <!-- LEFT COLUMN -->
      <div class="details-left-col">
        <!-- Photo Gallery Card -->
        <div class="details-gallery" id="sec-gallery">
          <div class="details-main-img-box">
            ${mainMedia
              ? `<img id="car-hero-img" data-vehicle-image src="/api/media/${encodeURIComponent(mainMedia.id)}" alt="${esc(car.make)} ${esc(car.model)}">`
              : `<img id="car-hero-img" data-vehicle-image src="${photoUrl(car)}" alt="${esc(car.make)} ${esc(car.model)}">`}
            ${mediaList.length > 1 ? `<span class="gallery-counter" id="gallery-counter-lbl">1 / ${mediaList.length}</span>` : ''}
          </div>

          ${mediaList.length > 1 ? `
          <div class="gallery-thumb-row" id="gallery-thumbs">
            ${mediaList.map((m, idx) => `
              <button type="button" class="thumb-card ${idx === 0 ? 'active' : ''}" data-idx="${idx}" data-url="/api/media/${encodeURIComponent(m.id)}">
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
                <span>${icon('pin')} ${esc(car.locationCity)}</span>
                <span>·</span>
                ${badge(car.category)}
                <span>·</span>
                <span style="color:var(--ok);font-weight:700">✓ Reviewed listing</span>
              </div>
            </div>
            <div class="details-rating-box">
              <div class="details-rating-num">${hasReviews ? `★ ${rating.value}` : 'New Listing'}</div>
              <div class="details-rating-lbl">${hasReviews ? `${rating.count} verified review${rating.count === 1 ? '' : 's'}` : 'Verified Fleet'}</div>
            </div>
          </div>

          <!-- Specifications Grid -->
          <div class="details-specs-grid">
            <div class="spec-box"><span class="spec-box-lbl">Transmission</span><span class="spec-box-val">${esc(car.transmission)}</span></div>
            <div class="spec-box"><span class="spec-box-lbl">Fuel Type</span><span class="spec-box-val">${esc(car.fuelType)}</span></div>
            <div class="spec-box"><span class="spec-box-lbl">Seating Capacity</span><span class="spec-box-val">${car.seats} Seats</span></div>
            <div class="spec-box"><span class="spec-box-lbl">Model Year</span><span class="spec-box-val">${car.year}</span></div>
            <div class="spec-box"><span class="spec-box-lbl">Odometer</span><span class="spec-box-val">${Number(car.odometer).toLocaleString('en-IN')} km</span></div>
            <div class="spec-box"><span class="spec-box-lbl">FASTag</span><span class="spec-box-val" style="color:var(--ok)">Active</span></div>
          </div>

          <!-- Car Location Hub Card -->
          <div class="details-block" id="sec-location">
            <div style="display:flex;justify-content:space-between;align-items:center;gap:12px;flex-wrap:wrap">
              <div>
                <span class="eyebrow" style="color:var(--cta);font-size:10.5px;font-weight:800;letter-spacing:0.12em;">PICKUP &amp; RETURN HUB</span>
                <h3 style="margin:4px 0 4px">Vehicle Location · ${esc(car.locationCity)}, Gujarat</h3>
                <p class="text-muted" style="margin:0;font-size:13.5px"><strong>${hubText}</strong> · Exact bay and host contact shared after booking confirmation.</p>
              </div>
            </div>
          </div>

          <!-- Interactive Ride Policy Assistant -->
          <div class="safar-ai-concierge" id="sec-ai-concierge">
            <div style="display:flex;justify-content:space-between;align-items:center;gap:10px;flex-wrap:wrap">
              <div>
                <span style="font-size:10.5px;font-weight:800;letter-spacing:0.12em;color:#F07818;text-transform:uppercase">INSTANT RENTAL POLICY GUIDE</span>
                <h3 style="color:#fff;margin:4px 0 0">Common Questions About This ${esc(car.make + ' ' + car.model)}</h3>
              </div>
              <span class="badge ok">Clear Policy Terms</span>
            </div>
            <div class="ai-question-pills" id="ai-concierge-pills">
              <button type="button" class="ai-q-pill active" data-q="fuel">What’s the fuel policy?</button>
              <button type="button" class="ai-q-pill" data-q="deposit">How much is the security deposit?</button>
              <button type="button" class="ai-q-pill" data-q="cancel">What’s the cancellation policy?</button>
              <button type="button" class="ai-q-pill" data-q="km">Is there a kilometre limit?</button>
              <button type="button" class="ai-q-pill" data-q="docs">What documents do I need at pickup?</button>
              <button type="button" class="ai-q-pill" data-q="location">Where and when do I pick up the car?</button>
            </div>
            <div class="ai-answer-box" id="ai-concierge-answer">
              ${aiAnswers.fuel}
            </div>
          </div>

          <!-- Interactive 8-Point Vehicle Inspection Angles -->
          <div class="details-block">
            <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px;margin-bottom:12px;">
              <div>
                <span class="eyebrow" style="color:var(--cta);font-size:10.5px;font-weight:800;letter-spacing:0.12em;">PRE-DELIVERY CONDITION RECORD</span>
                <h3 style="margin:2px 0 0;">8-Angle Vehicle Inspection Views</h3>
              </div>
              <span class="badge good">${mediaList.length}/8 Angles Archived</span>
            </div>
            <p class="text-muted" style="font-size:12.5px;margin-bottom:14px;">Select any inspection angle below to preview the archived condition photo.</p>
            <div class="digital-twin-grid" id="digital-twin-nodes">
              ${PHOTO_ANGLES.map((angle, idx) => {
                const match = mediaList.find(m => m.kind === angle) || mediaList[idx % Math.max(1, mediaList.length)];
                const url = match ? `/api/media/${encodeURIComponent(match.id)}` : photoUrl(car);
                return `
                  <button type="button" class="twin-sensor-btn ${idx === 0 ? 'active' : ''}" data-angle="${esc(angle)}" data-url="${esc(url)}">
                    <span class="sensor-dot"></span>
                    <div>
                      <strong>${esc(angle)}</strong>
                      <small>${match ? 'Verified Angle' : 'Standard View'}</small>
                    </div>
                  </button>`;
              }).join('')}
            </div>
          </div>

          <!-- Host & Verified Reviews -->
          <div class="details-block" id="sec-host">
            <span class="eyebrow" style="color:var(--cta);font-size:10.5px;font-weight:800;letter-spacing:0.12em;">VEHICLE HOST</span>
            <h3 style="margin:4px 0 12px">Hosted by ${esc(hostName)}</h3>
            <div class="host-spotlight-card">
              <div style="display:flex;align-items:center;gap:14px">
                <div style="width:54px;height:54px;border-radius:50%;background:var(--brand);color:#fff;display:flex;align-items:center;justify-content:center;font-size:20px;font-weight:800">
                  ${esc((hostName[0] || 'S').toUpperCase())}
                </div>
                <div>
                  <strong style="font-size:16px">${esc(hostName)}</strong>
                  <p class="text-muted" style="margin:2px 0 0;font-size:12.5px">Verified Safar Fleet Partner · 8-Angle Handover Compliant</p>
                </div>
              </div>
              <div style="display:flex;gap:18px;text-align:center">
                <div><strong style="font-size:16px;color:var(--brand)">${hasReviews ? `★ ${rating.value}` : 'New'}</strong><br><small class="text-muted">Rating</small></div>
                <div><strong style="font-size:16px;color:var(--ok)">${rating.count}</strong><br><small class="text-muted">Reviews</small></div>
              </div>
            </div>

            <div id="sec-reviews" style="margin-top:20px">
              <h4 style="margin:0 0 8px">Customer Reviews (${rating.count})</h4>
              ${car.reviews && car.reviews.length ? `
                <div style="display:grid;gap:10px;margin-top:12px">
                  ${car.reviews.map(r => `
                    <div style="padding:12px 14px;border-radius:12px;border:1px solid var(--border-main);background:var(--bg-subtle)">
                      <div style="display:flex;justify-content:space-between;align-items:center">
                        <strong>${esc(r.author?.firstName || r.reviewer?.firstName || 'Verified Renter')}</strong>
                        <span style="color:#B45309;font-weight:800">★ ${Number(r.rating || 5).toFixed(1)}</span>
                      </div>
                      <small class="text-muted">${r.createdAt ? d(r.createdAt) : 'Verified Safar Trip'}</small>
                      <p style="margin:6px 0 0;font-size:13px">${esc(r.comment || 'Verified completed trip.')}</p>
                    </div>
                  `).join('')}
                </div>
              ` : `<p class="text-muted" style="margin:8px 0 0;font-size:13.5px">No customer reviews yet for this vehicle. Reviews are published by verified renters after trip completion.</p>`}
            </div>
          </div>

          <!-- Interactive Road-Trip Fuel & Budget Estimator -->
          <div class="details-block trip-simulator-card">
            <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px;margin-bottom:10px;">
              <div>
                <span class="eyebrow" style="color:var(--cta);font-size:10.5px;font-weight:800;letter-spacing:0.12em;">TRIP COST ESTIMATOR</span>
                <h3 style="margin:2px 0 0;">Distance &amp; Fuel Estimate</h3>
              </div>
              <span class="badge warn" id="sim-mileage-badge">Approx. ${(car.category || '').toLowerCase().includes('suv') ? '14' : '19'} km/L (${esc(car.fuelType)})</span>
            </div>
            <div class="sim-route-presets">
              <button type="button" class="sim-preset-btn active" data-km="150">City Run (150 km)</button>
              <button type="button" class="sim-preset-btn" data-km="400">Statue of Unity RT (400 km)</button>
              <button type="button" class="sim-preset-btn" data-km="520">Udaipur Weekend RT (520 km)</button>
              <button type="button" class="sim-preset-btn" data-km="750">Highway Tour (750 km)</button>
            </div>
            <div style="margin:14px 0;">
              <div style="display:flex;justify-content:space-between;font-weight:800;font-size:13px;margin-bottom:6px;">
                <span>Planned Trip Distance</span>
                <span id="sim-km-label" style="color:var(--cta);font-size:15px;">150 km</span>
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
                <span>1-Day Base + Est. Fuel</span>
                <strong id="sim-total-est" style="color:var(--cta);">${money(Number(car.pricePerDay) + 860)}</strong>
              </div>
            </div>
          </div>

          <!-- Features & Equipment -->
          <div class="details-block" id="sec-features">
            <h3>Features &amp; Safety Equipment</h3>
            <div class="details-features-grid">
              <div class="feature-check-item"><span class="feature-check-icon">✓</span> Anti-lock Braking System (ABS) &amp; Airbags</div>
              <div class="feature-check-item"><span class="feature-check-icon">✓</span> Reverse Parking Sensors / Assistance</div>
              <div class="feature-check-item"><span class="feature-check-icon">✓</span> Bluetooth Audio &amp; Smartphone Connectivity</div>
              <div class="feature-check-item"><span class="feature-check-icon">✓</span> Spare Wheel &amp; Standard Emergency Kit</div>
              <div class="feature-check-item"><span class="feature-check-icon">✓</span> Air Conditioning &amp; Cabin Ventilation</div>
              <div class="feature-check-item"><span class="feature-check-icon">✓</span> Active FASTag &amp; USB Charging Ports</div>
            </div>
          </div>

          <!-- Cancellation & Rental Rules -->
          <div class="details-block" id="sec-cancellation">
            <h3>Cancellation &amp; Refund Policy</h3>
            <div class="cancellation-timeline-bar">
              <div class="cancel-stage-free">
                <strong style="color:var(--ok);display:block">✓ Full refund</strong>
                <small class="text-muted">More than 48 hours before pickup (50% between 24 and 48 hours)</small>
              </div>
              <div class="cancel-stage-late">
                <strong style="color:#B45309;display:block">No rental refund</strong>
                <small class="text-muted">Within 24 hours of pickup; the deposit is returned if no settlement is due</small>
              </div>
            </div>

            <div id="sec-inclusions" style="margin-top:18px">
              <h3>Rental Rules, Inclusions &amp; Exclusions</h3>
              <ul class="rules-list">
                <li><strong>Security Deposit (${depositText}):</strong> Refundable deposit held for trip settlement and released after return inspection.</li>
                <li><strong>Fuel Policy:</strong> Level-to-level. Return the vehicle with the same fuel percentage recorded at pickup.</li>
                <li><strong>Toll, Parking &amp; Fines:</strong> Road tolls, parking charges, and traffic challans incurred during the booking window are borne by the renter.</li>
                <li><strong>Minimum Age &amp; Licence:</strong> Valid original Indian Driving Licence (LMV) and verified Aadhaar e-KYC required before pickup.</li>
                <li><strong>Mandatory Handover Inspection:</strong> 8 car angle photos + 1 customer selfie must be uploaded at both Pickup and Return.</li>
              </ul>
            </div>
          </div>
        </div>
      </div>

      <!-- RIGHT: Sticky Booking Summary & Price Configurator -->
      <aside class="booking-panel-sticky">
        <div class="bp-price-header">
          <div style="display:flex;justify-content:space-between;align-items:baseline">
            <div class="bp-rate-main">${money(car.pricePerDay)}<small>/day</small></div>
          </div>
          <div class="bp-rate-sub">Includes ${kmText} · Digital Lease Agreement</div>
        </div>

        ${!user ? `
          <div class="notice info" style="margin-bottom:14px">
            Sign in or create an account to check availability and reserve this ${esc(car.make + ' ' + car.model)}.
          </div>
          <a class="button btn-orange" style="width:100%" href="auth.html?redirect=${encodeURIComponent(carLink(id))}">Sign In / Register to Book</a>
        ` : `
          <form id="car-booking-form" class="form-stack">
            <div class="booking-steps" aria-label="Booking progress">
              <div class="booking-step active" data-step="1">Dates</div>
              <div class="booking-step" data-step="2">Vehicle</div>
              <div class="booking-step" data-step="3">Review</div>
              <div class="booking-step" data-step="4">Confirm</div>
            </div>
            ${inp('startDate', 'Pick-up Date &amp; Time', 'datetime-local')}
            ${inp('endDate', 'Drop-off Date &amp; Time', 'datetime-local')}

            <p class="text-muted" style="margin:0;font-size:12.5px">Includes ${kmText}; extra distance ${excessText}.</p>

            <div style="background:var(--bg-subtle);padding:10px 12px;border-radius:12px;border:1px solid var(--border-main);display:flex;justify-content:space-between;align-items:center">
              <div>
                <strong style="font-size:12.5px;display:block">8-Photo Condition Protection</strong>
                <small class="text-muted" style="font-size:11px">Pre/post-trip S3 inspection evidence</small>
              </div>
              <span class="badge ok">INCLUDED</span>
            </div>

            <div id="booking-quote-box" class="bp-fare-calc">
              Select pickup and return dates above to calculate your total fare.
            </div>

            <label class="check">
              <input type="checkbox" required>
              <span>I agree to the <a href="#sec-inclusions">Safar Self-Drive Car Lease Agreement</a> terms and mandatory 8-Photo + Selfie handover inspection.</span>
            </label>

            <button type="submit" class="button btn-orange" style="width:100%;padding:14px;font-size:15px">
              Proceed to Booking &amp; Payment
            </button>
          </form>

          <p id="booking-kyc-status" style="font-size:12px;color:var(--muted);margin-top:10px;text-align:center">Checking e-KYC eligibility…</p>
        `}

        <div class="bp-perks-box">
          <div class="bp-perk-line">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M20 6L9 17l-5-5"/></svg>
            <span><strong>Security Deposit:</strong> ${depositText}, refundable</span>
          </div>
          <div class="bp-perk-line">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M20 6L9 17l-5-5"/></svg>
            <span><strong>Cancellation:</strong> full refund more than 48 hours before pickup</span>
          </div>
          <div class="bp-perk-line">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M20 6L9 17l-5-5"/></svg>
            <span><strong>Pickup City:</strong> ${esc(car.locationCity)}</span>
          </div>
        </div>
      </aside>
    </div>

    ${otherCars.length ? `
      <section id="sec-similar" style="margin-top:36px">
        ${sectionHead('Similar Verified Vehicles', 'Compare other verified self-drive vehicles available in ' + esc(car.locationCity) + '.', 'SIMILAR CARS')}
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
    let currentQuote = null, quoteSequence = 0, quoteTimer, bookingRequestKey = safeUuid();
    const syncBookingSteps = () => {
      const startReady = Boolean(form.elements.startDate.value);
      const endReady = Boolean(form.elements.endDate.value);
      const quoteReady = Boolean(currentQuote);
      const steps = $$('.booking-step', form);
      steps.forEach((step, index) => {
        const done = index === 0 ? quoteReady : index === 1 ? quoteReady : index === 2 ? quoteReady : false;
        const active = index === 0 ? !startReady || !endReady : index === 1 ? startReady && endReady && !quoteReady : index === 2 ? quoteReady : false;
        step.classList.toggle('done', done);
        step.classList.toggle('active', active || (!done && index === 0 && !active));
      });
    };
    const updateQuote = async () => {
      const sequence = ++quoteSequence;
      currentQuote = null;
      syncBookingSteps();
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
        ? '<span style="color:var(--green);font-weight:700">✓ KYC and driving licence are valid through your return date.</span>'
        : '<span style="color:var(--red);font-weight:700">Complete your Aadhaar and driving licence verification first. <a href="kyc.html">Open Verification →</a></span>';
      $('#booking-quote-box').textContent = 'Calculating fare & checking availability…';
      try {
        const quote = await api('/vehicles/' + encodeURIComponent(id) + '/quote?' + new URLSearchParams({startDate:start.toISOString(),endDate:end.toISOString()}));
        if (sequence !== quoteSequence || !form.isConnected) return;
        currentQuote = quote;
        syncBookingSteps();
        $('#booking-quote-box').innerHTML =
          '<div class="bp-fare-row"><span>Rental (' + quote.rentalDays + ' billed day' + (quote.rentalDays === 1 ? '' : 's') + ')</span><span>' + money(quote.rentalAmount) + '</span></div>' +
          '<div class="bp-fare-row"><span>Kilometre allowance</span><span>' + quote.includedKilometres + ' km incl.' + '</span></div>' +
          '<div class="bp-fare-row"><span>Refundable security deposit</span><span>' + money(quote.securityDeposit) + '</span></div>' +
          '<div class="bp-fare-row" style="font-weight:800;color:var(--orange);border-top:1px solid var(--border-main);padding-top:8px;margin-top:6px"><span>Total Payable</span><span>' + money(quote.totalAmount) + '</span></div>';
        button.disabled = false;
      } catch (error) {
        if (sequence !== quoteSequence || !form.isConnected) return;
        $('#booking-quote-box').textContent = error.message;
      }
    };
    form.addEventListener('input', () => {
      bookingRequestKey = safeUuid();
      ++quoteSequence; currentQuote = null;
      $('button[type=submit]', form).disabled = true;
      syncBookingSteps();
      clearTimeout(quoteTimer); quoteTimer = setTimeout(updateQuote, 350);
    });
    updateQuote();

    bindForm('#car-booking-form', async data => {
      if (!requireUser()) return;
      const start = new Date(data.startDate), end = new Date(data.endDate);
      if (isNaN(start.getTime()) || isNaN(end.getTime())) throw new Error('Please select valid pickup and return dates.');
      if (start >= end) throw new Error('Return date must be strictly after pickup date.');
      if (!user.isVerified) throw new Error('Complete your Aadhaar and driving licence verification before booking.');
      if (!currentQuote || currentQuote.startDate !== start.toISOString() || currentQuote.endDate !== end.toISOString()) throw new Error('Wait for an updated quote before booking.');
      const booking = await post('/bookings', {
        ...data, vehicleId: id, expectedTotal: currentQuote.totalAmount,
        startDate: start.toISOString(), endDate: end.toISOString(),
        requestKey: bookingRequestKey,
      });
      $$('.booking-step', form).forEach(step => step.classList.toggle('done', true));
      location.href = 'dashboard.html?booking=' + encodeURIComponent(booking.id);
    });
  }
}

async function kyc() {
  if (!requireUser()) return;
  // Owners manage car documents on the Car Documents page; old links keep working.
  const vehicleParam = new URLSearchParams(location.search).get('vehicle');
  if (vehicleParam && ['HOST', 'DEALER'].includes(user.role)) { location.replace('host-onboarding.html?tab=documents&vehicle=' + encodeURIComponent(vehicleParam)); return; }
  await dashboard('kyc');
}

function renderKycTabHtml(info) {
  const isNew = new URLSearchParams(location.search).get('new') === '1';
  const vehicleId = new URLSearchParams(location.search).get('vehicle');
  const prof = info.profile || user?.profile || {};

  // Owners upload car documents on Car Documents; here they only see their own driving licence and Aadhaar.
  const ownerPanel = ['HOST','DEALER'].includes(user.role);
  const personalDocs = (info.documents || []).filter(doc => !doc.vehicleId && doc.source !== 'DIGILOCKER_TEST');
  const records = (info.documents || []).filter(doc => !ownerPanel || !doc.vehicleId);
  const rejectedDoc = personalDocs.find(doc => doc.status === 'REJECTED');
  const pendingDoc = personalDocs.find(doc => doc.status === 'PENDING');
  // Verification is decided by the server (approved, genuine, unexpired DL + Aadhaar); demo and test records never count.
  const genuineDocs = personalDocs.filter(doc => !unverifiedDocument(doc));
  const kycApproved = genuineDocs.some(doc => doc.kind === 'AADHAAR' && doc.status === 'APPROVED');
  const dlApproved = genuineDocs.some(doc => doc.kind === 'DL' && doc.status === 'APPROVED' && doc.validUntil && new Date(doc.validUntil) > new Date());
  const eligible = Boolean(user?.isVerified);
  const demoLabel = kind => personalDocs.some(doc => doc.kind === kind && doc.status === 'APPROVED' && demoCounted(doc)) && !personalDocs.some(doc => doc.kind === kind && doc.status === 'APPROVED' && !unverifiedDocument(doc) && !demoCounted(doc)) ? ' (local demo record)' : '';
  const faceScore = prof.faceMatchScore || user?.faceMatchScore ? Number(prof.faceMatchScore || user?.faceMatchScore).toFixed(1) : null;

  let kycStateLabel = 'Not Started';
  let kycStateBadge = 'neutral';
  if (eligible) { kycStateLabel = 'Verified'; kycStateBadge = 'ok'; }
  else if (rejectedDoc) { kycStateLabel = 'Rejected — Action Required'; kycStateBadge = 'bad'; }
  else if (pendingDoc) { kycStateLabel = 'Pending Verification'; kycStateBadge = 'warn'; }
  else if (personalDocs.length) { kycStateLabel = 'Verification in Progress'; kycStateBadge = 'warn'; }

  return `
    ${isNew && !eligible ? `
      <div class="kyc-welcome-banner" style="display:flex;align-items:center;justify-content:space-between;gap:14px;flex-wrap:wrap">
        <div><strong>Complete Driver Verification:</strong> Verify your Aadhaar, Driving Licence, and live selfie once to unlock self-drive bookings across all Safar hubs.</div>
      </div>` : ''}

    <div class="panel" style="margin-bottom:20px">
      <div style="display:flex;justify-content:space-between;align-items:center;gap:12px;flex-wrap:wrap;margin-bottom:16px">
        <div>
          <span class="eyebrow" style="color:var(--cta);font-size:11px;font-weight:800;letter-spacing:0.1em">DRIVER IDENTITY &amp; LICENCE COMPLIANCE</span>
          <h3 style="margin:4px 0 0">KYC &amp; Document Verification</h3>
        </div>
        <span class="badge ${kycStateBadge}">${esc(kycStateLabel)}</span>
      </div>

      <!-- 3-Column Status Cards -->
      <div class="kyc-status-row" style="margin-bottom:0">
        <div class="kyc-status-card ${kycApproved ? 'ksc-ok' : 'ksc-pending'}">
          <div class="ksc-badge-icon">${kycApproved ? '✓' : '1'}</div>
          <div class="ksc-info">
            <strong>Government Identity (Aadhaar)</strong>
            <p>${kycApproved ? `Verified${demoLabel('AADHAAR')}${prof.aadhaarNumberMasked ? ` (${esc(prof.aadhaarNumberMasked)})` : ''}` : pendingDoc?.kind === 'AADHAAR' ? 'Awaiting review' : 'Not yet verified'}</p>
          </div>
        </div>

        <div class="kyc-status-card ${dlApproved ? 'ksc-ok' : 'ksc-pending'}">
          <div class="ksc-badge-icon">${dlApproved ? '✓' : '2'}</div>
          <div class="ksc-info">
            <strong>Driving Licence (LMV)</strong>
            <p>${dlApproved ? `Verified${demoLabel('DL')}${user?.dlValidUntil ? ` · Valid through ${d(user.dlValidUntil)}` : ''}` : personalDocs.some(doc => doc.kind === 'DL' && doc.status === 'PENDING') ? 'Awaiting review' : 'Enter DL number &amp; expiry'}</p>
          </div>
        </div>

        <div class="kyc-status-card ${eligible ? 'ksc-ok' : 'ksc-pending'}">
          <div class="ksc-badge-icon">${eligible ? '✓' : '3'}</div>
          <div class="ksc-info">
            <strong>Live Selfie</strong>
            <p>${eligible ? 'Verified Driver' : prof.selfieMediaId ? 'Selfie received · awaiting review' : 'Live selfie required'}</p>
          </div>
        </div>
      </div>
    </div>

    ${rejectedDoc ? `
      <div class="notice" style="border-color:var(--err);background:var(--err-bg);color:var(--err);margin-bottom:20px">
        <strong>Action Required — Document Rejected:</strong> ${esc(rejectedDoc.reviewNote || 'Please re-upload a clear, valid document to complete verification.')}
      </div>
    ` : ''}

    ${eligible && !vehicleId ? `
      <!-- CONDITIONAL UPLOAD RULE: User is verified -> Hide upload forms by default and show verified credential summary -->
      <div class="panel" style="background:linear-gradient(135deg,#3B123F,#521D50);color:#fff;margin-bottom:20px;border:none">
        <div style="display:flex;align-items:center;justify-content:space-between;gap:16px;flex-wrap:wrap">
          <div>
            <span class="badge ok" style="background:rgba(22,128,74,0.25);color:#86EFAC;border:1px solid rgba(134,239,172,0.3)">✓ Driver Verification Complete</span>
            <h3 style="color:#fff;margin:10px 0 6px">Your identity and driving licence are verified</h3>
            <p style="margin:0;color:rgba(255,255,255,0.82);font-size:13.5px">
              Aadhaar Reference: <strong>${esc(prof.aadhaarNumberMasked || user?.aadhaarMasked || 'Masked reference unavailable')}</strong> ·
              Driving Licence: <strong>${esc(prof.drivingLicenseMasked || 'Verified')}</strong> ·
              Valid Until: <strong>${user?.dlValidUntil ? d(user.dlValidUntil) : 'Expiry not recorded'}</strong>
              ${faceScore ? ` · Face Match: <strong>${faceScore}%</strong>` : ''}
            </p>
          </div>
          <a href="cars.html" class="button btn-orange">Browse Vehicles</a>
        </div>
      </div>

      <details class="panel" style="margin-bottom:20px">
        <summary style="cursor:pointer;font-weight:700;color:var(--brand);display:flex;align-items:center;justify-content:space-between">
          <span>Need to renew an expired Driving Licence or request re-verification?</span>
          <span class="btn-outline btn-sm">Update Credentials</span>
        </summary>
        <div style="margin-top:18px;padding-top:18px;border-top:1px solid var(--border-main)">
          ${renderKycVerificationWizardHtml(prof, faceScore, info, vehicleId)}
        </div>
      </details>
    ` : `
      <!-- User is not yet verified OR is uploading vehicle compliance documents -->
      ${renderKycVerificationWizardHtml(prof, faceScore, info, vehicleId)}
    `}

    <!-- Submitted Records Table -->
    <section class="panel" style="margin-top:20px;">
      <h3 style="margin:0 0 12px">Submitted Verification Records (${records.length})</h3>
      ${ownerPanel ? '<p class="notice info" data-testid="car-docs-moved">RC, Insurance and PUC for your cars are uploaded under <a href="host-onboarding.html?tab=documents">Car Documents</a>.</p>' : ''}
      ${records.length ? `
        <div class="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Document Type</th>
                <th>Masked Reference</th>
                <th>Verification Source</th>
                <th>Status</th>
                <th>Valid Until</th>
                <th>Review Notes</th>
                <th>File</th>
              </tr>
            </thead>
            <tbody>
              ${records.map(doc => `
                <tr>
                  <td><strong>${esc(doc.kind)}</strong></td>
                  <td><code>${esc(doc.documentNumberMasked || (doc.numberLast4 ? '•••• ' + doc.numberLast4 : 'Encrypted'))}</code></td>
                  <td>${sourceCell(doc, (doc.source || 'UPLOAD').replaceAll('_', ' '))}</td>
                  <td>${docStatusBadge(doc)}</td>
                  <td>${doc.validUntil ? d(doc.validUntil) : '—'}</td>
                  <td>${esc(doc.reviewNote || 'Pending review by verification officer')}</td>
                  <td>${doc.mediaId || String(doc.source || '').startsWith('DIGILOCKER_LIVE') ? `
                    <button class="button btn-ghost btn-sm view-user-doc-btn" data-id="${esc(doc.id)}" data-kind="${esc(doc.kind)}">View Document ↗</button>` : '<span class="text-muted">No file</span>'}</td>
                </tr>`).join('')}
            </tbody>
          </table>
        </div>` : `<p class="text-muted" style="margin:0">${eligible ? 'Your driving licence and Aadhaar are verified.' : 'No verification documents submitted yet.'}</p>`}
    </section>`;
}

function renderKycVerificationWizardHtml(prof, faceScore, info, vehicleId) {
  return `
    <form id="kyc-facematch-form" class="kyc-wizard-grid" style="margin-bottom:24px">
      <section class="panel" style="margin:0">
        <div class="verification-label">STEP 1 · IDENTITY &amp; LICENCE DETAILS</div>
        <h3 style="margin-top:4px">Aadhaar &amp; Driving Licence Verification</h3>
        <p class="text-muted" style="margin-bottom:16px">Enter your Aadhaar and Driving Licence details. Document numbers are masked and verified alongside your live selfie.</p>

        <div class="form-stack">
          <div class="form-grid">
            <label>12-Digit Aadhaar Number
              <input name="aadhaarNumber" type="text" inputmode="numeric" maxlength="14" required placeholder="e.g. 9876 5432 4829" value="">
            </label>
            <label>Registered Mobile Number
              <input name="mobileNumber" type="tel" placeholder="+91 98765 43210" value="${esc(user?.phone || '')}">
            </label>
          </div>

          <div class="form-grid">
            <label>Driving Licence Number
              <input name="dlNumber" type="text" maxlength="25" required placeholder="e.g. GJ0120190012345" style="text-transform:uppercase" value="">
            </label>
            <label>DL Valid Until (Expiry Date)
              <input name="dlExpiryDate" type="date" required value="">
            </label>
          </div>

          <div class="form-grid" style="padding-top:6px">
            <label>Aadhaar Card Image (Optional)
              <input type="file" name="aadhaarFile" accept="image/jpeg,image/png,image/webp">
            </label>
            <label>Driving Licence Front Image (Optional)
              <input type="file" name="dlFile" accept="image/jpeg,image/png,image/webp">
            </label>
          </div>

          <label class="check" style="margin-top:6px">
            <input type="checkbox" name="consent" checked required>
            <span>I consent to Safar verifying my Aadhaar and Driving Licence and comparing them with my live selfie for rental eligibility.</span>
          </label>

          <button type="submit" id="kyc-facematch-submit" class="button btn-orange" style="width:100%;padding:14px 20px;font-size:15px">
            Submit for Verification
          </button>
        </div>
      </section>

      <!-- Live Camera Selfie Card -->
      <aside class="biometric-camera-card">
        <span style="font-size:11px;font-weight:800;letter-spacing:0.1em;text-transform:uppercase;color:#F07818">STEP 2 · LIVE SELFIE</span>
        <h3 style="color:#fff;margin:6px 0 4px">Live Customer Selfie</h3>
        <p style="font-size:12.5px;color:rgba(255,255,255,0.72);margin:0 0 12px">Position your face in the frame or upload a clear portrait photo.</p>

        <div class="biometric-viewport" id="kyc-selfie-viewport">
          <video id="kyc-webcam-video" autoplay playsinline muted hidden></video>
          <img id="kyc-selfie-preview" ${prof.profileImageUrl ? `src="${esc(prof.profileImageUrl)}"` : 'hidden'} alt="Customer selfie preview">
          <div id="kyc-selfie-placeholder" ${prof.profileImageUrl ? 'hidden' : ''} style="padding:16px;color:rgba(255,255,255,0.7);font-size:12.5px">
            <div style="margin-bottom:8px">${icon('camera')}</div>
            Click <strong>Start Camera</strong> or <strong>Upload Selfie</strong>
          </div>
        </div>

        <div id="kyc-selfie-status" style="margin-bottom:14px;font-size:12.5px;color:#34D399;font-weight:700">
          Ready for live selfie capture
        </div>

        <div style="display:flex;gap:8px;justify-content:center;flex-wrap:wrap">
          <button type="button" id="btn-start-webcam" class="button btn-orange btn-sm">${icon('camera')} Start Camera</button>
          <button type="button" id="btn-capture-webcam" class="button btn-sm" hidden style="background:#16804A;border-color:#16804A;color:#fff">Capture Selfie</button>
          <label class="button btn-outline btn-sm" style="color:#fff;border-color:rgba(255,255,255,0.3);cursor:pointer;margin:0">
            Upload Photo
            <input type="file" id="kyc-selfie-file" accept="image/jpeg,image/png,image/webp" capture="user" hidden>
          </label>
          ${user?.demoVerification ? '<button type="button" id="btn-demo-selfie" class="button btn-ghost btn-sm" style="color:#F07818;border-color:rgba(240,120,24,0.35)">Use Demo Selfie</button>' : ''}
        </div>
      </aside>
    </form>

    ${user?.role === 'ADMIN' ? `
      <div class="kyc-action-grid">
        <section class="panel">
          <div class="verification-label">VEHICLE COMPLIANCE DOCUMENTS</div>
          <h3>Upload Vehicle RC, Insurance or PUC</h3>
          <p class="text-muted">Upload Registration Certificate (RC), Commercial Insurance, or Pollution Under Control (PUC)${vehicleId ? ` for Vehicle ID <code>${esc(vehicleId)}</code>` : ''}.</p>

          <form id="doc-upload-form" class="form-stack">
            ${sel('kind', 'Document Type', ['RC','INSURANCE','PUC','DL'])}
            ${vehicleId ? `<input type="hidden" name="vehicleId" value="${esc(vehicleId)}">` : inp('vehicleId', 'Vehicle ID', 'text', 'placeholder="Enter vehicle ID for RC/Insurance/PUC"')}
            <label>Document File (JPG, PNG, WebP)
              <input type="file" name="file" accept="image/jpeg,image/png,image/webp" required>
            </label>
            <label class="check">
              <input type="checkbox" name="consent" checked required>
              <span>I certify this document is genuine and current.</span>
            </label>
            <button type="submit" class="button btn-orange">Upload Compliance Document</button>
          </form>
        </section>

        <section class="panel">
          <div class="verification-label">GOVERNMENT GATEWAY</div>
          <h3>Fetch directly from DigiLocker</h3>
          <p class="text-muted">Connect with <code>digilocker.meripehchaan.gov.in</code> when live production gateway credentials are enabled.</p>

          <form id="digilocker-form" class="form-stack">
            <label class="check">
              <input name="consent" type="checkbox" required>
              <span>I consent to Safar retrieving my verification records through DigiLocker.</span>
            </label>
            <button type="submit" class="button btn-outline" ${!info.configured ? 'disabled' : ''}>
              ${info.configured ? 'Continue with DigiLocker' : 'DigiLocker Gateway (Use Form Above)'}
            </button>
          </form>
        </section>
      </div>
    ` : ''}`;
}

async function generateDemoPortraitBlob(labelText = 'SAFAR VERIFIED SELFIE') {
  const canvas = document.createElement('canvas');
  canvas.width = 640;
  canvas.height = 640;
  const ctx = canvas.getContext('2d');
  const grad = ctx.createLinearGradient(0, 0, 640, 640);
  grad.addColorStop(0, '#3B123F');
  grad.addColorStop(1, '#F07818');
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
  $$('.view-user-doc-btn').forEach(btn => {
    btn.onclick = async () => {
      showDialog(`
        <h3>${esc(btn.dataset.kind)} Verification Document</h3>
        <div id="user-doc-view-box" style="padding:16px;background:var(--line-soft);border-radius:var(--r);margin-top:12px;text-align:center">
          Loading document evidence…
        </div>`);
      await renderOriginalEvidence($('#user-doc-view-box'), '/kyc/documents/' + encodeURIComponent(btn.dataset.id) + '/evidence', btn.dataset.kind);
    };
  });
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
    if (statusEl) statusEl.textContent = `✓ Live selfie ready (${Math.round(file.size / 1024)} KB) — Click Verify Identity!`;
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
      toast('Camera not available on this device — loaded demo portrait.', true);
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
    toast('Demo selfie loaded. Click Submit for Verification.');
  });

  if ($('#kyc-facematch-form')) {
    bindForm('#kyc-facematch-form', async (data, form) => {
      const submitBtn = $('#kyc-facematch-submit');
      if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.textContent = 'Submitting for verification…';
      }
      try {
        // A real selfie is required; a generated portrait is only a stand-in in local demo mode.
        if (!capturedSelfieFile && !user?.demoVerification) throw new Error('Take or upload your live selfie first.');
        if (!capturedSelfieFile) capturedSelfieFile = await generateDemoPortraitBlob(`${user?.firstName || 'DRIVER'} LIVE SELFIE`);
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
        toast(result.autoVerified ? 'Driver verified.' : 'Submitted. A Safar administrator will review your documents and selfie.');
        await dashboard('kyc', true);
      } finally {
        if (submitBtn) {
          submitBtn.disabled = false;
          submitBtn.textContent = 'Submit for Verification';
        }
      }
    });
  }

  if ($('#digilocker-form')) {
    bindForm('#digilocker-form', async () => {
      const session = await post('/kyc/sessions', { consent: true });
      location.assign(session.authorizationUrl);
    });
  }

  if ($('#doc-upload-form')) {
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
      toast('Document uploaded and submitted for verification.');
    });
  }
}

/* ─── HOST PARTNER PRO CONSOLE ───────────────────────────────────────── */
async function host(tab, focusVehicleId) {
  if (!requireUser(['HOST','DEALER','ADMIN'])) return;
  tab = HOST_SECTION_IDS.includes(tab) ? tab : hostSectionFromUrl();
  focusVehicleId = focusVehicleId || new URLSearchParams(location.search).get('vehicle') || '';
  const [vehicles, savedPayoutAccount, hosted] = await Promise.all([
    api('/vehicles/mine'),
    api('/payouts/account').catch(() => null),
    api('/bookings/host-bookings').catch(() => []),
  ]);
  const activeFleet = vehicles.filter(v => v.approvalStatus === 'APPROVED' && v.availability === 'ACTIVE').length;
  const pendingFleet = vehicles.filter(v => v.approvalStatus === 'PENDING_APPROVAL').length;
  const activeTrips = hosted.filter(b => b.status === 'ACTIVE').length;
  const settledBookings = hosted.filter(b => ['SUCCESS', 'PAID'].includes(b.payment?.status));
  const grossEarnings = settledBookings.reduce((sum, b) => sum + Number(b.baseFare || b.totalAmount || 0), 0);
  const netHostRevenue = settledBookings.reduce((sum, b) => sum + Number(b.hostRevenue || 0), 0);
  const platformFeeTotal = settledBookings.reduce((sum, b) => sum + Number(b.platformFee || 0), 0);
  // The endpoint returns an empty body when no account exists, which api() turns into {}; treat that as "none".
  const payoutAccount = savedPayoutAccount?.id ? savedPayoutAccount : null;
  const dealer = user.role === 'DEALER';

  $('#app').innerHTML = `
    <div id="host-head">${sectionHead(HOST_SECTION_HEADS[tab][0], HOST_SECTION_HEADS[tab][1], dealer ? 'DEALER FLEET' : 'HOST FLEET')}</div>
    <div class="pro-kpi-ribbon" data-testid="host-kpis">
      <div class="pro-kpi-card"><span class="kpi-label">Accepting Bookings</span><strong class="kpi-value">${activeFleet} / ${vehicles.length}</strong><span class="kpi-sub">${pendingFleet} awaiting admin review</span></div>
      <div class="pro-kpi-card"><span class="kpi-label">Live Trips</span><strong class="kpi-value">${activeTrips}</strong><span class="kpi-sub">${hosted.length} total reservations</span></div>
      <div class="pro-kpi-card"><span class="kpi-label">Paid Trip Fare</span><strong class="kpi-value">${money(grossEarnings)}</strong><span class="kpi-sub">Bookings with a completed payment</span></div>
      <div class="pro-kpi-card"><span class="kpi-label">Your Share</span><strong class="kpi-value" style="color:var(--ok);">${money(netHostRevenue)}</strong><span class="kpi-sub">Platform fee: ${money(platformFeeTotal)}</span></div>
      <div class="pro-kpi-card"><span class="kpi-label">Payout Account</span><strong class="kpi-value" style="font-size:18px;">${payoutAccount ? (payoutAccount.verificationCurrent ? 'Verified' : 'Awaiting check') : 'Not set'}</strong><span class="kpi-sub">${payoutAccount ? esc(payoutAccount.bankName + ' ••' + payoutAccount.accountNumberLast4) : 'Add bank details under Payouts'}</span></div>
    </div>

    <section id="host-section-fleet" hidden>
      ${vehicles.length ? `<div class="admin-vehicle-grid">` + vehicles.map(v => {
        return `
        <article class="panel admin-vehicle-tile">
          <div class="admin-tile-media">
            <img loading="lazy" ${vehicleImageSlot(vehicleCoverUrl(v))} alt="${esc(v.make + ' ' + v.model)}">
            <div class="admin-tile-badge">${stateChip(...(APPROVAL_CHIP[v.approvalStatus] || ['Draft', 'muted']))}</div>
          </div>
          <div class="admin-tile-content">
            <div class="admin-tile-header">
            <div>
              <h3>${esc(v.make + ' ' + v.model + ' ' + v.year)}</h3>
              <p class="text-muted">${esc(v.registrationNumber || 'Pending Reg')} · ${esc(v.locationCity)}</p>
              <p class="admin-tile-price"><strong>${money(v.pricePerDay)}</strong> <span class="text-muted" style="font-size:12px">/ day</span></p>
            </div>

          </div>
          <p>Approval and availability: ${vehicleStateBadges(v)}</p>
          ${v.eligibility?.bookable ? '<p class="text-muted" data-testid="vehicle-bookable">Accepting new bookings.</p>' : `<p class="text-muted">Not accepting new bookings:</p>${eligibilityList(v.eligibility?.reasons)}`}
          ${v.approvalStatus === 'REJECTED' && v.rejectedReason ? `<p class="error">Rejection reason: ${esc(v.rejectedReason)}</p>` : ''}
          <p class="tile-review-note"><span>Reviewer note</span>${esc(v.reviewNote || 'Awaiting document and listing review by administrator.')}</p>
          ${v.availability !== 'ACTIVE' && ADMIN_RESTRICTIONS.includes(v.availabilityReason) ? `<p class="tile-restriction" data-testid="admin-restriction">${esc(eligibilityText('RESTRICTED_' + v.availabilityReason))}.</p>` : ''}
          <div class="admin-tile-actions">
            ${['DRAFT', 'REJECTED'].includes(v.approvalStatus) ? `<button type="button" class="button btn-orange btn-sm vehicle-submit" data-id="${esc(v.id)}">Submit for review</button>` : ''}
            ${v.availability === 'ACTIVE'
              ? `<button type="button" class="button btn-outline btn-sm vehicle-availability" data-id="${esc(v.id)}" data-to="INACTIVE">Pause new bookings</button>`
              : ADMIN_RESTRICTIONS.includes(v.availabilityReason) ? ''
              : v.approvalStatus === 'APPROVED' ? `<button type="button" class="button btn-outline btn-sm vehicle-availability" data-id="${esc(v.id)}" data-to="ACTIVE">Accept bookings</button>` : ''}
            <a class="button btn-ghost btn-sm" href="host-onboarding.html?tab=documents&amp;vehicle=${encodeURIComponent(v.id)}" data-host-goto="documents" data-vehicle="${esc(v.id)}">Car documents →</a>
            <button type="button" class="button btn-outline btn-sm host-schedule" data-id="${esc(v.id)}">Manage availability</button>
            <a class="button btn-ghost btn-sm" href="host-agreement.html?id=${encodeURIComponent(v.id)}">Host–Safar agreement</a>
          </div>
          </div>
        </article>`;
      }).join('') + `</div>` : empty('No cars listed yet', 'Use Add Car in the menu to register your first self-drive car.')}
    </section>

    <section id="host-section-add" hidden>
      <form id="car-listing-form">
        <div class="panel" style="margin-bottom:20px;">
          <h3>01 · Vehicle Specifications &amp; Pricing</h3>
          <div class="form-grid">
            ${inp('registrationNumber','Registration Number','text','placeholder="e.g. GJ01AB1234" maxlength="16"')}
            ${inp('locationCity','Hub / City Location','text','placeholder="e.g. Ahmedabad"')}
            ${inp('make','Make / Brand','text','placeholder="e.g. Hyundai"')}
            ${inp('model','Model','text','placeholder="e.g. Creta SX"')}
            ${inp('year','Year of Manufacture','number',`min="2015" max="${new Date().getFullYear()+1}"`)}
            ${sel('category','Vehicle Segment',['Hatchback','Sedan','Compact SUV','SUV','MUV','Luxury','EV'])}
            ${sel('transmission','Transmission',['Manual','Automatic'])}
            ${sel('fuelType','Fuel Type',['Petrol','Diesel','Electric','CNG','Hybrid'])}
            ${inp('seats','Seating Capacity','number','min="2" max="12"')}
            ${inp('pricePerDay','24-Hour Base Rate (₹)','number','min="500" max="1000000" step="1"')}
            ${inp('odometer','Current Odometer (km)','number','min="0" max="2000000"')}
          </div>
        </div>

        <div class="panel" style="margin-bottom:20px;">
          <div class="camera-hero-banner">
            <div class="cam-banner-content">
              <div class="cam-icon-box">${icon('camera', 'ic-lg')}</div>
              <div>
                <h3 style="margin:0 0 4px 0;font-size:18px;">02 · Mandatory 8-Angle Vehicle Inspection</h3>
                <p style="margin:0;font-size:13px;color:var(--ink-2);">Capture photos directly using your mobile camera on-site, or upload existing photos from your files.</p>
              </div>
            </div>
            <div class="cam-banner-actions">
              <button type="button" id="btn-walkaround-cam" class="button btn-orange">
                ${icon('camera')} 📱 Start Guided Camera Walkaround
              </button>
            </div>
          </div>

          <div class="cam-progress-wrap" style="margin:16px 0 20px;">
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;">
              <span id="photo-progress" style="font-weight:700;color:var(--brand);font-size:13.5px;">0 of 8 vehicle angles captured</span>
              <span id="photo-progress-pct" style="font-size:12px;font-weight:600;color:var(--ink-2);">0% complete</span>
            </div>
            <div class="cam-progress-track">
              <div id="photo-progress-bar" class="cam-progress-fill" style="width:0%;"></div>
            </div>
          </div>

          <div class="photo-grid">
            ${PHOTO_ANGLES.map(kind => {
              const guide = {
                FRONT: 'Full front 45° angle & bumper',
                REAR: 'Full rear bumper & number plate',
                LEFT: 'Driver side full length',
                RIGHT: 'Passenger side full length',
                INTERIOR: 'Dashboard, steering & front seats',
                BOOT: 'Trunk open with spare tyre',
                BONNET: 'Engine bay open under bonnet',
                ODOMETER: 'Speedometer with current km reading'
              }[kind] || `${kind} view`;

              return `
              <div class="photo-slot" id="slot-${kind}" data-angle="${kind}">
                <div class="slot-header">
                  <strong>${kind} VIEW</strong>
                  <small class="slot-guide">${guide}</small>
                </div>

                <div class="slot-preview-area">
                  <img hidden alt="${kind} preview" id="img-${kind}">
                  <div class="slot-placeholder" id="ph-${kind}">
                    <span class="slot-cam-icon">${icon('camera', 'ic-lg')}</span>
                    <span class="slot-hint">Tap Camera to capture directly</span>
                  </div>
                </div>

                <div class="slot-actions" id="actions-${kind}">
                  <button type="button" class="button btn-orange btn-sm btn-slot-camera" data-angle="${kind}">
                    ${icon('camera')} Camera
                  </button>
                  <button type="button" class="btn-ghost btn-sm btn-slot-upload" data-angle="${kind}">
                    📁 Upload
                  </button>
                </div>

                <div class="slot-done-meta" hidden id="meta-${kind}">
                  <span class="badge ok">${icon('checkCircle')} Ready</span>
                  <div style="display:flex;gap:6px;align-items:center;">
                    <button type="button" class="btn-ghost btn-sm btn-slot-retake" data-angle="${kind}">${icon('camera')} Retake</button>
                    <button type="button" class="btn-ghost btn-sm btn-slot-remove" data-angle="${kind}" style="color:var(--err,#DC2626);">✕</button>
                  </div>
                </div>

                <!-- Hidden camera input with capture="environment" for direct mobile camera launch -->
                <input type="file" id="cam-${kind}" accept="image/*" capture="environment" hidden>
                <!-- Standard file input for form serialization & validation -->
                <input type="file" name="${kind}" id="file-${kind}" accept="image/jpeg,image/png,image/webp" hidden>
              </div>`;
            }).join('')}
          </div>
        </div>

        <div class="panel">
          <label class="check">
            <input type="checkbox" required>
            <span>I certify that I am the authorised owner/host of this vehicle and agree to the commercial terms shown in the Safar Host Partner Agreement.</span>
          </label>
          <div class="actions" style="margin-top:14px;">
            <button type="submit" class="button btn-orange">Register Vehicle &amp; Upload RC/Insurance →</button>
          </div>
          <p class="text-muted" style="margin-top:10px">An administrator reviews the photos, RC, Insurance and PUC. Once the car is approved, you choose when it accepts bookings.</p>
        </div>
      </form>
    </section>
    <section id="host-section-documents" hidden>
      <p class="notice info car-docs-intro">Upload the original RC, Insurance and PUC for each car. A Safar administrator checks every document; a car can be approved only when all three are verified. ${user?.demoVerification ? 'Local demo mode is on: labelled demo records count on this machine only, never in production.' : 'Demo records and documents without a file never count.'}</p>
      ${vehicles.length ? vehicles.map(carDocumentsCard).join('') : empty('No cars yet', 'Add a car first, then upload its documents here.')}
    </section>

    <section id="host-section-bookings" hidden>
      <section class="panel">${renderBookingTable(hosted, true)}</section>
    </section>

    <section id="host-section-payouts" hidden>
    <section class="panel payout-panel">
      <div class="heading"><div><h3>Payout account</h3><p class="text-muted">Keep your bank details ready for verified host/dealer settlements.</p></div>${payoutAccount ? badge(payoutAccount.status) : badge('NOT_SUBMITTED')}</div>
      ${payoutAccount ? `<p class="text-muted">${esc(payoutAccount.bankName)} · Account ending ${esc(payoutAccount.accountNumberLast4)} · IFSC ${esc(payoutAccount.ifscCode)}.</p>
      <p class="text-muted" data-testid="payout-verification-note">${payoutAccount.verificationCurrent ? 'Verified by Safar for these details.' : 'Awaiting verification by a Safar administrator. Payouts stay on hold until these details are verified.'} Changing any bank detail requires a new verification, and payouts already created keep the bank account they were created for.</p>` : '<p class="text-muted">No payout account has been submitted yet. Account numbers are encrypted and only the last four digits are shown after saving.</p>'}
      <form id="payout-account-form" class="form-grid">
        ${inp('accountHolderName','Account holder name')}
        ${inp('bankName','Bank name')}
        ${inp('accountNumber','Account number','text','inputmode="numeric" autocomplete="off" maxlength="18"')}
        ${inp('ifscCode','IFSC code','text','maxlength="11" autocomplete="off"')}
        <div class="actions"><button type="submit" class="button btn-orange">Save payout details</button></div>
      </form>
    </section>
    </section>`;

  // Header menu, fleet "Car documents" links: switch section in place.
  $$('#header [data-host-tab], [data-host-goto]').forEach(a => a.onclick = event => {
    event.preventDefault();
    showHostSection(a.dataset.hostTab || a.dataset.hostGoto, a.dataset.vehicle);
  });
  $$('.car-doc-upload').forEach(b => b.onclick = () => openCarDocumentUpload(vehicles.find(v => v.id === b.dataset.vehicle), b.dataset.kind));
  $$('.car-doc-view').forEach(b => b.onclick = () => openOwnDocument(b.dataset.id, b.dataset.kind));
  bindBookingEvents();
  showHostSection(tab, focusVehicleId);

  $$('.host-schedule').forEach(button => button.onclick = () => openVehicleSchedule(vehicles.find(item => item.id === button.dataset.id)));
  const showFleet = async message => { toast(message); await host('fleet'); };
  $$('.vehicle-availability').forEach(button => button.onclick = async () => {
    const pausing = button.dataset.to === 'INACTIVE';
    if (pausing && !confirm('Pause new bookings for this car? Existing bookings and payments are kept; upcoming trips are flagged for Safar to review.')) return;
    button.disabled = true;
    try {
      await post('/vehicles/' + encodeURIComponent(button.dataset.id) + '/availability', { availability: button.dataset.to });
      await showFleet(pausing ? 'New bookings paused. Existing bookings are unchanged.' : 'The car is accepting bookings again.');
    } catch (err) { button.disabled = false; toast(errorWithReasons(err), true); }
  });
  $$('.vehicle-submit').forEach(button => button.onclick = async () => {
    button.disabled = true;
    try { await post('/vehicles/' + encodeURIComponent(button.dataset.id) + '/submit', {}); await showFleet('Submitted for administrator review.'); }
    catch (err) { button.disabled = false; toast(err.message, true); }
  });

  bindForm('#payout-account-form', async data => {
    await post('/payouts/account', data);
    toast('Payout account submitted for verification.');
    await host('payouts');
  });

  const capturedVehiclePhotos = new Map();

  function updatePhotoProgress() {
    const count = PHOTO_ANGLES.filter(k => capturedVehiclePhotos.has(k) || $(`#file-${k}`)?.files?.length).length;
    const pct = Math.round((count / PHOTO_ANGLES.length) * 100);
    const progEl = $('#photo-progress');
    const pctEl = $('#photo-progress-pct');
    const barEl = $('#photo-progress-bar');
    if (progEl) progEl.textContent = `${count} of ${PHOTO_ANGLES.length} vehicle angles captured`;
    if (pctEl) pctEl.textContent = `${pct}% complete`;
    if (barEl) barEl.style.width = `${pct}%`;
  }

  function applyPhotoToSlot(kind, file, source = 'camera') {
    if (!file) return;
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type) && !file.type.startsWith('image/')) {
      toast('Please choose a JPEG, PNG or WebP image.', true);
      return;
    }
    if (file.size > 8 * 1024 * 1024) {
      toast('Photo size too large (max 8 MB).', true);
      return;
    }

    capturedVehiclePhotos.set(kind, file);

    // Sync to form input using DataTransfer where supported
    const fileInput = $(`#file-${kind}`);
    if (fileInput) {
      try {
        const dt = new DataTransfer();
        dt.items.add(file);
        fileInput.files = dt.files;
      } catch (err) {}
    }

    const slot = $(`#slot-${kind}`);
    if (!slot) return;
    const img = $(`#img-${kind}`);
    const ph = $(`#ph-${kind}`);
    const actions = $(`#actions-${kind}`);
    const meta = $(`#meta-${kind}`);

    if (img) {
      if (img.dataset.url) URL.revokeObjectURL(img.dataset.url);
      img.dataset.url = URL.createObjectURL(file);
      img.src = img.dataset.url;
      img.hidden = false;
    }
    if (ph) ph.hidden = true;
    if (actions) actions.hidden = true;
    if (meta) meta.hidden = false;

    slot.classList.add('slot-done');
    updatePhotoProgress();
    toast(`✓ ${kind} photo captured (${Math.round(file.size / 1024)} KB)`);
  }

  function clearSlotPhoto(kind) {
    capturedVehiclePhotos.delete(kind);
    const fileInput = $(`#file-${kind}`);
    const camInput = $(`#cam-${kind}`);
    if (fileInput) fileInput.value = '';
    if (camInput) camInput.value = '';

    const slot = $(`#slot-${kind}`);
    if (!slot) return;
    const img = $(`#img-${kind}`);
    const ph = $(`#ph-${kind}`);
    const actions = $(`#actions-${kind}`);
    const meta = $(`#meta-${kind}`);

    if (img) {
      if (img.dataset.url) URL.revokeObjectURL(img.dataset.url);
      img.hidden = true;
      img.removeAttribute('src');
    }
    if (ph) ph.hidden = false;
    if (actions) actions.hidden = false;
    if (meta) meta.hidden = true;

    slot.classList.remove('slot-done');
    updatePhotoProgress();
  }

  let isWalkaroundActive = false;

  function advanceWalkaround() {
    const nextKind = PHOTO_ANGLES.find(k => !capturedVehiclePhotos.has(k) && !($(`#file-${k}`)?.files?.length));
    if (!nextKind) {
      isWalkaroundActive = false;
      $$('.photo-slot').forEach(s => s.classList.remove('slot-active-walkaround'));
      toast('🎉 All 8 vehicle angles captured! Review and submit your listing.');
      return;
    }

    const idx = PHOTO_ANGLES.indexOf(nextKind);
    $$('.photo-slot').forEach(s => s.classList.remove('slot-active-walkaround'));
    const targetSlot = $(`#slot-${nextKind}`);
    if (targetSlot) {
      targetSlot.classList.add('slot-active-walkaround');
      targetSlot.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }

    const guide = {
      FRONT: 'Step in front of the vehicle (45° angle showing bumper & number plate)',
      REAR: 'Step to the back of the car (showing boot, tail lights & rear plate)',
      LEFT: 'Step to the driver side (full length profile showing doors & wheels)',
      RIGHT: 'Step to the passenger side (full length profile showing doors & wheels)',
      INTERIOR: 'Open the driver door and capture dashboard, steering & seats',
      BOOT: 'Open the trunk/boot (showing luggage area & spare tyre)',
      BONNET: 'Pop open the hood/bonnet (showing clean engine bay)',
      ODOMETER: 'Turn on ignition and capture the speedometer / odometer km readout'
    }[nextKind] || `Capture ${nextKind} view`;

    toast(`📸 Step ${idx + 1} of 8: ${guide}`);
    setTimeout(() => {
      $(`#cam-${nextKind}`)?.click();
    }, 450);
  }

  $('#btn-walkaround-cam')?.addEventListener('click', () => {
    isWalkaroundActive = true;
    advanceWalkaround();
  });

  PHOTO_ANGLES.forEach(kind => {
    $(`.btn-slot-camera[data-angle="${kind}"]`)?.addEventListener('click', () => {
      $(`#cam-${kind}`)?.click();
    });

    $(`.btn-slot-upload[data-angle="${kind}"]`)?.addEventListener('click', () => {
      $(`#file-${kind}`)?.click();
    });

    $(`.btn-slot-retake[data-angle="${kind}"]`)?.addEventListener('click', () => {
      $(`#cam-${kind}`)?.click();
    });

    $(`.btn-slot-remove[data-angle="${kind}"]`)?.addEventListener('click', () => {
      clearSlotPhoto(kind);
    });

    $(`#cam-${kind}`)?.addEventListener('change', (e) => {
      if (e.target.files?.[0]) {
        applyPhotoToSlot(kind, e.target.files[0], 'camera');
        if (isWalkaroundActive) {
          advanceWalkaround();
        }
      }
    });

    $(`#file-${kind}`)?.addEventListener('change', (e) => {
      if (e.target.files?.[0]) {
        applyPhotoToSlot(kind, e.target.files[0], 'file');
        if (isWalkaroundActive) {
          advanceWalkaround();
        }
      }
    });
  });

  bindForm('#car-listing-form', async (data, form) => {
    const hashes = new Set();
    for (const kind of PHOTO_ANGLES) {
      const file = form.elements[kind]?.files?.[0] || capturedVehiclePhotos.get(kind);
      if (!file || !['image/jpeg','image/png','image/webp'].includes(file.type) || file.size > 8 * 1024 * 1024) throw new Error('Choose a JPEG, PNG or WebP up to 8 MB for ' + kind);
      const digest = await crypto.subtle.digest('SHA-256', await file.arrayBuffer());
      const hash = Array.from(new Uint8Array(digest), n => n.toString(16).padStart(2, '0')).join('');
      if (hashes.has(hash)) throw new Error('Each angle needs a different vehicle photo. Repeated image detected at ' + kind + '. Upload RC documents separately.');
      hashes.add(hash);
    }
    const mediaIds = [];
    for (const kind of PHOTO_ANGLES) {
      const file = form.elements[kind]?.files?.[0] || capturedVehiclePhotos.get(kind);
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
    toast('Car registered! Now upload its RC, Insurance and PUC.');
    await host('documents', result.id);
  });
}

/* ─── CUSTOMER ACCOUNT DASHBOARD (ZOOMCAR-STYLE LEFT SIDEBAR + HORIZONTAL BOOKING CARDS) ─── */
function formatBookingStatus(b) {
  return b.status === 'PENDING' && new Date(b.expiresAt) < new Date() ? 'EXPIRED' : b.status;
}

let dashboardCache = null;
let activeBookingFilter = 'ALL';

async function dashboard(defaultTab = 'trips', forceRefresh = true) {
  if (!requireUser()) return;
  const params = new URLSearchParams(location.search);
  const activeTab = params.get('tab') || defaultTab;
  const payBookingId = params.get('pay');

  if (forceRefresh || !dashboardCache) {
    const [trips, hosted, kycInfo, accountInfo, notifications, authoredReviews, allVehicles] = await Promise.all([
      api('/bookings/my-trips').catch(() => []),
      ['HOST','DEALER','ADMIN'].includes(user.role) ? api('/bookings/host-bookings').catch(() => []) : Promise.resolve([]),
      api('/kyc').catch(() => ({ documents: [], sessions: [], environment: 'live', configured: false })),
      api('/account/dashboard').catch(() => null),
      api('/notifications').catch(() => []),
      api('/reviews/mine').catch(() => ({ vehicleReviews: [], partyRatings: [] })),
      api('/vehicles').catch(() => []),
    ]);
    dashboardCache = { trips, hosted, kycInfo, accountInfo, notifications, authoredReviews, allVehicles };
  }

  const { trips, hosted, kycInfo, accountInfo, notifications, authoredReviews, allVehicles } = dashboardCache;
  const disputesCount = accountInfo?.disputes?.length || 0;
  const reviewsCount = (authoredReviews?.vehicleReviews?.length || 0) + (authoredReviews?.partyRatings?.length || 0);
  const initials = ((user.firstName?.[0] || 'S') + (user.lastName?.[0] || '')).toUpperCase();
  const unreadAlerts = (notifications || []).filter(n => !n.readAt).length;

  const sectionContent = activeTab === 'kyc'
    ? renderKycTabHtml(kycInfo)
    : activeTab === 'profile'
    ? renderProfileTabHtml(kycInfo)
    : activeTab === 'disputes'
    ? renderDisputesTabHtml(trips, accountInfo)
    : activeTab === 'history'
    ? renderHistoryTabHtml(trips)
    : activeTab === 'reviews'
    ? renderReviewsTabHtml(authoredReviews, trips)
    : activeTab === 'saved'
    ? renderSavedAndAlertsTabHtml(allVehicles, notifications)
    : renderTripsTabHtml(trips, hosted, accountInfo);
  // Customers reach each section from the header menu or the account menu, so the page shows only that section.
  if (user.role === 'CUSTOMER') {
    const [title, intro] = CUSTOMER_SECTION_HEADS[activeTab] || CUSTOMER_SECTION_HEADS.trips;
    $('#app').innerHTML = `${sectionHead(title, intro, 'MY ACCOUNT')}<div id="account-tab-content" data-section="${esc(activeTab)}">${sectionContent}</div>`;
  } else $('#app').innerHTML = `
    <div class="acct-shell">
      <!-- LEFT ACCOUNT SIDEBAR -->
      <aside class="acct-side">
        <div class="acct-profile-box">
          <div class="acct-avatar">${esc(initials)}</div>
          <strong class="acct-name">${esc(user.firstName + ' ' + user.lastName)}</strong>
          <span class="acct-sub">${esc(user.phone || '+91 Verified Member')}</span>
          <span class="acct-sub">${esc(user.email)}</span>
        </div>

        <div class="acct-verify-list">
          <div class="acct-verify-row">
            <span>Profile Document</span>
            <strong class="${user.isVerified ? 'ok' : 'warn'}">${user.isVerified ? '✓ Verified' : 'Pending'}</strong>
          </div>
          <div class="acct-verify-row">
            <span>Mobile Number</span>
            <strong class="${user.phoneVerifiedAt ? 'ok' : 'warn'}">${user.phoneVerifiedAt ? '✓ Verified' : 'Not verified'}</strong>
          </div>
          <div class="acct-verify-row">
            <span>Driving Licence</span>
            <strong class="${user.isVerified ? 'ok' : 'warn'}">${user.isVerified ? '✓ Verified' : 'Action Needed'}</strong>
          </div>
        </div>

        <nav class="acct-menu" aria-label="Account navigation">
          <button type="button" class="acct-menu-btn ${activeTab === 'trips' ? 'active' : ''}" data-account-tab="trips">
            <span class="acct-menu-lbl">${icon('calendar')} My Bookings</span>
            <span class="acct-menu-badge">${trips.length}</span>
          </button>
          <button type="button" class="acct-menu-btn ${activeTab === 'profile' ? 'active' : ''}" data-account-tab="profile">
            <span class="acct-menu-lbl">${icon('user')} Account Information</span>
          </button>
          <button type="button" class="acct-menu-btn ${activeTab === 'kyc' ? 'active' : ''}" data-account-tab="kyc">
            <span class="acct-menu-lbl">${icon('idcard')} KYC &amp; Verification</span>
            <span class="acct-menu-badge">${user.isVerified ? '✓' : '!'}</span>
          </button>
          <button type="button" class="acct-menu-btn ${activeTab === 'disputes' ? 'active' : ''}" data-account-tab="disputes">
            <span class="acct-menu-lbl">${icon('scale')} Booking Disputes</span>
            ${disputesCount ? `<span class="acct-menu-badge">${disputesCount}</span>` : ''}
          </button>
          <button type="button" class="acct-menu-btn ${activeTab === 'reviews' ? 'active' : ''}" data-account-tab="reviews">
            <span class="acct-menu-lbl">${icon('star')} Reviews &amp; Ratings</span>
            ${reviewsCount ? `<span class="acct-menu-badge">${reviewsCount}</span>` : ''}
          </button>
          <button type="button" class="acct-menu-btn ${activeTab === 'history' ? 'active' : ''}" data-account-tab="history">
            <span class="acct-menu-lbl">${icon('history')} Trip &amp; Damage History</span>
          </button>
          <button type="button" class="acct-menu-btn ${activeTab === 'saved' ? 'active' : ''}" data-account-tab="saved">
            <span class="acct-menu-lbl">${icon('car')} Saved Vehicles &amp; Alerts</span>
            ${unreadAlerts ? `<span class="acct-menu-badge">${unreadAlerts}</span>` : ''}
          </button>
        </nav>

        <div style="padding:14px 18px;border-top:1px solid var(--border-main)">
          <button type="button" id="sidebar-logout-btn" class="btn-outline btn-sm" style="width:100%;justify-content:center">
            ${icon('logout')} Sign Out
          </button>
        </div>
      </aside>

      <!-- RIGHT MAIN WORKSPACE -->
      <div class="acct-main" id="account-tab-content" data-section="${esc(activeTab)}">
        ${sectionContent}
      </div>
    </div>`;

  $('#sidebar-logout-btn')?.addEventListener('click', async () => {
    localStorage.removeItem('safar_token');
    await post('/auth/logout').catch(() => {});
    location.href = 'index.html';
  });

  if (activeTab === 'trips') {
    bindBookingEvents();
    $$('[data-bk-filter]').forEach(btn => {
      btn.onclick = () => {
        activeBookingFilter = btn.dataset.bkFilter;
        dashboard('trips', false);
      };
    });
    if (payBookingId) {
      const targetBooking = trips.find(b => b.id === payBookingId);
      if (targetBooking && formatBookingStatus(targetBooking) === 'PENDING') {
        setTimeout(() => openBookingPaymentModal(targetBooking), 150);
      }
    }
  }
  if (activeTab === 'kyc') bindKycEvents(kycInfo);
  if (activeTab === 'disputes') bindDisputeEvents();
  if (activeTab === 'reviews') bindReviewEvents();
  if (activeTab === 'profile') {
    bindProfileEvents();
    $('#profile-logout-btn')?.addEventListener('click', async () => {
      localStorage.removeItem('safar_token');
      await post('/auth/logout').catch(() => {});
      location.href = 'index.html';
    });
  }
  if (activeTab === 'saved') bindNotificationEvents();
}

function renderSavedAndAlertsTabHtml(allVehicles, items) {
  const notifications = Array.isArray(items) ? items : [];
  const unread = notifications.filter(item => !item.readAt).length;
  const featured = (allVehicles || []).slice(0, 3);
  return `
    <section class="panel" style="margin-bottom:20px;">
      <div style="display:flex;justify-content:space-between;align-items:center;gap:12px;flex-wrap:wrap;">
        <div>
          <h3 style="margin:0">Account Notifications &amp; Activity Alerts ${unread ? `<span class="badge warn">${unread} unread</span>` : ''}</h3>
          <p class="text-muted" style="margin:4px 0 0">Booking confirmations, digital lease updates, handover inspections, and deposit settlements.</p>
        </div>
        ${unread ? '<button type="button" class="button btn-outline btn-sm" id="mark-all-notifications">Mark all read</button>' : ''}
      </div>
      <div class="notification-list" style="display:grid;gap:10px;margin-top:16px;">
        ${notifications.length ? notifications.map(item => `
          <article class="notification-item ${item.readAt ? '' : 'is-unread'}" data-notification-id="${esc(item.id)}" style="padding:12px 14px;border:1px solid var(--border-main);border-radius:12px;background:var(--bg-subtle);">
            <div style="display:flex;justify-content:space-between;gap:12px;align-items:flex-start;">
              <strong>${esc(item.title)}</strong>
              ${item.readAt ? '<span class="text-muted" style="font-size:11px">Read</span>' : '<span class="badge warn">NEW</span>'}
            </div>
            <p style="margin:5px 0;color:var(--text-main);font-size:13.5px">${esc(item.message)}</p>
            <small class="text-muted">${dt(item.createdAt)}${item.readAt ? '' : ' · Click to mark read'}</small>
          </article>`).join('') : '<p class="text-muted" style="margin:14px 0 0">No notifications yet.</p>'}
      </div>
    </section>

    <section class="panel">
      <div style="display:flex;justify-content:space-between;align-items:center;gap:12px;flex-wrap:wrap;margin-bottom:14px">
        <div>
          <h3 style="margin:0">Recommended &amp; Quick-Rebook Vehicles</h3>
          <p class="text-muted" style="margin:4px 0 0">Verified fleet vehicles ready for immediate self-drive reservation.</p>
        </div>
        <a href="cars.html" class="button btn-outline btn-sm">Browse All Vehicles</a>
      </div>
      <div class="car-grid">${featured.map(carCard).join('')}</div>
    </section>`;
}

function bindNotificationEvents() {
  $$('.notification-item.is-unread').forEach(item => item.onclick = async () => {
    try { await post('/notifications/' + encodeURIComponent(item.dataset.notificationId) + '/read', {}); item.classList.remove('is-unread'); item.querySelector('.badge')?.remove(); item.querySelector('small').textContent = item.querySelector('small').textContent.replace(' · Click to mark read', ''); }
    catch (error) { toast(error.message, true); }
  });
  $('#mark-all-notifications')?.addEventListener('click', async () => {
    try { await post('/notifications/read-all', {}); await dashboard('saved', true); }
    catch (error) { toast(error.message, true); }
  });
}

function switchAccountTab(tabName) {
  const url = new URL(location.href);
  url.searchParams.set('tab', tabName);
  url.searchParams.delete('pay');
  history.replaceState(null, '', url.toString());
  syncCustomerMenu();
  $$('#mobile-bnav .bnav-item').forEach(a => a.classList.toggle('active', a.getAttribute('href') === 'dashboard.html?tab=' + tabName));
  dashboard(tabName, false);
}

function renderTripsTabHtml(trips, hosted, accountInfo) {
  const filterCounts = {
    ALL: trips.length,
    UPCOMING: trips.filter(b => formatBookingStatus(b) === 'CONFIRMED').length,
    ONGOING: trips.filter(b => formatBookingStatus(b) === 'ACTIVE').length,
    COMPLETED: trips.filter(b => formatBookingStatus(b) === 'COMPLETED').length,
    PENDING: trips.filter(b => formatBookingStatus(b) === 'PENDING').length,
    CANCELLED: trips.filter(b => ['CANCELLED', 'EXPIRED'].includes(formatBookingStatus(b))).length,
  };

  const filteredTrips = trips.filter(b => {
    const st = formatBookingStatus(b);
    if (activeBookingFilter === 'UPCOMING') return st === 'CONFIRMED';
    if (activeBookingFilter === 'ONGOING') return st === 'ACTIVE';
    if (activeBookingFilter === 'COMPLETED') return st === 'COMPLETED';
    if (activeBookingFilter === 'PENDING') return st === 'PENDING';
    if (activeBookingFilter === 'CANCELLED') return ['CANCELLED', 'EXPIRED'].includes(st);
    return true;
  });

  return `
    ${!user.isVerified ? `
      <div class="notice" style="margin-bottom:18px;display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:12px;">
        <div><strong>Driver Verification Pending:</strong> Complete your Aadhaar, Driving Licence, and Selfie verification to unlock self-drive bookings.</div>
        <button type="button" data-account-tab="kyc" class="button btn-sm btn-orange">Complete KYC Verification</button>
      </div>` : ''}

    <div class="panel" style="margin-bottom:20px;">
      <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:12px;margin-bottom:16px;">
        <div>
          <h3 style="margin:0;">My Bookings</h3>
          <p class="text-muted" style="margin:4px 0 0;">View upcoming, ongoing, and completed self-drive trips, download agreements and invoices, or complete handover inspections.</p>
        </div>
        <a class="button btn-orange btn-sm" href="cars.html">+ New Booking</a>
      </div>

      <!-- Booking Status Filter Pills -->
      <div class="bk-filter-bar">
        <button type="button" class="chip ${activeBookingFilter === 'ALL' ? 'active' : ''}" data-bk-filter="ALL">All Bookings (${filterCounts.ALL})</button>
        <button type="button" class="chip ${activeBookingFilter === 'UPCOMING' ? 'active' : ''}" data-bk-filter="UPCOMING">Upcoming (${filterCounts.UPCOMING})</button>
        <button type="button" class="chip ${activeBookingFilter === 'ONGOING' ? 'active' : ''}" data-bk-filter="ONGOING">Ongoing (${filterCounts.ONGOING})</button>
        <button type="button" class="chip ${activeBookingFilter === 'COMPLETED' ? 'active' : ''}" data-bk-filter="COMPLETED">Completed (${filterCounts.COMPLETED})</button>
        <button type="button" class="chip ${activeBookingFilter === 'PENDING' ? 'active' : ''}" data-bk-filter="PENDING">Pending Payment (${filterCounts.PENDING})</button>
        <button type="button" class="chip ${activeBookingFilter === 'CANCELLED' ? 'active' : ''}" data-bk-filter="CANCELLED">Cancelled (${filterCounts.CANCELLED})</button>
      </div>

      ${filteredTrips.length ? `
        <div class="bk-list">
          ${filteredTrips.map(b => renderHorizontalBookingCard(b)).join('')}
        </div>
      ` : empty('No bookings in this view', '<a href="cars.html" class="button btn-orange btn-sm">Browse Self-Drive Cars</a>')}
    </div>

    ${hosted.length ? `
      <section class="panel" style="margin-top:24px;">
        <h3>Guest Reservations on Your Hosted Fleet</h3>
        ${renderBookingTable(hosted, true)}
      </section>` : ''}`;
}

function renderHorizontalBookingCard(b) {
  const st = formatBookingStatus(b);
  const v = b.vehicle || {};
  const hrs = b.tenureHours || Math.max(1, Math.ceil((new Date(b.endDate) - new Date(b.startDate)) / 3600000));
  const hubCity = v.locationCity || 'Ahmedabad';
  const statusBannerMap = {
    COMPLETED: 'COMPLETED TRIP',
    ACTIVE: 'ONGOING TRIP',
    CONFIRMED: 'UPCOMING CONFIRMED TRIP',
    PENDING: 'PAYMENT PENDING',
    CANCELLED: 'CANCELLED BOOKING',
    EXPIRED: 'EXPIRED HOLD',
  };
  const statusTitle = statusBannerMap[st] || st;
  const coverUrl = v.media?.find(m => m.kind === 'FRONT')?.id
    ? `/api/media/${encodeURIComponent(v.media.find(m => m.kind === 'FRONT').id)}`
    : photoUrl(v);

  return `
    <article class="bk-card">
      <div class="bk-head">
        <div class="bk-head-left">
          <span class="bk-status-label">${esc(statusTitle)}</span>
          <span class="bk-divider">|</span>
          <span class="bk-ref">ID: <strong>${esc(b.bookingRef)}</strong></span>
        </div>
        <div class="bk-head-right">
          ${badge(st)}
          ${b.payment ? badge(b.payment.status) : ''}
        </div>
      </div>

      <div class="bk-body">
        <div class="bk-media">
          <img src="${coverUrl}" alt="${esc((v.make || '') + ' ' + (v.model || 'Vehicle'))}" loading="lazy">
        </div>

        <div class="bk-info">
          <div class="bk-car-header">
            <h4 class="bk-car-title">${esc((v.make || '') + ' ' + (v.model || '') + (v.year ? ' ' + v.year : ''))}</h4>
            <span class="bk-car-meta">${esc(v.registrationNumber || 'Assigned at Hub')} · ${esc(v.transmission || 'Manual')} · ${esc(v.fuelType || 'Petrol')}</span>
          </div>

          <!-- Horizontal Green-Dot to Red-Dot START -> END Timeline -->
          <div class="bk-timeline">
            <div class="bk-tl-point">
              <span class="bk-tl-dot start"></span>
              <div>
                <span class="bk-tl-tag">START</span>
                <strong>${dt(b.startDate)}</strong>
                <small>${esc(hubCity)} Hub</small>
              </div>
            </div>
            <div class="bk-tl-line">
              <span>${hrs} hrs</span>
            </div>
            <div class="bk-tl-point">
              <span class="bk-tl-dot end"></span>
              <div>
                <span class="bk-tl-tag">END</span>
                <strong>${dt(b.endDate)}</strong>
                <small>${esc(hubCity)} Hub</small>
              </div>
            </div>
          </div>
        </div>

        <div class="bk-price-col">
          <span class="bk-price-lbl">Total Amount</span>
          <strong class="bk-price-val">${money(b.totalAmount)}</strong>
          <small class="text-muted">Fare: ${money(b.baseFare)} + Deposit: ${money(b.securityDeposit)}</small>
          <small class="bk-deposit-note">${st === 'COMPLETED' ? '✓ Deposit settled' : 'Refundable security deposit'}</small>
        </div>
      </div>

      <div class="bk-foot">
        <div class="bk-foot-info">
          ${b.inspections?.length
            ? `<span style="color:var(--ok);font-weight:600">✓ ${b.inspections.length}/2 Handover Inspections Recorded</span>`
            : `<span class="text-muted">8-Angle + Selfie inspection required at Pickup &amp; Return</span>`}
        </div>
        <div class="bk-foot-actions">
          ${st === 'PENDING' ? `<button type="button" class="button btn-orange btn-sm pay-booking-btn" data-id="${esc(b.id)}">Pay Now &amp; Confirm</button>` : ''}
          ${['CONFIRMED','ACTIVE'].includes(b.status)
            ? `<button type="button" class="button btn-orange btn-sm inspection-btn" data-id="${esc(b.id)}" data-stage="${b.status === 'CONFIRMED' ? 'PICKUP' : 'RETURN'}">${b.status === 'CONFIRMED' ? 'Start Pickup Inspection' : 'Complete Return Inspection'}</button>` : ''}
          <a class="button btn-outline btn-sm" href="agreement.html?id=${encodeURIComponent(b.id)}">Lease Agreement</a>
          ${b.invoice ? `<a class="button btn-outline btn-sm" href="invoice.html?id=${encodeURIComponent(b.invoice.id)}">Invoice</a>` : ''}
          ${b.status === 'COMPLETED' ? `<button type="button" class="button btn-outline btn-sm review-booking-btn" data-id="${esc(b.id)}">Rate Trip</button>` : ''}
          <button type="button" class="btn-ghost btn-sm" data-account-tab="disputes">Raise Issue</button>
          ${['PENDING','CONFIRMED'].includes(st) && new Date(b.startDate) > new Date()
            ? `<button type="button" class="btn-ghost btn-sm cancel-booking-btn" data-id="${esc(b.id)}" style="color:var(--err)">Cancel</button>` : ''}
        </div>
      </div>
    </article>`;
}

function renderProfileTabHtml(kycInfo) {
  const profile = user.profile || {};
  return `
    <section class="panel">
      <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:12px">
        <div>
          <h3 style="margin:0">Account Information</h3>
          <p class="text-muted" style="margin:4px 0 0">Manage your personal details, contact information, and account security.</p>
        </div>
        ${badge(user.isVerified ? 'VERIFIED PROFILE' : 'PENDING KYC')}
      </div>

      <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(210px,1fr));gap:14px;margin-top:18px;">
        <div style="background:var(--bg-subtle);padding:14px 16px;border-radius:12px;border:1px solid var(--border-main);">
          <span style="font-size:11px;color:var(--text-muted);text-transform:uppercase;font-weight:700;">Full Name</span>
          <p style="font-size:15px;font-weight:700;color:var(--text-main);margin:4px 0 0;">${esc(user.firstName + ' ' + user.lastName)}</p>
        </div>
        <div style="background:var(--bg-subtle);padding:14px 16px;border-radius:12px;border:1px solid var(--border-main);">
          <span style="font-size:11px;color:var(--text-muted);text-transform:uppercase;font-weight:700;">Email &amp; Mobile</span>
          <p style="font-size:14px;font-weight:700;color:var(--text-main);margin:4px 0 0;">${esc(user.email)}<br><small style="color:var(--ok);">${esc(user.phone || 'Not set')} · Verified</small></p>
        </div>
        <div style="background:var(--bg-subtle);padding:14px 16px;border-radius:12px;border:1px solid var(--border-main);">
          <span style="font-size:11px;color:var(--text-muted);text-transform:uppercase;font-weight:700;">Identity Verification</span>
          <p style="margin:4px 0 0;">${badge(user.isVerified ? 'APPROVED' : 'PENDING')} ${user.faceMatchScore ? `<strong style="margin-left:6px;color:var(--ok);">${Number(user.faceMatchScore).toFixed(1)}%</strong>` : ''}</p>
        </div>
        <div style="background:var(--bg-subtle);padding:14px 16px;border-radius:12px;border:1px solid var(--border-main);">
          <span style="font-size:11px;color:var(--text-muted);text-transform:uppercase;font-weight:700;">Aadhaar &amp; DL Reference</span>
          <p style="font-size:13.5px;font-weight:700;color:var(--text-main);margin:4px 0 0;">${esc(user.aadhaarMasked || 'Masked reference unavailable')}<br><small class="text-muted">DL Valid: ${user.dlValidUntil ? d(user.dlValidUntil) : 'Expiry not recorded'}</small></p>
        </div>
      </div>

      <div class="form-grid" style="margin-top:22px;">
        <form id="account-profile-form" class="form-stack panel-subtle">
          <h4 style="margin:0">Personal &amp; Address Details</h4>
          <div class="form-grid">
            ${inp('firstName', 'First Name', 'text', `required maxlength="80" value="${esc(user.firstName || '')}"`)}
            ${inp('lastName', 'Last Name', 'text', `required maxlength="80" value="${esc(user.lastName || '')}"`)}
          </div>
          ${inp('phone', 'Mobile Number', 'tel', `maxlength="20" value="${esc(user.phone || '')}"`)}
          <div class="form-grid">
            ${inp('city', 'City', 'text', `maxlength="80" value="${esc(profile.city || 'Ahmedabad')}"`)}
            ${inp('state', 'State', 'text', `maxlength="80" value="${esc(profile.state || 'Gujarat')}"`)}
          </div>
          ${inp('postalCode', 'PIN / Postal Code', 'text', `maxlength="12" value="${esc(profile.postalCode || '380006')}"`)}
          <button type="submit" class="button btn-orange">Save Changes</button>
        </form>

        <div class="form-stack">
          <form id="account-password-form" class="form-stack panel-subtle">
            <h4 style="margin:0">Password &amp; Security</h4>
            ${inp('currentPassword', 'Current Password', 'password', 'required autocomplete="current-password"')}
            ${inp('newPassword', 'New Password (min 8 chars)', 'password', 'required minlength="8" autocomplete="new-password"')}
            <button type="submit" class="button btn-outline">Update Password</button>
          </form>

          <div class="panel-subtle" style="padding:16px;border-radius:12px;border:1px solid var(--border-main)">
            <h4 style="margin:0 0 8px">Communication Preferences</h4>
            <label class="check" style="margin-bottom:6px"><input type="checkbox" checked> <span>SMS &amp; WhatsApp trip handover updates</span></label>
            <label class="check"><input type="checkbox" checked> <span>Email tax invoices and lease agreements</span></label>
          </div>
        </div>
      </div>

      <div style="margin-top:24px;padding-top:18px;border-top:1px solid var(--border-main);display:flex;justify-content:space-between;align-items:center;gap:12px;flex-wrap:wrap;">
        <div style="display:flex;gap:10px;flex-wrap:wrap">
          <button type="button" id="profile-logout-btn" class="button btn-outline">Sign Out</button>
        </div>
        <button type="button" id="account-delete-btn" class="button btn-ghost" style="color:var(--err)">Request Account Deletion</button>
      </div>
    </section>`;
}

function renderDisputesTabHtml(trips, accountInfo) {
  const disputes = accountInfo?.disputes || [];
  const eligible = trips.filter(item => !['EXPIRED'].includes(formatBookingStatus(item)));
  return `<section class="panel">
    <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:16px;flex-wrap:wrap;">
      <div>
        <h3 style="margin:0">Booking Disputes &amp; Issue Resolution</h3>
        <p class="text-muted" style="margin:4px 0 0">Submit a billing, deposit, vehicle condition, or handover inquiry and track resolution updates.</p>
      </div>
      <span class="badge ${disputes.length ? 'warn' : 'ok'}">${disputes.length} Case${disputes.length === 1 ? '' : 's'}</span>
    </div>
    <form id="account-dispute-form" class="form-stack panel-subtle" style="margin-top:18px;">
      <h4 style="margin:0">Raise a New Dispute</h4>
      ${eligible.length ? `
        <div class="form-grid">
          <label>Select Booking
            <select name="bookingId" required>
              ${eligible.map(item => `<option value="${esc(item.id)}">${esc(item.bookingRef)} · ${esc(item.vehicle?.make + ' ' + item.vehicle?.model)} (${d(item.startDate)})</option>`).join('')}
            </select>
          </label>
          <label>Dispute Category
            <select name="category" required>
              <option value="BILLING">Billing Issue</option>
              <option value="DEPOSIT_REFUND">Security Deposit Delay / Deduction</option>
              <option value="VEHICLE_CONDITION">Vehicle Condition Issue</option>
              <option value="HANDOVER_ISSUE">Pickup / Return Discrepancy</option>
              <option value="DAMAGE_APPEAL">Extra Charge / Damage Appeal</option>
              <option value="CANCELLATION_REFUND">Cancellation / Refund Inquiry</option>
            </select>
          </label>
        </div>
        ${inp('amountClaimed', 'Disputed Amount (₹, Optional)', 'number', 'min="0" step="1" placeholder="e.g. 2000"')}
        <label>Detailed Description
          <textarea name="description" rows="3" required maxlength="2000" placeholder="Provide details about the issue and the resolution you are requesting."></textarea>
        </label>
        <div><button type="submit" class="button btn-orange">Submit Dispute</button></div>
      ` : '<p class="text-muted" style="margin:0">You do not have any bookings yet. Once you book a trip, you can raise any booking-related dispute here.</p>'}
    </form>

    <h4 style="margin:24px 0 12px">Dispute Tracker</h4>
    <div style="display:grid;gap:12px;">
      ${disputes.length ? disputes.map(dispute => `<article class="panel-subtle" style="padding:16px;border-radius:12px;border:1px solid var(--border-main)">
        <div style="display:flex;justify-content:space-between;gap:12px;flex-wrap:wrap;">
          <strong>Reference: ${esc(dispute.reference)}</strong>
          ${badge(dispute.status)}
        </div>
        <p style="margin:6px 0 4px;font-size:13.5px"><strong>${esc(dispute.category.replaceAll('_', ' '))}</strong> · Booking: <strong>${esc(dispute.bookingRef || dispute.bookingId || '—')}</strong></p>
        <p style="margin:0;color:var(--text-main);font-size:13.5px">${esc(dispute.description)}</p>
        ${dispute.amountClaimed ? `<p class="text-muted" style="margin:6px 0 0;font-size:12.5px">Claimed Amount: <strong>${money(dispute.amountClaimed)}</strong></p>` : ''}
        ${dispute.adminResponse ? `<div class="notice" style="margin-top:10px"><strong>Admin Resolution Response:</strong> ${esc(dispute.adminResponse)}</div>` : ''}
        ${dispute.history?.length ? `<details style="margin-top:10px;font-size:12.5px"><summary style="cursor:pointer;font-weight:600;color:var(--brand)">Timeline (${dispute.history.length} update${dispute.history.length === 1 ? '' : 's'})</summary>${dispute.history.map(item => `<p class="text-muted" style="margin:6px 0 0">${dt(item.createdAt)} · <strong>${esc(item.status)}</strong> · ${esc(item.note || '')}</p>`).join('')}</details>` : ''}
      </article>`).join('') : '<p class="text-muted" style="margin:0">No disputes submitted.</p>'}
    </div>
  </section>`;
}

function renderHistoryTabHtml(trips) {
  return `<section class="panel">
    <h3 style="margin:0">Trip &amp; Handover Condition History</h3>
    <p class="text-muted" style="margin:4px 0 16px">Pre-trip pickup and post-trip return inspection logs, odometer readings, fuel percentages, and condition notes.</p>
    ${trips.length ? `
      <div class="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Booking Ref &amp; Dates</th>
              <th>Vehicle</th>
              <th>Status</th>
              <th>Pickup &amp; Return Odometer / Fuel / Condition</th>
            </tr>
          </thead>
          <tbody>
            ${trips.map(item => `
              <tr>
                <td><strong>${esc(item.bookingRef)}</strong><br><small class="text-muted">${dt(item.startDate)} → ${dt(item.endDate)}</small></td>
                <td><strong>${esc(item.vehicle?.make + ' ' + item.vehicle?.model)}</strong><br><small class="text-muted">${esc(item.vehicle?.registrationNumber || '')}</small></td>
                <td>${badge(formatBookingStatus(item))}</td>
                <td>
                  ${item.inspections?.length
                    ? item.inspections.map(inspection => `
                        <div style="margin-bottom:6px;padding-bottom:6px;border-bottom:1px dashed var(--border-main)">
                          <strong>${esc(inspection.stage)}</strong> · Odometer: <strong>${Number(inspection.odometer || 0).toLocaleString('en-IN')} km</strong> · Fuel: <strong>${inspection.fuelPercent == null ? '—' : Number(inspection.fuelPercent) + '%'}</strong>
                          <br><small class="text-muted">${esc(inspection.damageNote || 'All 8 angles verified clean')}</small>
                        </div>`).join('') + tripDistanceSummary(item)
                    : '<span class="text-muted">Handover inspection pending</span>'}
                </td>
              </tr>`).join('')}
          </tbody>
        </table>
      </div>` : '<p class="text-muted">Your trip inspection history will appear here once you complete a booking.</p>'}
  </section>`;
}

function renderReviewsTabHtml(reviews, trips = []) {
  const vehicleReviews = reviews?.vehicleReviews || [];
  const partyRatings = reviews?.partyRatings || [];
  const reviewedBookingIds = new Set(vehicleReviews.map(r => r.bookingId));
  const eligibleBookings = (trips || []).filter(b => b.status === 'COMPLETED' && !reviewedBookingIds.has(b.id));

  return `<section class="panel">
    <h3 style="margin:0">Reviews &amp; Ratings</h3>
    <p class="text-muted" style="margin:4px 0 16px">Rate your completed self-drive trips and view your published reviews.</p>

    ${eligibleBookings.length ? `
      <form id="account-review-form" class="form-stack panel-subtle" style="margin-bottom:22px">
        <h4 style="margin:0">Submit a Review for a Completed Trip</h4>
        <div class="form-grid">
          <label>Completed Trip
            <select name="bookingId" required>
              ${eligibleBookings.map(b => `<option value="${esc(b.id)}">${esc(b.bookingRef)} · ${esc(b.vehicle?.make + ' ' + b.vehicle?.model)}</option>`).join('')}
            </select>
          </label>
          <label>Star Rating
            <select name="rating" required>
              <option value="5">★★★★★ (5/5 — Excellent)</option>
              <option value="4">★★★★☆ (4/5 — Good)</option>
              <option value="3">★★★☆☆ (3/5 — Average)</option>
              <option value="2">★★☆☆☆ (2/5 — Below Average)</option>
              <option value="1">★☆☆☆☆ (1/5 — Poor)</option>
            </select>
          </label>
        </div>
        <label>Written Feedback
          <textarea name="comment" rows="3" required maxlength="1000" placeholder="Share your experience with vehicle cleanliness, mileage, and pickup/return handover…"></textarea>
        </label>
        <div><button type="submit" class="button btn-orange">Publish Verified Review</button></div>
      </form>
    ` : ''}

    <div style="display:grid;gap:12px;">
      ${vehicleReviews.concat(partyRatings).length ? [
        ...vehicleReviews.map(review => `
          <article class="panel-subtle" style="padding:16px;border-radius:12px;border:1px solid var(--border-main)">
            <div style="display:flex;justify-content:space-between;align-items:center">
              <strong>${esc(review.vehicle?.make + ' ' + review.vehicle?.model)}</strong>
              <span class="badge ok">★ ${Number(review.rating)} / 5</span>
            </div>
            <p style="margin:8px 0 4px;font-size:13.5px">${esc(review.comment || 'Verified trip review')}</p>
            <small class="text-muted">Submitted ${dt(review.createdAt)}</small>
          </article>`),
        ...partyRatings.map(review => `
          <article class="panel-subtle" style="padding:16px;border-radius:12px;border:1px solid var(--border-main)">
            <div style="display:flex;justify-content:space-between;align-items:center">
              <strong>${esc(review.target?.firstName + ' ' + review.target?.lastName)} (${esc(review.targetRole)})</strong>
              <span class="badge ok">★ ${Number(review.rating)} / 5</span>
            </div>
            <p style="margin:8px 0 4px;font-size:13.5px">${esc(review.comment || 'Verified host rating')}</p>
            <small class="text-muted">Booking ${esc(review.booking?.bookingRef || '—')} · ${dt(review.createdAt)}</small>
          </article>`)
      ].join('') : '<p class="text-muted" style="margin:0">You have not submitted any reviews yet. Completed trips can be rated here.</p>'}
    </div>
  </section>`;
}

function bindProfileEvents() {
  bindForm('#account-profile-form', async data => {
    const result = await post('/account/profile', data);
    user = { ...user, ...result };
    toast('Profile updated.');
    await dashboard('profile', true);
  });
  bindForm('#account-password-form', async data => {
    await post('/account/password', data);
    $('#account-password-form')?.reset();
    toast('Password updated.');
  });
  $('#account-delete-btn')?.addEventListener('click', async () => {
    if (!confirm('Submit an account deletion request? This will be reviewed after all trips and settlements are closed.')) return;
    try { await post('/account/delete-request', { reason: 'Customer requested account deletion from account settings' }); toast('Deletion request submitted.'); }
    catch (error) { toast(error.message, true); }
  });
}

function bindDisputeEvents() {
  if (!$('#account-dispute-form')) return;
  bindForm('#account-dispute-form', async data => {
    await post('/account/disputes', data);
    toast('Dispute submitted for review.');
    await dashboard('disputes', true);
  });
}

function bindReviewEvents() {
  if (!$('#account-review-form')) return;
  bindForm('#account-review-form', async data => {
    await post('/reviews', { bookingId: data.bookingId, rating: Number(data.rating), comment: data.comment });
    toast('Verified review published.');
    await dashboard('reviews', true);
  });
}

function tripDistanceSummary(booking) {
  const pickup = booking.inspections?.find(item => item.stage === 'PICKUP');
  const returned = booking.inspections?.find(item => item.stage === 'RETURN');
  if (!pickup || !returned) return '';
  const travelled = Math.max(0, returned.odometer - pickup.odometer);
  const excess = booking.includedKilometres == null ? null : Math.max(0, travelled - booking.includedKilometres);
  return `<p style="margin:6px 0 0;font-size:12.5px"><strong>Distance Driven: ${travelled.toLocaleString('en-IN')} km</strong>${excess ? ` · <span style="color:#B45309;">Excess: ${excess} km</span>` : ' · Within limit'}</p>`;
}

function renderBookingTable(list, isHost) {
  if (!list.length) return empty('No reservations found', '<a href="cars.html" class="button btn-orange btn-sm">Browse Self-Drive Cars</a>');
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
            const hostRev = b.hostRevenue == null ? Math.round(Number(b.baseFare || 0) * 0.80) : Number(b.hostRevenue);
            const platFee = b.platformFee == null ? Math.round(Number(b.baseFare || 0) * 0.20) : Number(b.platformFee);
            return `
            <tr>
              <td>
                <strong>${esc(b.vehicle.make + ' ' + b.vehicle.model)}</strong>
                <p class="text-muted" style="font-size:12px;margin:2px 0">Ref: <strong>${esc(b.bookingRef)}</strong> · ${esc(b.vehicle.registrationNumber || '')}</p>
                ${!isHost && b.vehicle?.host ? `<p style="font-size:12px;margin:4px 0 0;color:var(--brand)">Host: <strong>${esc(b.vehicle.host.firstName + ' ' + b.vehicle.host.lastName)}</strong>${b.vehicle.host.phone && ['CONFIRMED','ACTIVE'].includes(b.status) ? ` · <a href="tel:${esc(b.vehicle.host.phone)}" style="color:var(--cta);font-weight:700">${esc(b.vehicle.host.phone)}</a>` : ''}</p>` : ''}
                ${isHost && b.customer ? `<p style="font-size:12px;margin:4px 0 0;color:var(--brand)">Customer: <strong>${esc(b.customer.firstName + ' ' + b.customer.lastName)}</strong>${b.customer.phone ? ` · <a href="tel:${esc(b.customer.phone)}" style="color:var(--cta);font-weight:700">${esc(b.customer.phone)}</a>` : ''}</p>` : ''}
              </td>
              <td>
                <strong>${hrs} Hours (${Math.max(1, Math.ceil(hrs/24))}d)</strong><br>
                <span style="font-size:12px;">${dt(b.startDate)}</span><br>
                <span class="text-muted" style="font-size:12px;">→ ${dt(b.endDate)}</span>
              </td>
              <td>
                <strong style="font-size:15px;">${money(b.totalAmount)}</strong>
                <p class="text-muted" style="font-size:11.5px;margin:2px 0;">Fare: ${money(b.baseFare)} + Deposit: ${money(b.securityDeposit)}</p>
                ${isHost ? `<p style="font-size:11.5px;color:var(--ok);font-weight:700;margin:2px 0;">Host 80%: ${money(hostRev)} <span class="text-muted">(Fee: ${money(platFee)})</span></p>` : ''}
                ${b.inspections?.length ? `<details class="trip-inspection-details" style="margin-top:6px;"><summary style="font-size:12px;cursor:pointer;color:var(--brand);font-weight:700;">${b.inspections.length} Handover Record(s)</summary>${b.inspections.map(ins => `<div style="padding:6px 0;border-bottom:1px dashed var(--border-main);font-size:12px;"><strong>${esc(ins.stage)}</strong> · ${Number(ins.odometer).toLocaleString('en-IN')} km · Fuel ${Number(ins.fuelPercent || 0)}%<br><span class="text-muted">${esc(ins.damageNote || 'All 8 angles & selfie verified')}</span></div>`).join('')}${tripDistanceSummary(b)}</details>` : ''}
              </td>
              <td>
                ${badge(st)}
                ${b.payment ? `<span style="margin-left:4px">${badge(b.payment.status)}</span>` : ''}
                ${st === 'PENDING' ? `<p class="text-muted" style="font-size:11px;margin-top:4px;">Complete payment to confirm booking</p>` : ''}
                ${(() => {
                  if (['CANCELLED','EXPIRED','FAILED'].includes(st)) return '';
                  const step = st === 'COMPLETED' ? 4 : st === 'ACTIVE' ? 3 : st === 'CONFIRMED' ? 2 : 1;
                  return `<div class="trip-telemetry-track" title="Trip Lifecycle">
                    <span class="${step >= 1 ? 'done' : ''}">1. Pay</span>
                    <span class="${step >= 2 ? 'done' : ''}">2. Pickup</span>
                    <span class="${step >= 3 ? 'done' : ''}">3. Active</span>
                    <span class="${step >= 4 ? 'done' : ''}">4. Return</span>
                  </div>`;
                })()}
              </td>
              <td>
                <div class="actions" style="flex-wrap:wrap;gap:6px;">
                  ${!isHost && st === 'PENDING' ? `<button type="button" class="button btn-orange btn-sm pay-booking-btn" data-id="${esc(b.id)}">Pay Now</button>` : ''}
                  ${['CONFIRMED','ACTIVE'].includes(b.status)
                    ? `<button type="button" class="button btn-orange btn-sm inspection-btn" data-id="${esc(b.id)}" data-stage="${b.status === 'CONFIRMED' ? 'PICKUP' : 'RETURN'}">${b.status === 'CONFIRMED' ? 'Start Pickup Inspection' : 'Complete Return Inspection'}</button>` : ''}
                  <a class="button btn-outline btn-sm" href="agreement.html?id=${encodeURIComponent(b.id)}">Agreement</a>
                  ${b.invoice ? `<a class="button btn-outline btn-sm" href="invoice.html?id=${encodeURIComponent(b.invoice.id)}">Invoice</a>` : ''}
                  ${['PENDING','CONFIRMED'].includes(st) && new Date(b.startDate) > new Date()
                    ? `<button type="button" class="btn-ghost btn-sm cancel-booking-btn" data-id="${esc(b.id)}">Cancel</button>` : ''}
                  ${!isHost && b.status === 'COMPLETED' ? `<button type="button" class="button btn-outline btn-sm review-booking-btn" data-id="${esc(b.id)}">Rate Trip</button>` : ''}
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
      <span class="badge ok">BOOKING CHECKOUT &amp; LEASE AGREEMENT</span>
      <h3 style="margin:8px 0 4px;">Complete Payment &amp; Confirm Reservation</h3>
      <p class="text-muted" style="margin:0 0 16px;">Booking Ref: <strong>${esc(booking.bookingRef)}</strong> · ${esc(booking.vehicle?.make + ' ' + booking.vehicle?.model)}</p>

      <div style="background:var(--bg-subtle);padding:16px;border-radius:14px;border:1px solid var(--border-main);margin-bottom:16px;">
        <div style="display:flex;justify-content:space-between;margin-bottom:6px;"><span>Trip Duration (${hrs} hrs)</span><strong>${dt(booking.startDate)} → ${dt(booking.endDate)}</strong></div>
        <div style="display:flex;justify-content:space-between;margin-bottom:6px;"><span>Rental Base Fare</span><strong>${money(booking.baseFare)}</strong></div>
        <div style="display:flex;justify-content:space-between;margin-bottom:6px;"><span>Refundable Security Deposit</span><strong>${money(booking.securityDeposit)}</strong></div>
        <div style="display:flex;justify-content:space-between;padding-top:8px;border-top:1px solid var(--border-main);font-size:17px;"><strong>Total Payable Now</strong><strong style="color:var(--brand);">${money(booking.totalAmount)}</strong></div>
      </div>

      <form id="customer-checkout-form" class="form-stack">
        <label>Select Payment Method
          <select name="method" required>
            <option value="UPI_INSTANT">UPI Instant Pay (GPay / PhonePe / Paytm)</option>
            <option value="CARD">Credit / Debit Card (Visa / MasterCard / RuPay)</option>
            <option value="NETBANKING">NetBanking (All Indian Banks)</option>
          </select>
        </label>
        <label>UPI ID / Payment Reference
          <input name="reference" type="text" placeholder="e.g. mobile@upi" value="UPI-${Date.now().toString().slice(-6)}">
        </label>
        <label class="check">
          <input type="checkbox" required checked>
          <span>I accept the <strong>Safar Self-Drive Car Lease Agreement</strong> and agree to complete the 8-angle vehicle + selfie handover inspection at Pickup and Return.</span>
        </label>
        <button type="submit" class="button btn-orange" style="width:100%;justify-content:center;padding:14px;">Pay ${money(booking.totalAmount)} &amp; Confirm Booking</button>
      </form>
    </div>
  `);

  bindForm('#customer-checkout-form', async data => {
    await post('/bookings/' + encodeURIComponent(booking.id) + '/pay', data);
    $('dialog')?.close();
    toast('Payment confirmed! Your Car Lease Agreement is active.');
    await dashboard('trips', true);
  });
}

function openHandoverWizardModal(bookingId, stage) {
  const isPickup = stage === 'PICKUP';
  const selfieKind = isPickup ? 'SELFIE_PICKUP' : 'SELFIE_RETURN';
  const title = isPickup ? 'Trip Pickup Handover (8 Car Angles + Customer Selfie)' : 'Trip Return Handover (8 Car Angles + Customer Selfie)';

  showDialog(`
    <div style="max-width:780px;">
      <span class="badge ${isPickup ? 'ok' : 'warn'}">${isPickup ? 'STEP 1 · HUB PICKUP INSPECTION' : 'STEP 2 · HUB RETURN & SETTLEMENT INSPECTION'}</span>
      <h3 style="margin:8px 0 4px;">${title}</h3>
      <p class="text-muted" style="margin:0 0 14px;">
        Upload all <strong>8 mandatory car angle photos</strong> plus <strong>1 live customer selfie with the vehicle</strong>.
      </p>

      <div style="display:flex;justify-content:space-between;align-items:center;gap:12px;flex-wrap:wrap;margin-bottom:14px;padding:12px 16px;background:var(--bg-subtle);border-radius:12px;border:1px solid var(--border-main);">
        <div>
          <strong id="handover-slot-counter" style="color:var(--brand);">0 of 9 mandatory photos ready</strong>
          <p class="text-muted" style="margin:2px 0 0;font-size:12px;">Select any slot below to upload from your camera, or use Auto-Fill for testing.</p>
        </div>
        <button type="button" class="button btn-outline btn-sm" id="handover-autofill-btn">Auto-Fill 8 Angles + Selfie (Demo)</button>
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
          <label class="handover-slot-card" id="hslot-SELFIE" style="border-color:var(--cta);background:rgba(240,120,24,0.05);">
            <span class="slot-badge" style="color:var(--cta);">09 · CUSTOMER SELFIE</span>
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
          ${isPickup ? 'Submit 9 Inspection Photos & Start Trip' : 'Submit 9 Inspection Photos & Complete Trip'}
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
        $('small', card).textContent = '✓ Ready';
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
      ctx.fillStyle = k === 'SELFIE' ? '#3B123F' : '#1E1B24';
      ctx.fillRect(0, 0, 640, 420);
      ctx.fillStyle = '#F07818';
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
      $('small', card).textContent = '✓ Frame Ready';
    }
    updateCount();
    toast('All 8 Car Angles + 1 Customer Selfie prepared.');
  };

  bindForm('#handover-wizard-form', async (data, form) => {
    const uploadedMedia = [];
    for (const k of allSlots) {
      const file = form.elements['angle_' + k]?.files?.[0] || generatedBlobs[k];
      if (!file) throw new Error(`Missing photo for ${k}. Please upload all 8 car angles + 1 customer selfie.`);
      const mediaKind = k === 'SELFIE' ? selfieKind : k;
      toast(`Uploading ${k}…`);
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
    toast(isPickup ? 'Trip Started! Inspection archived.' : 'Trip Completed! Return inspection archived.');
    if (page === 'host-onboarding.html') await host('bookings');
    else if (page === 'admin.html') await adminPage('bookings');
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
      switchAccountTab('reviews');
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
      <button class="btn-ghost btn-sm" data-action="close-dialog">Close ✕</button>
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
      ${A.settlement ? `<div class="agreement-section">
        <h3>7. Final settlement</h3>
        <div class="table-wrap"><table><tbody>
          <tr><th>Settlement status</th><td>${esc(A.settlement.status)}</td></tr>
          <tr><th>Total documented deductions</th><td>${money(A.settlement.totalDeduction)}</td></tr>
          <tr><th>Deposit refund</th><td>${money(A.settlement.refundAmount)}</td></tr>
          <tr><th>Additional amount due</th><td>${money(A.settlement.additionalAmountDue)}</td></tr>
          <tr><th>Settlement note</th><td>${esc(A.settlement.note || 'Reviewed by Safar operations')}</td></tr>
        </tbody></table></div>
      </div>` : ''}
      <div class="agreement-section">
        <h3>${A.settlement ? '8' : '7'}. Car sharing agreement terms</h3>
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
async function adminPage(tab) {
  if (!requireUser(['ADMIN'])) return;
  tab = ADMIN_SECTIONS.includes(tab) ? tab : adminSectionFromUrl();
  adminData = await api('/admin');
  adminData.disputes = await api('/admin/disputes').catch(() => []);
  adminData.payouts = await api('/payouts').catch(() => []);
  adminData.payoutAccounts = await api('/payouts/accounts').catch(() => []);
  const totalGross = Number(adminData.metrics?.paidRevenue ?? 0);
  const totalPlatformFee = Number(adminData.metrics?.platformRevenue || 0);
  const totalHostPayouts = Number(adminData.metrics?.hostRevenue || 0);
  const pendingVehicles = adminData.vehicles.filter(v => v.status === 'PENDING_APPROVAL');
  const pendingDocs = adminData.documents.filter(d => d.status === 'PENDING');
  const pendingBanks = adminData.payoutAccounts.filter(a => a.status === 'PENDING');
  const openDisputes = adminData.disputes.filter(d => d.status !== 'RESOLVED' && d.status !== 'REJECTED');
  const totalApprovalsCount = pendingVehicles.length + pendingDocs.length + pendingBanks.length + openDisputes.length;

  $('#app').innerHTML = `
    <div class="admin-workspace">
    ${sectionHead('Administration &amp; Operations', 'Approve car listings, verify KYC documents, and reconcile payments.', 'ADMIN PANEL')}

    <section id="admin-dashboard" aria-label="Dashboard" hidden>
    <div class="pro-kpi-ribbon">
      <div class="pro-kpi-card kpi-card-purple">
        <div class="kpi-card-head">
          <span class="kpi-label">Gross Booking Volume</span>
          <span class="kpi-badge-icon">${icon('wallet', 'ic-sm')}</span>
        </div>
        <strong class="kpi-value">${money(totalGross)}</strong>
        <span class="kpi-sub">Today: ${money(adminData.metrics?.todayRevenue ?? 0)}</span>
      </div>
      <div class="pro-kpi-card kpi-card-indigo">
        <div class="kpi-card-head">
          <span class="kpi-label">Platform Fee (20%)</span>
          <span class="kpi-badge-icon">${icon('layers', 'ic-sm')}</span>
        </div>
        <strong class="kpi-value" style="color:#3B123F;">${money(totalPlatformFee)}</strong>
        <span class="kpi-sub">Net marketplace commission</span>
      </div>
      <div class="pro-kpi-card kpi-card-emerald">
        <div class="kpi-card-head">
          <span class="kpi-label">Host Settlements (80%)</span>
          <span class="kpi-badge-icon">${icon('checkCircle', 'ic-sm')}</span>
        </div>
        <strong class="kpi-value" style="color:#16804A;">${money(totalHostPayouts)}</strong>
        <span class="kpi-sub">${adminData.payouts.length} settlements recorded</span>
      </div>
      <div class="pro-kpi-card kpi-card-orange">
        <div class="kpi-card-head">
          <span class="kpi-label">Active &amp; Confirmed Trips</span>
          <span class="kpi-badge-icon">${icon('car', 'ic-sm')}</span>
        </div>
        <strong class="kpi-value" style="color:#EA580C;">${adminData.metrics?.activeBookings ?? 0}</strong>
        <span class="kpi-sub">${adminData.bookings.length} total bookings in DB</span>
      </div>
      <div class="pro-kpi-card kpi-card-amber">
        <div class="kpi-card-head">
          <span class="kpi-label">e-KYC &amp; Docs Pending</span>
          <span class="kpi-badge-icon">${icon('idcard', 'ic-sm')}</span>
        </div>
        <strong class="kpi-value" style="color:#D97706;">${adminData.metrics?.documentPending ?? pendingDocs.length}</strong>
        <span class="kpi-sub">Identity &amp; RC verification queue</span>
      </div>
      <div class="pro-kpi-card kpi-card-blue">
        <div class="kpi-card-head">
          <span class="kpi-label">Fleet Approvals</span>
          <span class="kpi-badge-icon">${icon('shield', 'ic-sm')}</span>
        </div>
        <strong class="kpi-value" style="color:#2563EB;">${adminData.metrics?.vehiclePending ?? pendingVehicles.length}</strong>
        <span class="kpi-sub">${adminData.vehicles.length} total fleet cars</span>
      </div>
    </div>

    <div class="admin-summary">
      ${[
        ['Vehicle approvals', adminData.metrics?.vehiclePending ?? adminData.vehicles.filter(v => v.status === 'PENDING_APPROVAL').length, 'Listings awaiting review', 'vehicles'],
        ['Bookings to review', adminData.metrics?.bookingsNeedingReview ?? 0, 'Upcoming trips on unavailable or non-compliant cars', 'bookings', 'metric-bookings-review'],
        ['Document reviews', adminData.metrics?.documentPending ?? adminData.documents.filter(d => d.status === 'PENDING').length, 'KYC and vehicle documents', 'documents'],
        ['Active bookings', adminData.metrics?.activeBookings ?? 0, 'Confirmed or currently active', 'bookings'],
        ['Pending refunds', adminData.metrics?.refunds ?? adminData.bookings.filter(b => b.payment?.status === 'REFUND_PENDING').length, 'Payments to reconcile', 'bookings'],
        ["Today's collected", money(adminData.metrics?.todayRevenue ?? 0), 'Successful payments today', 'bookings'],
        ['Collected to date', money(adminData.metrics?.paidRevenue ?? 0), 'Successful payments history', 'bookings'],
      ].map(([label, value, hint, target, testid]) => `<a class="admin-metric" href="admin.html?tab=${target}" data-goto="${target}"${testid ? ` data-testid="${testid}"` : ''}><span>${esc(label)}</span><strong>${esc(String(value))}</strong><small>${esc(hint)}</small><em class="admin-metric-go">View ${esc(target)} →</em></a>`).join('')}
    </div>
    <div id="admin-dashboard-extra"></div>
    </section>

    <section id="admin-records" hidden>
    <div class="admin-toolbar" id="admin-filter-toolbar">
      <label class="admin-search">Search records<input id="admin-search" type="search" placeholder="Search name, registration, city or status…"></label>
      <label>Status<select id="admin-status"><option value="">All statuses</option></select></label>
      <label>From<input id="admin-export-from" type="date"></label>
      <label>To<input id="admin-export-to" type="date"></label>
      <button id="admin-export" type="button" class="button btn-outline">Export booking MIS (CSV)</button>
      <button id="admin-refresh" type="button" class="button btn-outline admin-refresh" title="Refresh records" aria-label="Refresh records">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 12a9 9 0 1 1-2.64-6.36"/><path d="M21 3v6h-6"/></svg>
      </button>
      <span id="admin-record-count" role="status"></span>
    </div>
    <div id="admin-panel-content"></div>
    <div class="actions"><button id="admin-load-more" class="btn-outline" ${adminData.nextOffset == null ? 'hidden' : ''}>Load more records</button></div>
    </section></div>`;

  // Header section links switch sections in place (no reload) and keep the address in sync.
  // Dashboard cards jump to the section they summarise, the same way.
  $$('#header [data-tab], #admin-dashboard [data-goto]').forEach(b => b.onclick = event => {
    event.preventDefault();
    const target = b.dataset.tab || b.dataset.goto;
    $('#admin-search').value = ''; $('#admin-status').value = '';
    history.replaceState(null, '', 'admin.html?tab=' + target);
    renderAdminView(target);
  });
  updateAdminCounts();
  $('#admin-search').oninput = () => renderAdminView(currentAdminTab);
  $('#admin-status').onchange = () => renderAdminView(currentAdminTab);
  $('#admin-refresh').onclick = () => adminPage(currentAdminTab);
  $('#admin-export').onclick = () => { const params = new URLSearchParams(); const from = $('#admin-export-from').value, to = $('#admin-export-to').value; if (from) params.set('from', from); if (to) params.set('to', to); window.open('/api/admin/export.csv?' + params.toString(), '_blank', 'noopener'); };
  $('#admin-load-more').onclick = async event => {
    const button = event.currentTarget;
    button.disabled = true;
    try {
      const more = await api('/admin?offset=' + adminData.nextOffset);
      for (const key of ['vehicles','documents','bookings','users','audit']) {
        adminData[key] = [...new Map([...adminData[key], ...more[key]].map(record => [record.id, record])).values()];
      }
      adminData.nextOffset = more.nextOffset;
      updateAdminCounts();
      button.hidden = more.nextOffset == null;
      renderAdminView(currentAdminTab);
    } catch (error) { toast(error.message, true); }
    finally { button.disabled = false; }
  };
  renderAdminView(tab);
}

function renderAdminView(tab) {
  currentAdminTab = tab;
  // Dashboard shows the summary cards and widgets; every other section shows its records with the toolbar.
  const dashboard = tab === 'dashboard';
  $('#admin-dashboard').hidden = !dashboard;
  $('#admin-records').hidden = dashboard;
  $$('#header [data-tab]').forEach(b => { b.classList.toggle('active', b.dataset.tab === tab); if (b.dataset.tab === tab) b.setAttribute('aria-current', 'page'); else b.removeAttribute('aria-current'); });
  const toolbar = $('#admin-filter-toolbar');
  const listTabs = ['vehicles', 'bookings', 'users', 'documents', 'disputes', 'audit', 'payouts'];
  if (toolbar) toolbar.style.display = listTabs.includes(tab) ? '' : 'none';

  const statusSelect = $('#admin-status');
  const selectedStatus = statusSelect.value;
  const sourceList = Array.isArray(adminData[tab]) ? adminData[tab] : [];
  const statuses = [...new Set(sourceList.map(item => tab === 'bookings' ? formatBookingStatus(item) : item.status || item.role || item.action).filter(Boolean))].sort();
  statusSelect.innerHTML = '<option value="">All statuses</option>' + statuses.map(status => `<option value="${esc(status)}">${esc((status || '').replaceAll('_', ' '))}</option>`).join('');
  statusSelect.value = statuses.includes(selectedStatus) ? selectedStatus : '';
  const query = $('#admin-search').value.trim().toLowerCase();
  const data = sourceList.filter(item => (!statusSelect.value || (tab === 'bookings' ? formatBookingStatus(item) : item.status || item.role || item.action) === statusSelect.value) && (!query || JSON.stringify(item).toLowerCase().includes(query)));
  if ($('#admin-record-count')) {
    $('#admin-record-count').textContent = listTabs.includes(tab) ? `${data.length} of ${sourceList.length} records` : '';
  }

  if (tab === 'dashboard') {
    const activeVehicles = adminData.vehicles.filter(v => v.status === 'ACTIVE').length;
    const pendingVehicles = adminData.vehicles.filter(v => v.status === 'PENDING_APPROVAL');
    const pendingDocs = adminData.documents.filter(d => d.status === 'PENDING');
    const openDisputes = adminData.disputes.filter(d => d.status !== 'RESOLVED' && d.status !== 'REJECTED');
    const recentBookings = adminData.bookings.slice(0, 5);
    $('#admin-dashboard-extra').innerHTML = `
      <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(320px,1fr));gap:16px;margin-bottom:18px;">
        <section class="panel" style="padding:20px;">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;">
            <h3 style="margin:0;font-size:16px;">Fleet Health &amp; Inventory</h3>
            <button type="button" class="btn-outline btn-sm admin-jump-tab" data-target="vehicles">Manage Fleet</button>
          </div>
          <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:10px;text-align:center;">
            <div style="padding:12px;background:#FAF8FA;border-radius:10px;border:1px solid #E9E3EA;">
              <strong style="font-size:20px;color:#16804A;display:block;">${activeVehicles}</strong>
              <span style="font-size:12px;color:#68616B;">Active Cars</span>
            </div>
            <div style="padding:12px;background:#FAF8FA;border-radius:10px;border:1px solid #E9E3EA;">
              <strong style="font-size:20px;color:#B45309;display:block;">${pendingVehicles.length}</strong>
              <span style="font-size:12px;color:#68616B;">Pending Approval</span>
            </div>
            <div style="padding:12px;background:#FAF8FA;border-radius:10px;border:1px solid #E9E3EA;">
              <strong style="font-size:20px;color:#3B123F;display:block;">${adminData.vehicles.length - activeVehicles - pendingVehicles.length}</strong>
              <span style="font-size:12px;color:#68616B;">Maintenance / Hold</span>
            </div>
          </div>
        </section>

        <section class="panel" style="padding:20px;">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;">
            <h3 style="margin:0;font-size:16px;">Action Required Queue</h3>
            <button type="button" class="btn-outline btn-sm admin-jump-tab" data-target="approvals">Open Queue</button>
          </div>
          <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:10px;text-align:center;">
            <div style="padding:12px;background:#FAF8FA;border-radius:10px;border:1px solid #E9E3EA;">
              <strong style="font-size:20px;color:#3B123F;display:block;">${pendingDocs.length}</strong>
              <span style="font-size:12px;color:#68616B;">Pending KYC Docs</span>
            </div>
            <div style="padding:12px;background:#FAF8FA;border-radius:10px;border:1px solid #E9E3EA;">
              <strong style="font-size:20px;color:#B42318;display:block;">${openDisputes.length}</strong>
              <span style="font-size:12px;color:#68616B;">Open Disputes</span>
            </div>
            <div style="padding:12px;background:#FAF8FA;border-radius:10px;border:1px solid #E9E3EA;">
              <strong style="font-size:20px;color:#16804A;display:block;">${adminData.users.filter(u => u.isVerified).length}</strong>
              <span style="font-size:12px;color:#68616B;">Verified Drivers</span>
            </div>
          </div>
        </section>
      </div>

      <section class="panel table-wrap" style="margin-bottom:18px;">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;">
          <div>
            <h3 style="margin:0;font-size:16px;">Recent Self-Drive Bookings</h3>
            <p class="text-muted" style="margin:2px 0 0;font-size:13px;">Latest reservations, handover states, and revenue splits.</p>
          </div>
          <button type="button" class="btn-outline btn-sm admin-jump-tab" data-target="bookings">View All ${adminData.bookings.length} Bookings</button>
        </div>
        <table>
          <thead><tr><th>Booking Ref</th><th>Customer</th><th>Vehicle</th><th>Pickup → Return</th><th>Total Fare</th><th>Status</th></tr></thead>
          <tbody>
            ${recentBookings.map(b => `
              <tr>
                <td><strong>${esc(b.bookingRef)}</strong></td>
                <td>${esc(b.customer.firstName + ' ' + b.customer.lastName)}</td>
                <td><strong>${esc(b.vehicle.make + ' ' + b.vehicle.model)}</strong> · <small class="text-muted">${esc(b.vehicle.locationCity)}</small></td>
                <td><small>${dt(b.startDate)} → ${dt(b.endDate)}</small></td>
                <td><strong>${money(b.totalAmount)}</strong></td>
                <td>${badge(formatBookingStatus(b))}</td>
              </tr>`).join('') || '<tr><td colspan="6">No bookings recorded yet.</td></tr>'}
          </tbody>
        </table>
      </section>`;
    $$('.admin-jump-tab').forEach(btn => btn.onclick = () => { history.replaceState(null, '', 'admin.html?tab=' + btn.dataset.target); renderAdminView(btn.dataset.target); });
    return;
  }

  if (tab === 'approvals') {
    const pendingVehicles = adminData.vehicles.filter(v => v.status === 'PENDING_APPROVAL');
    const pendingDocs = adminData.documents.filter(d => d.status === 'PENDING');
    const pendingBanks = adminData.payoutAccounts.filter(a => a.status === 'PENDING');
    const openDisputes = adminData.disputes.filter(d => d.status !== 'RESOLVED' && d.status !== 'REJECTED');
    $('#admin-panel-content').innerHTML = `
      <section class="panel table-wrap" style="margin-bottom:18px;">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;">
          <div>
            <h3 style="margin:0;">Pending Vehicle Listings (${pendingVehicles.length})</h3>
            <p class="text-muted" style="margin:2px 0 0;font-size:13px;">Inspect 8-angle photos and compliance documents before activating host vehicles.</p>
          </div>
        </div>
        ${pendingVehicles.length ? `
          <table>
            <thead><tr><th>Vehicle</th><th>Reg &amp; City</th><th>Daily Rate</th><th>S3 Photos</th><th>Action</th></tr></thead>
            <tbody>
              ${pendingVehicles.map(v => `
                <tr>
                  <td><strong>${esc(v.make + ' ' + v.model + ' ' + v.year)}</strong></td>
                  <td>${esc(v.registrationNumber || 'Pending')} · ${esc(v.locationCity)}</td>
                  <td><strong>${money(v.pricePerDay)}/day</strong></td>
                  <td>${v.media?.length || 0} photos</td>
                  <td>
                    <div class="actions">
                      <button type="button" class="btn-outline btn-sm vehicle-folder-btn" data-id="${esc(v.id)}">Review &amp; Approve</button>
                    </div>
                  </td>
                </tr>`).join('')}
            </tbody>
          </table>` : '<p class="text-muted" style="margin:0;">All fleet vehicles have been reviewed.</p>'}
      </section>

      <section class="panel table-wrap" style="margin-bottom:18px;">
        <h3 style="margin:0 0 10px;">Pending Customer &amp; Host Documents (${pendingDocs.length})</h3>
        ${pendingDocs.length ? `
          <table>
            <thead><tr><th>Member</th><th>Document Kind</th><th>Selfie</th><th>Action</th></tr></thead>
            <tbody>
              ${pendingDocs.map(doc => `
                <tr>
                  <td><strong>${esc((doc.user?.firstName || '') + ' ' + (doc.user?.lastName || ''))}</strong><br><small class="text-muted">${esc(doc.user?.email || '')}</small></td>
                  <td><strong>${esc(doc.kind)}</strong> ${doc.numberLast4 ? `•••• ${esc(doc.numberLast4)}` : ''}</td>
                  <td>${doc.user?.profile?.selfieMediaId ? 'Submitted' : '—'}</td>
                  <td>
                    <div class="actions">
                      <button type="button" class="btn-outline btn-sm doc-review-action" data-id="${esc(doc.id)}">Review</button>
                    </div>
                  </td>
                </tr>`).join('')}
            </tbody>
          </table>` : '<p class="text-muted" style="margin:0;">Zero pending KYC documents in the queue.</p>'}
      </section>

      <section class="panel table-wrap">
        <h3 style="margin:0 0 10px;">Pending Partner Bank Verifications (${pendingBanks.length}) &amp; Open Disputes (${openDisputes.length})</h3>
        <div style="display:flex;gap:12px;flex-wrap:wrap;">
          <button type="button" class="btn-outline btn-sm admin-jump-tab" data-target="payouts">Review Partner Bank Accounts (${pendingBanks.length})</button>
          <button type="button" class="btn-outline btn-sm admin-jump-tab" data-target="disputes">Review Open Disputes (${openDisputes.length})</button>
        </div>
      </section>`;
    $$('.admin-jump-tab').forEach(btn => btn.onclick = () => { history.replaceState(null, '', 'admin.html?tab=' + btn.dataset.target); renderAdminView(btn.dataset.target); });
  }

  if (tab === 'pricing') {
    $('#admin-panel-content').innerHTML = `
      <section class="panel" style="margin-bottom:18px;">
        <h3 style="margin:0 0 6px;">Commercial &amp; Marketplace Fare Policy</h3>
        <p class="text-muted" style="margin:0 0 14px;font-size:13px;">Active platform parameters governing all self-drive bookings, deposits, and host settlements.</p>
        <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:12px;">
          <div style="padding:14px;border:1px solid #E9E3EA;border-radius:10px;background:#FAF8FA;">
            <span class="text-muted" style="font-size:12px;">Host Revenue Share</span>
            <strong style="display:block;font-size:20px;color:#16804A;margin-top:4px;">80% Net Base Fare</strong>
          </div>
          <div style="padding:14px;border:1px solid #E9E3EA;border-radius:10px;background:#FAF8FA;">
            <span class="text-muted" style="font-size:12px;">Platform Commission</span>
            <strong style="display:block;font-size:20px;color:#3B123F;margin-top:4px;">20% Marketplace Fee</strong>
          </div>
          <div style="padding:14px;border:1px solid #E9E3EA;border-radius:10px;background:#FAF8FA;">
            <span class="text-muted" style="font-size:12px;">Minimum Booking Duration</span>
            <strong style="display:block;font-size:20px;color:#211B24;margin-top:4px;">4 Hours</strong>
          </div>
          <div style="padding:14px;border:1px solid #E9E3EA;border-radius:10px;background:#FAF8FA;">
            <span class="text-muted" style="font-size:12px;">Included Free Distance</span>
            <strong style="display:block;font-size:20px;color:#211B24;margin-top:4px;">10 km / hour</strong>
          </div>
        </div>
      </section>
      <section class="panel table-wrap">
        <h3 style="margin:0 0 10px;">Quick Fleet Tariff Editor</h3>
        <table>
          <thead><tr><th>Vehicle</th><th>Category &amp; City</th><th>Daily Rate</th><th>Hourly Equivalent</th><th>Action</th></tr></thead>
          <tbody>
            ${adminData.vehicles.map(v => `
              <tr>
                <td><strong>${esc(v.make + ' ' + v.model + ' ' + v.year)}</strong><br><small class="text-muted">${esc(v.registrationNumber || 'Pending')}</small></td>
                <td>${esc(v.category || 'SUV')} · ${esc(v.locationCity)}</td>
                <td><strong>${money(v.pricePerDay)} / day</strong></td>
                <td>${money(Math.max(99, Math.round(Number(v.pricePerDay) / 24)))} / hr</td>
                <td><button type="button" class="btn-outline btn-sm vehicle-pricing-action" data-id="${esc(v.id)}">Edit Rate</button></td>
              </tr>`).join('')}
          </tbody>
        </table>
      </section>`;
  }

  if (tab === 'reports') {
    const cityCounts = {};
    adminData.vehicles.forEach(v => { const c = v.locationCity || 'Other'; cityCounts[c] = (cityCounts[c] || 0) + 1; });
    const statusCounts = {};
    adminData.bookings.forEach(b => { const s = formatBookingStatus(b); statusCounts[s] = (statusCounts[s] || 0) + 1; });
    $('#admin-panel-content').innerHTML = `
      <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(300px,1fr));gap:16px;margin-bottom:18px;">
        <section class="panel">
          <h3 style="margin:0 0 12px;">Bookings by Status</h3>
          <table>
            <thead><tr><th>Status</th><th>Count</th></tr></thead>
            <tbody>
              ${Object.entries(statusCounts).map(([st, cnt]) => `<tr><td>${badge(st)}</td><td><strong>${cnt}</strong></td></tr>`).join('') || '<tr><td colspan="2">No bookings yet.</td></tr>'}
            </tbody>
          </table>
        </section>
        <section class="panel">
          <h3 style="margin:0 0 12px;">Fleet Distribution by City Hub</h3>
          <table>
            <thead><tr><th>City Hub</th><th>Vehicles</th></tr></thead>
            <tbody>
              ${Object.entries(cityCounts).map(([city, cnt]) => `<tr><td><strong>${esc(city)}</strong></td><td>${cnt} cars</td></tr>`).join('')}
            </tbody>
          </table>
        </section>
      </div>
      <section class="panel" style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:12px;">
        <div>
          <h3 style="margin:0;">Download Full Financial &amp; Operational MIS Report</h3>
          <p class="text-muted" style="margin:4px 0 0;font-size:13px;">Exports all bookings, GST invoices, platform fees, and partner settlement splits as CSV.</p>
        </div>
        <button type="button" class="button btn-orange btn-sm" data-action="admin-export">${icon('download', 'ic-sm')} Download MIS CSV</button>
      </section>`;
    return;
  }

  if (listTabs.includes(tab) && !data.length && !(tab === 'payouts' && adminData.payoutAccounts.length)) {
    $('#admin-panel-content').innerHTML = empty('No matching records', query || statusSelect.value ? 'Try another search or choose all statuses.' : 'New submissions will appear here when they are received.');
    return;
  }

  if (tab === 'vehicles') {
    $('#admin-panel-content').innerHTML = `
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;background:var(--color-surface);padding:12px 16px;border-radius:8px;border:1px solid var(--color-border)">
        <div><strong>Fleet Vehicle Management</strong><p class="text-muted" style="margin:0;font-size:13px">Directly register cars, review compliance documents and adjust daily rates.</p></div>
        <button id="admin-add-vehicle-btn" class="button btn-orange btn-sm">Add New Car to Fleet</button>
      </div>
      <div class="admin-vehicle-grid">
        ${data.map(v => `
          <article class="panel admin-vehicle-tile open-car-folder-tile" data-id="${esc(v.id)}" style="cursor:pointer">
            <div class="admin-tile-media">
              <img loading="lazy" ${vehicleImageSlot(vehicleCoverUrl(v))} alt="${esc(v.make + ' ' + v.model)}">
              <div class="admin-tile-badge">${stateChip(...(APPROVAL_CHIP[v.approvalStatus] || ['Draft', 'muted']))}</div>
              <div class="admin-tile-photo-count">${v.media?.length || 0} Photos</div>
            </div>
            <div class="admin-tile-content">
              <div class="admin-tile-header">

            <h3>${esc(v.make + ' ' + v.model + ' ' + v.year)}</h3>
                <p class="text-muted">${esc(v.registrationNumber || 'Pending Reg')} · ${esc(v.locationCity)} · ${Number(v.odometer || 0).toLocaleString('en-IN')} km</p>

              <p class="admin-tile-price"><strong>${money(v.pricePerDay)}</strong> <span class="text-muted" style="font-size:12px">/ day</span></p>
        </div>
              <p class="admin-tile-state">${vehicleStateBadges(v)}</p>
              ${v.eligibility && !v.eligibility.bookable ? eligibilityList(v.eligibility.reasons) : ''}
              <div class="admin-tile-compliance">
                ${v.documents.map(docChip).join('') || '<span class="text-muted">Compliance docs pending</span>'}
              </div>

              <details class="admin-tile-photos-toggle">
                <summary>Inspect Photos (${v.media.filter(m => PHOTO_ANGLES.includes(m.kind)).length}) 📷</summary>
                <div class="admin-photo-grid compact" style="margin-top:8px">
          ${v.media.filter(m => PHOTO_ANGLES.includes(m.kind)).map(m =>
            `<figure><a href="/api/media/${encodeURIComponent(m.id)}" target="_blank" rel="noopener noreferrer" aria-label="Open ${esc((m.kind || '').toLowerCase())} photo"><img loading="lazy" src="/api/media/${encodeURIComponent(m.id)}" alt="${esc(m.kind)}"></a><figcaption>${esc((m.kind || '').replaceAll('_', ' '))}</figcaption></figure>`).join('') || '<p class="text-muted">No vehicle photos uploaded.</p>'}
                </div>
              </details>
              <div class="admin-tile-actions admin-tile-actions-3">
                <button class="button btn-orange btn-sm vehicle-folder-btn" data-id="${esc(v.id)}">Open Folder &amp; Edit</button>
                <button class="button btn-outline btn-sm vehicle-pricing-action" data-id="${esc(v.id)}">Edit rate</button>
                <button class="button btn-outline btn-sm vehicle-schedule-action" data-id="${esc(v.id)}">Schedule</button>
              </div>
            </div>
          </article>`).join('')}
      </div>`;
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
                <td>${sourceCell(doc, doc.source || 'MANUAL')}</td>
                <td>${docStatusBadge(doc)}</td>
                <td><button class="btn-ghost btn-sm doc-review-action" data-id="${esc(doc.id)}">Inspect &amp; Decide</button></td>
              </tr>`).join('')}
          </tbody>
        </table>
      </section>`;
  }

  if (tab === 'bookings') {
    const flags = new Map((adminData.reviewFlags || []).map(f => [f.bookingId, f]));
    const flagText = f => [...new Set([...f.reasons.map(eligibilityText), ...f.flagged.map(e => ({ VEHICLE_INACTIVE: 'Car paused or suspended after booking', APPROVAL_REVOKED: 'Car approval revoked after booking', DOCUMENT_REJECTED: 'A car document was rejected after booking' }[e.reason] || String(e.reason).replaceAll('_', ' ')))])];
    $('#admin-panel-content').innerHTML = `
      <section class="panel table-wrap">
      ${flags.size ? `<p class="notice" data-testid="booking-review-notice">${flags.size} upcoming booking(s) need review: the car is no longer available or compliant for the trip. Nothing has been cancelled or refunded automatically.</p>` : ''}
        <div style="margin-bottom:14px;">
          <h3 style="margin:0;">Master Self-Drive Booking &amp; Revenue Split Ledger</h3>
          <p class="text-muted" style="margin:4px 0 0;">Complete record of customer, vehicle, tenure, payment, agreement, and pickup/return handover evidence.</p>
        </div>
        <table>
          <thead><tr><th>Customer &amp; Car</th><th>Booking Window &amp; Tenure</th><th>Fare &amp; Settlement Split</th><th>Status &amp; Handover</th><th>Operations</th></tr></thead>
          <tbody>
            ${data.map(b => {
              const st = formatBookingStatus(b);
              const hrs = b.tenureHours || Math.max(1, Math.ceil((new Date(b.endDate) - new Date(b.startDate)) / 3600000));
              const platFee = b.platformFee == null ? null : Number(b.platformFee);
              const hostRev = b.hostRevenue == null ? null : Number(b.hostRevenue);
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
                  <p style="margin:2px 0;font-size:11.5px;font-weight:700;">${platFee == null ? '<span class="text-muted">Settlement pending reconciliation</span>' : `<span style="color:var(--purple);">Platform fee: ${money(platFee)}</span> · <span style="color:#059669;">Partner settlement: ${money(hostRev)}</span>`}</p>
                </td>
                <td>
                  ${badge(st)}${flags.has(b.id) ? `<div class="booking-review-flag" data-testid="booking-review-flag"><span class="badge warn">Needs review</span><ul class="eligibility-reasons">${flagText(flags.get(b.id)).map(t => `<li>${esc(t)}</li>`).join('')}</ul></div>` : ''}
                  ${b.payment ? `<span style="margin-left:4px">${badge(b.payment.status)}</span>` : ''}
                  <p style="margin:4px 0 0;font-size:11.5px;color:var(--text-muted);">Handovers: <strong>${b.inspections?.length || 0} / 2</strong> recorded</p>
                </td>
                <td>
                  <div class="actions" style="flex-wrap:wrap;gap:6px;">
                    ${st === 'PENDING' ? `<button class="button btn-orange btn-sm record-pmt-action" data-id="${esc(b.id)}" data-amount="${b.totalAmount}">Record Payment</button>` : ''}
                    ${['CONFIRMED','ACTIVE'].includes(b.status) ? `<button class="button btn-orange btn-sm admin-handover-btn" data-id="${esc(b.id)}" data-stage="${b.status === 'CONFIRMED' ? 'PICKUP' : 'RETURN'}">${b.status === 'CONFIRMED' ? '📸 Pickup 9-Photo' : '🏁 Return 9-Photo'}</button>` : ''}
                    ${b.inspections?.length ? `<button class="btn-outline btn-sm admin-inspect-photos-btn" data-id="${esc(b.id)}">👁️ View Handover Photos</button>` : ''}
                    <a class="button btn-ghost btn-sm" href="agreement.html?id=${encodeURIComponent(b.id)}">📄 e-Agreement</a>
                    ${b.invoice ? `<a class="button btn-ghost btn-sm" href="invoice.html?id=${encodeURIComponent(b.invoice.id)}">🧾 Invoice</a>` : ''}
                    ${['COMPLETED','CANCELLED'].includes(st) && b.securityDeposit > 0 && b.settlement?.status !== 'SETTLED' ? `<button class="button btn-outline btn-sm booking-settle-action" data-id="${esc(b.id)}">Settle deposit</button>` : ''}
                    ${['CONFIRMED','ACTIVE','PENDING'].includes(st) ? `<button class="btn-outline btn-sm booking-swap-action" data-id="${esc(b.id)}">Swap</button><button class="btn-ghost btn-sm booking-cancel-admin-action" data-id="${esc(b.id)}" style="color:var(--red);">Cancel</button>` : ''}
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
      <section class="panel table-wrap">
        <h3>Host and dealer payout accounts</h3>
        <table>
          <thead><tr><th>Account holder</th><th>Bank details</th><th>Verification</th><th>Payout history</th></tr></thead>
          <tbody>
            ${adminData.payoutAccounts.map(account => {
              const reviewer = account.userId !== user.id && account.changedById !== user.id;
              const state = account.verificationCurrent ? `Verified (version ${esc(account.revision)})` : account.status === 'VERIFIED' ? 'Re-verification required' : account.status === 'REJECTED' ? 'Rejected' : `Awaiting second approval (version ${esc(account.revision)})`;
              return `
              <tr>
                <td>${esc((account.user?.firstName || '') + ' ' + (account.user?.lastName || ''))}<p class="text-muted">${esc(account.user?.email || '')} · ${esc(account.user?.role || '')}</p></td>
                <td>${esc(account.bankName)} · •••• ${esc(account.accountNumberLast4)}<br><span class="text-muted">IFSC ${esc(account.ifscCode)}</span><br><span class="text-muted">Changed ${account.changedAt ? dt(account.changedAt) : '—'}${account.changedById === account.userId ? ' by the account owner' : ''}</span></td>
                <td>${badge(account.status)}<br><span class="text-muted" data-testid="payout-account-state">${state}</span><br>${reviewer
                  ? `<button class="btn-outline btn-sm payout-account-status-action" data-id="${esc(account.id)}" data-revision="${esc(account.revision)}">Review version ${esc(account.revision)}</button>`
                  : '<span class="text-muted">A different administrator must review these details</span>'}</td>
                <td>${account.payouts?.length || 0} payouts</td>
              </tr>`; }).join('') || '<tr><td colspan="4">No payout accounts submitted.</td></tr>'}
          </tbody>
        </table>
      </section>
      <section class="panel table-wrap">
        <h3>Created payouts</h3>
        <table>
          <thead><tr><th>Host / dealer</th><th>Amount</th><th>Period</th><th>Destination (snapshot)</th><th>Status</th><th>Action</th></tr></thead>
          <tbody>
            ${adminData.payouts.map(payout => {
              const open = ['PENDING', 'FAILED'].includes(payout.status);
              const needsReconciliation = open && (payout.destinationState !== 'CAPTURED' || !payout.destinationReady);
              const destination = payout.destinationState === 'CAPTURED'
                ? `${esc(payout.destinationBankName || '')} · •••• ${esc(payout.destinationAccountNumberLast4 || '')}<br><span class="text-muted">IFSC ${esc(payout.destinationIfscCode || '')} · version ${esc(payout.destinationAccountRevision ?? '')}</span>`
                : `<span class="text-muted">${payout.destinationState === 'LEGACY_UNVERIFIED' ? 'Recorded before destination snapshots' : 'No verified destination — reconciliation required'}</span>`;
              return `
              <tr>
                <td>${esc((payout.account?.user?.firstName || '') + ' ' + (payout.account?.user?.lastName || ''))}<p class="text-muted">${esc(payout.account?.user?.email || '')}</p></td>
                <td><strong>${money(payout.amount)}</strong></td>
                <td>${payout.periodStart ? d(payout.periodStart) : '—'} → ${payout.periodEnd ? d(payout.periodEnd) : '—'}</td>
                <td>${destination}${payout.destinationState === 'CAPTURED' && !payout.destinationReady && !['PAID', 'CANCELLED'].includes(payout.status) ? '<br><span class="error" data-testid="payout-on-hold">On hold: bank details changed</span>' : ''}</td>
                <td>${badge(payout.status)}${payout.reference ? `<br><span class="text-muted">${esc(payout.reference)}</span>` : ''}</td>
                <td><button class="btn-outline btn-sm payout-status-action" data-id="${esc(payout.id)}">Update payout</button>${needsReconciliation ? `<br><button class="btn-outline btn-sm payout-reconcile-action" data-id="${esc(payout.id)}">Reconcile</button>` : ''}</td>
              </tr>`; }).join('') || '<tr><td colspan="6">No payouts created.</td></tr>'}
          </tbody>
        </table>
      </section>`;
  }

  if (tab === 'users') {
    $('#admin-panel-content').innerHTML = `
      <section class="panel table-wrap">
        <div style="margin-bottom:14px;">
          <h3 style="margin:0;">Registered Customers, Hosts &amp; Identity Status</h3>
          <p class="text-muted" style="margin:4px 0 0;">View Mobile OTP verification, Aadhaar mask and KYC status; approve documents individually after reviewing them in Documents.</p>
        </div>
        <table>
          <thead><tr><th>Member Name</th><th>Contact &amp; OTP</th><th>Role</th><th>KYC</th><th>Account Actions</th></tr></thead>
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
                    <button class="btn-outline btn-sm user-password-action" data-id="${esc(u.id)}" data-email="${esc(u.email)}">Password</button>
                    ${u.role === 'ADMIN' ? '' : `<button class="btn-ghost btn-sm user-block-action" data-id="${esc(u.id)}" data-blocked="${u.isBlocked ? 'false' : 'true'}">${u.isBlocked ? 'Unblock' : 'Block'}</button>`}
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
        <table class="audit-table">
          <thead><tr><th>When</th><th>Event</th><th>By</th><th>Record</th><th>Details</th></tr></thead>
          <tbody>
            ${data.map(a => `
              <tr>
                <td class="audit-when" data-label="When">${dt(a.createdAt)}</td>
                <td class="audit-event" data-label="Event">${auditEvent(a.action)}</td>
                <td class="audit-actor" data-label="By">${auditActor(a.actorId)}</td>
                <td class="audit-target" data-label="Record">${auditTarget(a.targetId)}</td>
                <td class="audit-detail" data-label="Details">${auditDetail(a.detail)}</td>
              </tr>`).join('')}
          </tbody>
        </table>
      </section>`;
  }

  if (tab === 'disputes') {
    $('#admin-panel-content').innerHTML = `
      <section class="panel table-wrap">
        <div style="margin-bottom:14px;"><h3 style="margin:0">Booking disputes &amp; resolution queue</h3><p class="text-muted" style="margin:4px 0 0">Review booking-linked billing, deposit, handover and damage claims. Every response is appended to the audit trail.</p></div>
        <table>
          <thead><tr><th>Reference / Customer</th><th>Booking &amp; Vehicle</th><th>Issue</th><th>Status</th><th>Action</th></tr></thead>
          <tbody>${data.map(dispute => `<tr>
            <td><strong>${esc(dispute.reference)}</strong><br>${esc((dispute.customer?.firstName || '') + ' ' + (dispute.customer?.lastName || ''))}<br><small class="text-muted">${esc(dispute.customer?.email || '')}</small></td>
            <td><strong>${esc(dispute.bookingRef || dispute.bookingId || '—')}</strong><br><small>${esc(dispute.vehicleTitle)}</small></td>
            <td><strong>${esc(dispute.category.replaceAll('_', ' '))}</strong><p style="margin:4px 0 0">${esc(dispute.description)}</p>${dispute.amountClaimed ? `<small class="text-muted">Claimed: ${money(dispute.amountClaimed)}</small>` : ''}</td>
            <td>${badge(dispute.status)}${dispute.adminResponse ? `<p class="text-muted" style="margin:5px 0 0;font-size:12px">${esc(dispute.adminResponse)}</p>` : ''}</td>
            <td><button type="button" class="button btn-orange btn-sm resolve-dispute-action" data-id="${esc(dispute.id)}" data-reference="${esc(dispute.reference)}">Review</button></td>
          </tr>`).join('') || '<tr><td colspan="5">No booking disputes have been submitted.</td></tr>'}</tbody>
        </table>
      </section>`;
  }

  if ($('#admin-add-vehicle-btn')) {
    $('#admin-add-vehicle-btn').onclick = () => {
      showDialog(`
        <h3>Add New Vehicle to Fleet</h3>
        <p class="text-muted">Creates a listing awaiting approval. Add all eight photos and upload RC, Insurance and PUC from the car folder; a different administrator must review the evidence before the car can go live.</p>
        <form id="admin-add-vehicle-form" class="form-stack">
          ${inp('make', 'Vehicle Make (e.g. Hyundai)', 'text', 'required maxlength="50"')}
          ${inp('model', 'Model (e.g. Creta)', 'text', 'required maxlength="50"')}
          ${inp('year', 'Year of Manufacture', 'number', `required min="1990" max="${new Date().getFullYear() + 1}" value="2024"`)}
          ${inp('registrationNumber', 'Registration Number (e.g. GJ01AB1234)', 'text', 'required maxlength="16" style="text-transform:uppercase"')}
          ${inp('city', 'City (e.g. Ahmedabad)', 'text', 'required maxlength="50" value="Ahmedabad"')}
          ${sel('category', 'Category', ['Hatchback', 'Sedan', 'Compact SUV', 'SUV', 'MUV', 'Luxury'])}
          ${sel('transmission', 'Transmission', ['Automatic', 'Manual'])}
          ${sel('fuelType', 'Fuel Type', ['Petrol', 'Diesel', 'Electric', 'CNG', 'Hybrid'])}
          ${inp('seats', 'Seating Capacity', 'number', 'required min="2" max="12" value="5"')}
          ${inp('pricePerDay', 'Daily Rate (₹)', 'number', 'required min="1" max="1000000" value="2500"')}
          ${inp('odometer', 'Current Odometer (km)', 'number', 'required min="0" max="2000000" value="5000"')}
          <label>Front photo (optional)<input name="frontPhoto" type="file" accept="image/jpeg,image/png,image/webp"></label>
          <label>Image URL (optional, https only)<input name="images" type="url" pattern="https://.+" maxlength="2048" placeholder="https://"></label>
          <button type="submit" class="button btn-orange">Create Pending Listing</button>
        </form>
      `);

      bindForm('#admin-add-vehicle-form', async (data, form) => {
        const { frontPhoto, ...fields } = data;
        const file = form.frontPhoto.files[0];
        const mediaIds = file ? [(await uploadFile(file, 'FRONT')).id] : [];
        await post('/admin/vehicles', { ...fields, mediaIds });
        $('dialog').close();
        await adminPage('vehicles');
        toast('Listing created and awaiting approval. Add photos and documents from its folder.');
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
      $('dialog').close();
      const activeTab = currentAdminTab || 'vehicles';
      await adminPage(activeTab);
      toast('Daily rate updated.');
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
              ${data.candidates.map(c => `<option value="${esc(c.id)}">${esc(c.make + ' ' + c.model + ' (' + (c.registrationNumber || 'No Reg') + ') · ₹' + c.pricePerDay + '/day')}</option>`).join('')}
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

  $$('.booking-settle-action').forEach(btn => btn.onclick = async () => {
    try {
      const preview = await api('/admin/bookings/' + encodeURIComponent(btn.dataset.id) + '/settlement');
      showDialog(`
        <h3>Settle booking deposit</h3>
        <p class="text-muted">Automatic charges: <strong>${money(preview.automaticCharges || 0)}</strong> · Suggested refund: <strong>${money(preview.suggestedDepositDeduction == null ? 0 : Math.max(0, Number(preview.depositHeld || 0) - Number(preview.suggestedDepositDeduction || 0)))}</strong></p>
        <form id="admin-booking-settlement-form" class="form-stack">
          <div class="form-grid">
            <label>Damage charges<input name="damageCharges" type="number" min="0" step="0.01" value="0"></label>
            <label>Fuel charges<input name="fuelCharges" type="number" min="0" step="0.01" value="0"></label>
            <label>Toll charges<input name="tollCharges" type="number" min="0" step="0.01" value="0"></label>
            <label>Traffic fine charges<input name="fineCharges" type="number" min="0" step="0.01" value="0"></label>
            <label>Cleaning charges<input name="cleaningCharges" type="number" min="0" step="0.01" value="0"></label>
            <label>Other charges<input name="otherCharges" type="number" min="0" step="0.01" value="0"></label>
          </div>
          <label>Settlement note<textarea name="note" required maxlength="2000">Return inspection reviewed; automatic excess-kilometre and late-return charges applied where applicable.</textarea></label>
          <button type="submit" class="button btn-orange">Confirm settlement</button>
        </form>`);
      bindForm('#admin-booking-settlement-form', async formData => {
        const result = await post('/admin/bookings/' + encodeURIComponent(btn.dataset.id) + '/settle', formData);
        $('dialog').close();
        await adminPage('bookings');
        toast(`Settlement recorded. Refund due: ${money(result.refundAmount)}${Number(result.additionalAmountDue) ? ` · Additional due: ${money(result.additionalAmountDue)}` : ''}`);
      });
    } catch (err) { toast(err.message, true); }
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

  $$('.resolve-dispute-action').forEach(btn => btn.onclick = () => {
    const dispute = adminData.disputes.find(item => item.id === btn.dataset.id);
    showDialog(`<h3>Review dispute ${esc(btn.dataset.reference)}</h3>
      <p class="text-muted">${esc(dispute?.description || '')}</p>
      <form id="admin-dispute-form" class="form-stack">
        <label>Decision<select name="status" required><option value="UNDER_REVIEW">Under review</option><option value="INFO_REQUIRED">Information required</option><option value="RESOLVED">Resolved</option><option value="REJECTED">Rejected</option></select></label>
        <label>Response / internal note<textarea name="note" required maxlength="1000" placeholder="Explain the decision or request evidence."></textarea></label>
        <button type="submit" class="button btn-orange">Save dispute decision</button>
      </form>`);
    bindForm('#admin-dispute-form', async formData => {
      await post('/admin/disputes/' + encodeURIComponent(btn.dataset.id) + '/resolve', formData);
      $('dialog').close();
      await adminPage('disputes');
      toast('Dispute decision saved.');
    });
  });
  // ── compliance-gated actions from new-change ──
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
  $$('.booking-settlement-action').forEach(btn => btn.onclick = async () => {
    try {
      const s = await api('/admin/bookings/' + btn.dataset.id + '/settlement');
      showDialog(`<h3>Deposit settlement preview</h3>
        <div class="notice"><p><strong>Deposit held:</strong> ${money(s.depositHeld)}</p><p><strong>Distance:</strong> ${s.travelledKilometres == null ? 'Not recorded' : Number(s.travelledKilometres).toLocaleString('en-IN') + ' km'} · Included ${s.includedKilometres == null ? '—' : Number(s.includedKilometres).toLocaleString('en-IN') + ' km'}</p><p><strong>Excess distance charge:</strong> ${money(s.excessCharge)}</p><p><strong>Late return charge:</strong> ${money(s.lateCharge)} (${Number(s.lateMinutes)} minutes after grace)</p><p><strong>Suggested automatic deduction:</strong> ${money(s.suggestedDepositDeduction)}</p><p><strong>Estimated release:</strong> ${money(s.estimatedDepositRelease)}</p></div><p class="text-muted">${esc(s.note)}${s.damageReviewRequired ? ' A damage note is present; complete a documented damage review before releasing the balance.' : ''}</p>`);
    } catch (err) { toast(err.message, true); }
  });
  $$('.user-block-action').forEach(btn => btn.onclick = async () => {
    const blocking = btn.dataset.blocked === 'true';
    const reason = window.prompt(blocking ? 'Reason for blocking this account:' : 'Reason for unblocking this account:');
    if (!reason || !reason.trim()) return;
    try { await post('/admin/users/' + encodeURIComponent(btn.dataset.id) + '/block', { blocked: blocking, note: reason.trim() }); await adminPage('users'); toast(blocking ? 'Customer account blocked.' : 'Customer account unblocked.'); }
    catch (err) { toast(err.message, true); }
  });
  $$('.payout-account-status-action').forEach(btn => btn.onclick = async () => {
    const status = window.prompt(`Review bank details version ${btn.dataset.revision}: VERIFIED, REJECTED or PENDING (revoke)`, 'VERIFIED');
    if (!status) return;
    // The reviewed version is sent so the approval cannot apply to details changed after this page loaded.
    try { await post('/payouts/accounts/' + encodeURIComponent(btn.dataset.id) + '/status', { status: status.trim().toUpperCase(), revision: Number(btn.dataset.revision) }); await adminPage('payouts'); toast('Payout account review recorded.'); }
    catch (err) { toast(err.message, true); }
  });
  $$('.payout-reconcile-action').forEach(btn => btn.onclick = async () => {
    const decision = window.prompt('Reconcile this payout: REISSUE (cancel and recreate it to the current verified bank account) or CANCEL', 'REISSUE');
    if (!decision) return;
    const note = window.prompt('Reason for this decision (recorded in the audit log):', '');
    if (!note) return;
    try { await post('/payouts/' + encodeURIComponent(btn.dataset.id) + '/reconcile', { decision: decision.trim().toUpperCase(), note: note.trim() }); await adminPage('payouts'); toast('Payout reconciled.'); }
    catch (err) { toast(err.message, true); }
  });
  $$('.payout-status-action').forEach(btn => btn.onclick = async () => {
    const status = window.prompt('Set payout status (PENDING, PROCESSING, PAID, FAILED or CANCELLED):', 'PAID');
    if (!status) return;
    const normalized = status.trim().toUpperCase();
    const reference = window.prompt(normalized === 'PAID' ? 'Bank transaction reference / UTR of this transfer (required for PAID):' : 'Bank reference / UTR (optional):', '');
    if (reference === null) return;
    try { await post('/payouts/' + encodeURIComponent(btn.dataset.id) + '/status', { status: status.trim().toUpperCase(), reference: reference?.trim() || undefined }); await adminPage('payouts'); toast('Payout status updated.'); }
    catch (err) { toast(err.message, true); }
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

  $$('.doc-review-action').forEach(btn => btn.onclick = () => openDocumentReview(btn.dataset.id));

  $$('.record-pmt-action, .record-ref-action').forEach(btn => btn.onclick = () => {
    const isRefund = btn.classList.contains('record-ref-action');
    showDialog(`
      <h3>${isRefund ? 'Record Bank Refund' : 'Record Received Payment'}</h3>
      <p class="text-muted">Verify the bank transaction entry in your corporate account statement before confirming.</p>
      <form id="admin-pmt-form" class="form-stack">
        ${inp('reference','Bank Transaction Reference / UTR Number')}
        ${!isRefund ? inp('amount','Amount Received (₹)','number',`step="1" value="${esc(btn.dataset.amount)}"`) : ''}
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
  await Promise.all([api('/auth/profile').then(u => { user = u; }).catch(() => {}), loadCompany()]);
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
    // No GPS/telematics provider or tracking API exists, so this page states that plainly instead of promising it.
    'tracking.html': () => {
      $('#app').innerHTML = sectionHead('Vehicle Tracking', 'Live vehicle tracking is not available.') +
        '<div class="notice" data-testid="tracking-unavailable">Safar does not offer live location tracking. Trip start and end are recorded through the pickup and return inspections on your bookings.</div>' +
        '<div class="actions"><a class="button" href="dashboard.html">Go to my bookings</a></div>';
    },
  };

  try { await (routes[page] || home)(); }
  catch (e) {
    $('#app').innerHTML = `
      <div class="error" role="alert">${esc(e.message)}</div>
      <div class="actions"><button data-action="reload">Retry</button></div>`;
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
        <div class="schedule-list">${schedule.blocks.map(item => `<div><strong>${esc(item.reason)}</strong><p>${dt(item.startDate)} → ${dt(item.endDate)}</p><button type="button" class="btn-outline btn-sm release-block" data-id="${esc(item.id)}">Reopen dates</button></div>`).join('') || '<p class="text-muted">No blocked periods.</p>'}</div>
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
  const reasons = v.eligibility?.reasons || [];
  // Compliance documents (RC, Insurance, PUC) currently block approval.
  const docsBlocked = reasons.some(r => /^(RC|INSURANCE|PUC)_/.test(r));
  // Only an approved car whose documents are valid can be put on sale (being inactive is the only remaining reason).
  const canActivate = v.approvalStatus === 'APPROVED' && reasons.every(r => r === 'UNAVAILABLE');
  const contentHtml = `
    <div class="car-folder-workspace">
      <div style="display:flex;align-items:center;gap:14px;padding-bottom:14px;border-bottom:1px solid var(--border-main)">
        <img ${vehicleImageSlot(vehicleCoverUrl(v))} alt="${esc(v.make + ' ' + v.model)}" style="width:64px;height:64px;object-fit:cover;border-radius:8px;border:1px solid var(--border-main)">
        <div style="flex:1">
          <div class="folder-title">
            <h3 style="margin:0">${esc(v.make + ' ' + v.model + ' ' + v.year)}</h3>
            ${vehicleStateBadges(v)}
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
          <div style="display:grid;grid-template-columns:repeat(3, minmax(0, 1fr));gap:12px;font-size:13px">
            <div><span class="text-muted">Category:</span><br><strong>${esc(v.category || 'SUV')}</strong></div>
            <div><span class="text-muted">Transmission:</span><br><strong>${esc(v.transmission || 'AUTOMATIC')}</strong></div>
            <div><span class="text-muted">Fuel Type:</span><br><strong>${esc(v.fuelType || 'PETROL')}</strong></div>
            <div><span class="text-muted">Seats:</span><br><strong>${v.seats || 5} Seats</strong></div>
            <div><span class="text-muted">Daily Rate:</span><br><strong>${money(v.pricePerDay)}</strong></div>
            <div><span class="text-muted">Odometer:</span><br><strong>${Number(v.odometer || 0).toLocaleString('en-IN')} km</strong></div>
          </div>
        </div>
        <div class="card" style="margin-bottom:14px;padding:16px" data-testid="folder-vehicle-state">
          <h4 style="margin:0 0 8px 0">Approval &amp; availability</h4>
          <p style="margin:0">${vehicleStateBadges(v)}</p>
          ${v.approvedAt ? `<p class="text-muted" style="font-size:13px">Approved ${dt(v.approvedAt)}</p>` : ''}
          ${v.rejectedReason && v.approvalStatus === 'REJECTED' ? `<p class="error">Rejection reason: ${esc(v.rejectedReason)}</p>` : ''}
          ${v.eligibility?.bookable ? '<p class="text-muted" style="font-size:13px">Publicly bookable now.</p>' : `<p class="text-muted" style="font-size:13px;margin-bottom:0">Not bookable:</p>${eligibilityList(v.eligibility?.reasons)}`}
        </div>
        ${v.hostId === user.id ? '<p class="notice info">Another administrator must review and approve your own listing.</p>' : ({ PENDING_APPROVAL: ['APPROVE', 'REJECT'], APPROVED: ['REVOKE'] }[v.approvalStatus] ? `
        <form id="folder-decision-form" class="form-stack">
          <h4 style="margin:0 0 8px 0">Approval decision</h4>
          ${v.approvalStatus === 'PENDING_APPROVAL' && docsBlocked ? `
          <div class="notice approval-blocked" data-testid="approval-blocked">
            <strong>Approval is blocked until RC, Insurance and PUC are verified from real documents.</strong>
            <ol>
              <li>The owner uploads the original RC, Insurance and PUC (owner fleet → <em>Upload RC, Insurance &amp; PUC</em>).</li>
              <li>In the <em>Documents</em> tab, open each upload, check the original, and approve it with its expiry date.</li>
              <li>Come back here and approve the listing.</li>
              <li>Then set availability to <em>Accept bookings</em> below to list the car.</li>
            </ol>
            <small>Demo and test records, or approvals without an evidence file, can never approve a car. You can still reject the listing with a note.</small>
          </div>` : ''}
          <label>Decision<select name="decision" required>${({ PENDING_APPROVAL: docsBlocked ? ['REJECT'] : ['APPROVE', 'REJECT'], APPROVED: ['REVOKE'] }[v.approvalStatus]).map(d => `<option value="${d}">${{ APPROVE: 'Approve listing', REJECT: 'Reject listing', REVOKE: 'Revoke approval (back to review)' }[d]}</option>`).join('')}</select></label>
          <label>Reviewer Note / Decision Reason
            <textarea name="note" required maxlength="1000" placeholder="Notes on inspection photos and compliance evidence…"></textarea>
          </label>
          <p class="text-muted" style="font-size:13px">Approval does not list the car. Availability is set separately below. Revoking stops new bookings and places a review hold: after re-approval, an administrator must reactivate the car below. Existing bookings are kept; upcoming ones are flagged for review.</p>
          <button type="submit" class="button btn-orange" id="folder-decision-submit">Save Approval Decision</button>
        </form>` : `<p class="text-muted">${v.approvalStatus === 'REJECTED' ? 'Rejected. Waiting for the owner to fix and resubmit.' : 'Draft. Waiting for the owner to add photos and submit for review.'}</p>`)}
        <form id="folder-availability-form" class="form-stack" style="margin-top:14px">
          <h4 style="margin:0 0 8px 0">Availability for new bookings</h4>
          <label>Availability<select name="availability" required>
            ${canActivate || v.availability === 'ACTIVE' ? '<option value="ACTIVE">Accept bookings</option>' : ''}
            <option value="ADMIN_SUSPENDED">Suspend new bookings</option>
            <option value="MAINTENANCE">Maintenance: stop new bookings</option>
          </select></label>
          ${canActivate || v.availability === 'ACTIVE' ? '' : '<p class="notice availability-locked" data-testid="availability-locked">Accept bookings becomes available once the car is approved and its RC, Insurance and PUC are verified.</p>'}
          <p class="text-muted" style="font-size:13px">Stopping new bookings never cancels, refunds or changes existing bookings; upcoming ones are flagged for review.</p>
          <button type="submit" class="button btn-outline">Save Availability</button>
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
              return `<figure><a href="/api/media/${encodeURIComponent(m.id)}" target="_blank" rel="noopener noreferrer"><img loading="lazy" src="/api/media/${encodeURIComponent(m.id)}" alt="${esc(m.kind)}"></a><figcaption>${esc((m.kind || '').replaceAll('_', ' '))}</figcaption></figure>`;
            } else {
              return `<figure style="opacity:0.6;background:var(--bg-subtle,#f5f5f7);display:flex;flex-direction:column;align-items:center;justify-content:center;min-height:120px;text-align:center;padding:12px"><span style="font-size:24px">📷</span><figcaption style="padding:4px 0">${esc(angle.replaceAll('_', ' '))}<br><small class="text-muted">Not uploaded</small></figcaption></figure>`;
            }
          }).join('')}
        </div>
        ${['DRAFT', 'PENDING_APPROVAL', 'REJECTED'].includes(v.approvalStatus) && v.hostId === user.id && PHOTO_ANGLES.some(a => !v.media?.some(m => m.kind === a)) ? `
        <form id="folder-photo-form" class="form-stack" style="margin-top:14px">
          <h4 style="margin:0">Add a missing photo</h4>
          <label>Angle<select name="kind">${PHOTO_ANGLES.filter(a => !v.media?.some(m => m.kind === a)).map(a => `<option value="${a}">${esc(a.replaceAll('_', ' '))}</option>`).join('')}</select></label>
          <label>Photo<input name="photo" type="file" accept="image/jpeg,image/png,image/webp" required></label>
          <button type="submit" class="button btn-sm">Add Photo</button>
        </form>` : ''}
      </div>

      <div id="folder-tab-content-compliance" class="folder-tab-content" hidden>
        <h4 style="margin:0 0 10px 0">Compliance &amp; Legal Documents</h4>
        ${v.documents?.length ? `
          <div class="table-wrap">
            <table style="margin-top:8px">
              <thead><tr><th>Document Type</th><th>Status</th><th>Valid Until</th><th>Source</th><th>Action</th></tr></thead>
              <tbody>
                ${v.documents.map(d => `
                  <tr>
                    <td><strong>${esc(d.kind)}</strong></td>
                    <td>${docStatusBadge(d)}</td>
                    <td>${d.validUntil ? dt(d.validUntil) : 'N/A'}</td>
                    <td>${sourceCell(d, (d.source || 'UPLOAD').replaceAll('_', ' '))}</td>
                    <td class="compliance-action">${
                      // An uploaded document that is not yet verified can be reviewed and approved right here.
                      d.mediaId && !unverifiedDocument(d) && docStanding(d)[0] !== 'ok' && d.userId !== user.id
                        ? `<button type="button" class="button btn-orange btn-sm folder-doc-review" data-id="${esc(d.id)}">Review &amp; approve</button>`
                        : d.mediaId ? `<a href="/api/media/${encodeURIComponent(d.mediaId)}" target="_blank" rel="noopener noreferrer" class="btn-ghost btn-sm">View Evidence</a>`
                        : `<span class="text-muted" title="No document file was ever uploaded for this record, so it cannot be approved. The owner must upload the original from My Fleet.">Needs owner upload</span>`
                    }</td>
                  </tr>`).join('')}
              </tbody>
            </table>
          </div>
        ` : '<p class="text-muted" style="margin-top:10px">No compliance documents attached to this vehicle.</p>'}
        ${v.hostId === user.id ? `<p style="margin-top:10px"><a class="button btn-ghost btn-sm" href="kyc.html?vehicle=${encodeURIComponent(v.id)}">Upload RC, Insurance &amp; PUC →</a></p>` : ''}
      </div>

      <div id="folder-tab-content-schedule" class="folder-tab-content" hidden>
        <h4 style="margin:0 0 10px 0">Availability &amp; Schedule Management</h4>
        <div id="folder-schedule-container" class="loading">Loading vehicle schedule…</div>
      </div>
    </div>
  `;

  showDialog(contentHtml);

  const availabilitySel = $('#folder-availability-form select[name="availability"]');
  if (availabilitySel) availabilitySel.value = v.availability === 'ACTIVE' ? 'ACTIVE' : v.availabilityReason === 'MAINTENANCE' ? 'MAINTENANCE' : 'ADMIN_SUSPENDED';

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

  // Compliance tab: review an uploaded document, then come back to this car's folder with fresh data.
  $$('.folder-doc-review').forEach(btn => btn.onclick = () => openDocumentReview(btn.dataset.id, async () => {
    await adminPage('vehicles');
    const fresh = adminData.vehicles.find(x => x.id === v.id);
    if (fresh) openCarFolder(fresh);
  }));

  bindForm('#folder-photo-form', async (data, form) => {
    const photo = await uploadFile(form.photo.files[0], data.kind);
    await post('/vehicles/' + encodeURIComponent(v.id) + '/photos', { mediaIds: [photo.id] });
    $('dialog').close();
    await adminPage('vehicles');
    toast(data.kind.replaceAll('_', ' ') + ' photo added.');
  });

  // The button names the action actually selected, so a preselected "Reject" can never be mistaken for approval.
  const decisionSelect = $('#folder-decision-form select[name="decision"]');
  const decisionLabels = { APPROVE: 'Approve listing', REJECT: 'Reject listing', REVOKE: 'Revoke approval' };
  const syncDecisionButton = () => { if (decisionSelect) $('#folder-decision-submit').textContent = decisionLabels[decisionSelect.value] || 'Save Approval Decision'; };
  decisionSelect?.addEventListener('change', syncDecisionButton);
  syncDecisionButton();

  bindForm('#folder-decision-form', async data => {
    if (data.decision === 'REJECT' && !confirm('Reject this listing? The owner will need to fix the issues and resubmit it for review.')) return;
    if (data.decision === 'REVOKE' && !confirm('Revoke approval? The car stops taking new bookings and is held for review.')) return;
    try { await post('/admin/vehicles/' + encodeURIComponent(v.id) + '/review', data); }
    catch (err) { throw new Error(errorWithReasons(err)); }
    $('dialog').close();
    await adminPage('vehicles');
    toast('Approval decision saved.');
  });

  bindForm('#folder-availability-form', async data => {
    const body = data.availability === 'ACTIVE' ? { availability: 'ACTIVE' } : { availability: 'INACTIVE', reason: data.availability };
    let result;
    try { result = await post('/vehicles/' + encodeURIComponent(v.id) + '/availability', body); }
    catch (err) { throw new Error(errorWithReasons(err)); }
    $('dialog').close();
    await adminPage('vehicles');
    toast(result?.flaggedBookings ? `Availability saved. ${result.flaggedBookings} upcoming booking(s) flagged for review.` : 'Availability saved.');
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
      <div class="schedule-list">${schedule.blocks.map(item => `<div><strong>${esc(item.reason)}</strong><p>${dt(item.startDate)} → ${dt(item.endDate)}</p><button type="button" class="btn-outline btn-sm release-folder-block" data-id="${esc(item.id)}">Reopen dates</button></div>`).join('') || '<p class="text-muted" style="font-size:13px">No blocked periods.</p>'}</div>
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

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
});
document.addEventListener('error', e => {
  if (e.target instanceof HTMLImageElement && e.target.hasAttribute('data-hide-on-error')) e.target.style.display = 'none';
}, true);
// Missing or unreachable vehicle photos fall back to the logo once (error events do not bubble, so capture them).
document.addEventListener('error', e => {
  const img = e.target;
  if (!(img instanceof HTMLImageElement) || !img.hasAttribute('data-vehicle-image') || img.dataset.fallbackApplied) return;
  img.dataset.fallbackApplied = '1';
  img.classList.add('vehicle-image-fallback');
  img.src = VEHICLE_IMAGE_FALLBACK;
}, true);

const badge = s => {
  const cls = ['ACTIVE','APPROVED','CONFIRMED','PAID','COMPLETED','SUCCESS','VERIFIED'].includes(s) ? 'good'
    : ['REJECTED','CANCELLED','FAILED','EXPIRED'].includes(s) ? 'red' : 'warn';
  const val = String(s || '');
  return `<span class="badge ${cls}">${esc(val.replaceAll('_',' '))}</span>`;
};

/* Vehicle approval, availability and eligibility (owners and admins; customers only ever see safe messages). */
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

const page = location.pathname.split('/').pop() || 'index.html';
let user = null, adminData;

/* ─── API Client ─────────────────────────────────────────────────────── */
async function api(path, opts = {}) {
  const res = await fetch('/api' + path, {
    credentials: 'same-origin', ...opts,
    headers: opts.body instanceof FormData ? {} : {'Content-Type':'application/json', ...(opts.headers||{})},
  });
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
async function uploadFile(file, kind) {
  if (!file?.size) throw new Error(`Please choose a ${kind.toLowerCase()} image`);
  const fd = new FormData(); fd.append('file', file);
  return api('/media?kind=' + kind, {method:'POST', body: fd});
}
function requireUser(roles) {
  if (!user) { location.replace('auth.html?redirect=' + encodeURIComponent(page + location.search)); return false; }
  if (roles && !roles.includes(user.role)) {
    $('#app').innerHTML = empty('Access Denied', `This page requires a ${roles.join(' or ')} account.`);
    return false;
  }
  return true;
}

/* Admin sections, shown as the header menu for administrators. */
const ADMIN_SECTIONS = ['dashboard', 'vehicles', 'documents', 'bookings', 'users', 'payouts', 'audit'];
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
};
// The account section on this page ('' elsewhere). kyc.html is the verification page.
const customerSectionFromPage = () => page === 'kyc.html' ? 'kyc'
  : page === 'dashboard.html' || page === 'payment.html' ? (CUSTOMER_SECTIONS.some(([t]) => t === new URLSearchParams(location.search).get('tab')) ? new URLSearchParams(location.search).get('tab') : 'trips') : '';
const syncCustomerMenu = () => { $$('[data-account-link]').forEach(a => a.classList.toggle('active', a.dataset.accountLink === customerSectionFromPage())); };

/* ─── HEADER / SHELL (WITH MOBILE BOTTOM NAVIGATION) ─────────────────── */
function shell() {
  // The main menu is shown only to signed-in users; guests see the brand, theme toggle and Sign In / Register.
  // Administrators see the admin sections (Vehicles, Documents, …) as the menu, with live counts.
  const links = !user ? []
    : user.role === 'ADMIN' ? ADMIN_SECTIONS.map(t => ['admin.html?tab=' + t, t[0].toUpperCase() + t.slice(1), t])
    // Owners (hosts and dealers): task-based menu over their fleet, plus their own Account.
    : ['HOST', 'DEALER'].includes(user.role) ? [...HOST_SECTIONS.map(([t, label]) => ['host-onboarding.html?tab=' + t, label, null, t]), ['dashboard.html', 'Account']]
    // Customers: renting tasks. Each account section is a direct link (listing a car stays on the home page).
    : [['cars.html', 'Explore Cars'], ...CUSTOMER_SECTIONS.map(([t, label]) => ['dashboard.html?tab=' + t, label, null, null, t])];

  $('#header').innerHTML = `
    <div style="display:flex;align-items:center;gap:12px;">
      <a class="brand" href="index.html">
        <img src="safar-logo.png" alt="Safar" class="brand-logo" data-hide-on-error>
        <div class="brand-text">
          <span class="brand-name">safar</span>
          <span class="brand-tag">SELF DRIVE</span>
        </div>
      </a>
    </div>

    ${links.length ? `<nav class="nav${user?.role === 'ADMIN' ? ' admin-nav' : ''}" aria-label="${user?.role === 'ADMIN' ? 'Administration sections' : 'Main Navigation'}">
      ${links.map(([href, label, section, hostTab, accountTab]) => accountTab
        ? `<a href="${href}" data-account-link="${accountTab}" class="${customerSectionFromPage() === accountTab ? 'active' : ''}">${label}</a>`
        : section
        ? `<a href="${href}" data-tab="${section}" class="${page === 'admin.html' && adminSectionFromUrl() === section ? 'active' : ''}">${label}<span class="nav-count" data-admin-count="${section}"></span></a>`
        : hostTab
        ? `<a href="${href}" data-host-tab="${hostTab}" class="${page === 'host-onboarding.html' && hostSectionFromUrl() === hostTab ? 'active' : ''}">${label}</a>`
        : `<a class="${page === href || (href === 'dashboard.html' && page === 'kyc.html') ? 'active' : ''}" href="${href}">${label}</a>`).join('')}
    </nav>

    <details class="compact-menu"><summary aria-label="Open navigation menu">Menu <span aria-hidden="true">☰</span></summary><nav aria-label="Compact navigation">${links.map(([href,label,,,accountTab]) => `<a href="${href}" ${(accountTab ? customerSectionFromPage() === accountTab : page === href || (href === 'dashboard.html' && page === 'kyc.html')) ? 'aria-current="page"' : ''}>${label}</a>`).join('')}</nav></details>` : ''}
    <div class="account">
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

  // Mobile bottom bar. Guests: Home + Login. Customers: Cars, My Trips, Verification, Profile. Owners: their fleet tasks + Account.
  // Administrators use the Menu button (their admin sections) instead.
  if (!$('#mobile-bnav') && user?.role !== 'ADMIN') {
    const ICONS = {
      home: '<path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/>',
      car: '<path d="M5 17h14M6 17l1.5-6h9L18 17"/><circle cx="7.5" cy="17.5" r="1.5"/><circle cx="16.5" cy="17.5" r="1.5"/>',
      doc: '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/>',
      calendar: '<rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/>',
      user: '<path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>',
    };
    const owner = ['HOST', 'DEALER'].includes(user?.role);
    const hostTab = page === 'host-onboarding.html' ? hostSectionFromUrl() : '';
    const onAccount = page === 'dashboard.html' || page === 'kyc.html';
    const items = !user
      ? [['index.html', 'Home', 'home', page === 'index.html' || page === ''], ['auth.html', 'Login', 'user', page === 'auth.html']]
      : owner
        ? [['host-onboarding.html?tab=fleet', 'My Fleet', 'car', hostTab === 'fleet' || hostTab === 'add'],
           ['host-onboarding.html?tab=documents', 'Documents', 'doc', hostTab === 'documents'],
           ['host-onboarding.html?tab=bookings', 'Bookings', 'calendar', hostTab === 'bookings' || hostTab === 'payouts'],
           ['dashboard.html', 'Account', 'user', onAccount]]
        : [['cars.html', 'Cars', 'car', page === 'cars.html'], ['dashboard.html?tab=trips', 'My Trips', 'calendar', customerSectionFromPage() === 'trips'],
           ['dashboard.html?tab=kyc', 'Verification', 'doc', customerSectionFromPage() === 'kyc'], ['dashboard.html?tab=profile', 'Profile', 'user', customerSectionFromPage() === 'profile']];
    const bnav = document.createElement('nav');
    bnav.id = 'mobile-bnav';
    bnav.className = 'mobile-bnav';
    bnav.setAttribute('aria-label', 'Mobile Navigation');
    bnav.innerHTML = items.map(([href, label, icon, active]) => `
      <a class="bnav-item ${active ? 'active' : ''}" href="${href}">
        <svg width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24" aria-hidden="true">${ICONS[icon]}</svg>
        <span>${label}</span>
      </a>`).join('');
    document.body.appendChild(bnav);
  }
}

/* ─── CAR CARD (REFERENCE STYLE — CLEAN & EMOJI-FREE) ───────────────── */
/* Local preview cars: samples that show how the listing looks while no real car is approved yet. They exist only in
   the browser (no database records, no documents), appear only on a localhost dev server when browsing without trip
   dates, are clearly labelled and can never be opened or booked. They disappear once a real car is listed. */
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

function carCard(car) {
  const specs = [car.transmission, car.fuelType, car.seats + ' Seats', car.year].filter(Boolean).join(' · ');
  const rating = ratingSummary(car);
  return `
    <a class="car-card" href="${esc(carLink(car.id))}">
      <div class="car-card-media">
        <img ${vehicleImageSlot(vehicleCoverUrl(car))} alt="${esc(car.make + ' ' + car.model)}" loading="lazy">
        <span class="car-card-badge">Self-Drive</span>
        <span class="car-card-rating">${rating.value === 'New' ? 'New listing' : `★ ${rating.value} · ${rating.count} review${rating.count === 1 ? '' : 's'}`}</span>
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
// Service cities always offered in the home page pickup city list (city names only; no pickup points are claimed).
const PICKUP_CITIES = ['Ahmedabad', 'Surat', 'Vadodara', 'Rajkot', 'Gandhinagar'];

async function home() {
  // The search API requires pickup to be strictly in the future. Starting the
  // widget on today made the first click show a validation toast instead of
  // opening the available-car results.
  const tomorrow = new Date(Date.now() + 86400000);
  const dayAfter = new Date(Date.now() + 2 * 86400000);
  const dateInputValue = date => [date.getFullYear(), String(date.getMonth() + 1).padStart(2, '0'), String(date.getDate()).padStart(2, '0')].join('-');
  const today = dateInputValue(tomorrow);
  const tom = dateInputValue(dayAfter);

  $('#app').innerHTML = `
    <div class="hero reveal-on-scroll">
      <div>
        <span class="hero-eyebrow">SELF-DRIVE CAR RENTAL IN GUJARAT</span>
        <h1 class="hero-heading">
          Your Journey.<br>
          <span class="accent">Your Rules.</span>
        </h1>
        <p class="hero-desc">Rent verified self-drive cars across Gujarat. Your rental price and refundable security deposit are calculated and shown before you book.</p>
        <div class="hero-btns">
          <a class="button btn-orange" href="cars.html">Explore All Cars &rarr;</a>
          <a class="button btn-outline" href="host-onboarding.html">List Your Car</a>
        </div>
        <!-- Filled from the live /vehicles listing; hidden if it cannot be loaded. No fixed marketing numbers. -->
        <div class="hero-stats" id="hero-stats" data-testid="hero-stats" hidden>
          <div class="hero-stat">
            <div class="hero-stat-num" id="stat-cars" data-testid="stat-cars"></div>
            <div class="hero-stat-lbl">Cars Listed</div>
          </div>
          <div class="hero-stat">
            <div class="hero-stat-num is-orange" id="stat-cities" data-testid="stat-cities"></div>
            <div class="hero-stat-lbl" id="stat-cities-lbl">Cities</div>
          </div>
        </div>
      </div>

      <div class="booking-widget">
        <div class="bw-title">Reserve Your Car in Gujarat</div>
        <div class="bw-field-label"><label for="bw-city">Pickup City</label></div>
        <select class="bw-select" id="bw-city">
          <option value="">All cities</option>
          ${PICKUP_CITIES.map(city => `<option value="${esc(city)}">${esc(city)}</option>`).join('')}
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
        <div class="bw-footer-note">Deposit shown before booking</div>
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
        <div><div class="hl-title">Approved Listings</div><div class="hl-sub">Reviewed before they go live</div></div>
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

  // Sync drop date to always be >= pickup date
  const startEl = $('#bw-start'), endEl = $('#bw-end');
  $('#find-available-cars').onclick = () => {
    const start = new Date(startEl.value + 'T10:00:00');
    const end = new Date(endEl.value + 'T10:00:00');
    if (!Number.isFinite(+start) || !Number.isFinite(+end) || start <= new Date() || end <= start) return toast('Choose a future pickup date and a later return date. Pickup and return default to 10:00 AM; you can adjust times on the next page.', true);
    const city = $('#bw-city').value;
    location.assign('cars.html?' + new URLSearchParams({ startDate: start.toISOString(), endDate: end.toISOString(), ...(city ? { city } : {}) }));
  };
  if (startEl && endEl) {
    startEl.addEventListener('change', () => { if (endEl.value < startEl.value) endEl.value = startEl.value; endEl.min = startEl.value; });
  }

  initReveal();

  try {
    const cars = await api('/vehicles');
    // Real figures from the public listing (the API returns at most 100 approved cars per request).
    const cities = [...new Set(cars.map(c => (c.locationCity || '').trim()).filter(Boolean))].sort((a, b) => a.localeCompare(b));
    if (cars.length) {
      $('#stat-cars').textContent = cars.length >= 100 ? '100+' : String(cars.length);
      $('#stat-cities').textContent = String(cities.length);
      $('#stat-cities-lbl').textContent = cities.length === 1 ? 'City' : 'Cities';
      $('#hero-stats').hidden = false;
    }
    // The fixed service cities are always offered; a listed car in any other city adds that city too.
    const citySelect = $('#bw-city');
    for (const city of cities) if (!PICKUP_CITIES.includes(city)) citySelect.append(new Option(city, city));
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
            ${sel('role', 'Account Type', ['CUSTOMER', 'HOST', 'DEALER'])}
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
    // Local dev only, plain browsing only (no trip dates): show labelled samples while nothing real is listed.
    if (!allCars.length && PREVIEW_MODE && !query.has('startDate')) allCars = PREVIEW_CARS.map(car => ({ ...car }));
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
    $$('.cat-cb, .trans-cb, .fuel-cb').forEach(cb => { cb.checked = true; });
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
  const preview = allCars.some(car => car.preview);
  $('#cars-count-text').textContent = preview
    ? `${list.length} sample car${list.length !== 1 ? 's' : ''} · Preview only, not bookable`
    : datesSelected
      ? `${list.length} car${list.length !== 1 ? 's' : ''} available for your selected dates`
      : `${list.length} car${list.length !== 1 ? 's' : ''} · Select trip dates to check availability`;
  const banner = preview ? `<div class="preview-banner" role="note" data-testid="preview-banner"><strong>Preview mode (local only).</strong> No cars are listed yet, so these sample cars show how the page will look. They aren't real listings and can't be booked; real cars appear here once an administrator approves them.</div>` : '';
  $('#fleet-grid').innerHTML = banner + (list.length
    ? list.map(car => car.preview ? previewCard(car) : carCard(car)).join('')
    : empty('No cars match your filters', 'Try changing or clearing your filter criteria.'));
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
              ? `<img id="car-hero-img" data-vehicle-image src="/api/media/${encodeURIComponent(mainMedia.id)}" alt="${esc(car.make)} ${esc(car.model)}">`
              : `<img id="car-hero-img" ${vehicleImageSlot(vehicleCoverUrl(car))} alt="${esc(car.make)} ${esc(car.model)}">`}
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
              ${(() => { const rating = ratingSummary(car); return `<div class="details-rating-num">${rating.value === 'New' ? 'New listing' : `★ ${rating.value}`}</div><div class="details-rating-lbl">${rating.count} verified review${rating.count === 1 ? '' : 's'}</div>`; })()}
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

          <p id="booking-kyc-status" style="font-size:12px;color:var(--muted);margin-top:12px;text-align:center">Checking KYC eligibility for your selected return date…</p>
        `}

        <div class="bp-perks-box">
          <div class="bp-perk-line">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M20 6L9 17l-5-5"/></svg>
            <span><strong>Security Deposit:</strong> shown in your quote before you book</span>
          </div>
          <div class="bp-perk-line">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M20 6L9 17l-5-5"/></svg>
            <span><strong>Cancellation:</strong> terms are in your rental agreement</span>
          </div>
          <div class="bp-perk-line">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M20 6L9 17l-5-5"/></svg>
            <span><strong>Pickup City:</strong> ${esc(car.locationCity)}</span>
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
      const dlValidUntil = user.dlValidUntil ? new Date(user.dlValidUntil) : null;
      const kycEligible = Boolean(user.isVerified && dlValidUntil && Number.isFinite(+dlValidUntil) && dlValidUntil >= end);
      const kycStatus = $('#booking-kyc-status');
      if (kycStatus) kycStatus.innerHTML = kycEligible
        ? '<span style="color:var(--green);font-weight:700">✓ KYC and driving licence are valid through your return date.</span>'
        : '<span style="color:var(--red);font-weight:700">Complete KYC and obtain DL approval valid through your return date. <a href="kyc.html">Open Verification Centre →</a></span>';
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
      if (!user.isVerified || !user.dlValidUntil || new Date(user.dlValidUntil) < end) throw new Error('Complete KYC and obtain DL approval valid through your return date.');
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
  // Owners manage car documents on the Car Documents page; old links keep working.
  const vehicleParam = new URLSearchParams(location.search).get('vehicle');
  if (vehicleParam && ['HOST', 'DEALER'].includes(user.role)) { location.replace('host-onboarding.html?tab=documents&vehicle=' + encodeURIComponent(vehicleParam)); return; }
  await dashboard('kyc');
}

const VEHICLE_DOCUMENT_KINDS = ['RC', 'INSURANCE', 'PUC'];
const DOCUMENT_UPLOAD_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const DOCUMENT_UPLOAD_MAX_BYTES = 8 * 1024 * 1024;

function renderKycTabHtml(info, vehicles = []) {
  const isNew = new URLSearchParams(location.search).get('new') === '1';
  const vehicleId = new URLSearchParams(location.search).get('vehicle');
  // Owners upload car documents on Car Documents; here they only handle their own driving licence and Aadhaar.
  const ownerPanel = ['HOST','DEALER'].includes(user.role);
  const isFleet = user.role === 'ADMIN';
  const selectedVehicle = vehicles.some(v => v.id === vehicleId) ? vehicleId : '';
  const documentKinds = isFleet ? ['DL', ...VEHICLE_DOCUMENT_KINDS] : ['DL'];
  const vehicleOptions = vehicles.map(v => `<option value="${esc(v.id)}" ${v.id === selectedVehicle ? 'selected' : ''}>${esc(`${v.make} ${v.model}${v.registrationNumber ? ' · ' + v.registrationNumber : ''}`)}</option>`).join('');

  const personalDocs = (info.documents || []).filter(doc => !doc.vehicleId && doc.source !== 'DIGILOCKER_TEST');
  const records = (info.documents || []).filter(doc => !ownerPanel || !doc.vehicleId);
  // Demo seed records are shown, but never as verification (the server applies the same rule).
  const genuineDocs = personalDocs.filter(doc => !unverifiedDocument(doc));
  const kycApproved = genuineDocs.some(doc => doc.kind === 'AADHAAR' && doc.status === 'APPROVED');
  const dlApproved = genuineDocs.some(doc => doc.kind === 'DL' && doc.status === 'APPROVED' && doc.validUntil && new Date(doc.validUntil) > new Date());
  const eligible = kycApproved && dlApproved;
  const documentStatus = kind => {
    const records = personalDocs.filter(doc => doc.kind === kind);
    if (kind === 'AADHAAR' ? kycApproved : dlApproved) return records.every(doc => doc.status !== 'APPROVED' || demoCounted(doc)) ? 'Verified (local demo record)' : 'Verified';
    if (records.some(unverifiedDocument)) return 'Unverified demo record. Upload or verify a real document';
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
                <button class="btn-outline btn-sm sync-session-btn" data-id="${esc(s.id)}" ${new Date(s.expiresAt) < new Date() ? 'disabled' : ''}>${new Date(s.expiresAt) < new Date() ? 'Session expired' : 'Retrieve documents'}</button>
              </div>`).join('')}
          </details>` : ''}
      </section>

      <!-- Manual Document Upload Card -->
      <section class="panel">
        <div class="verification-label">DOCUMENT UPLOAD</div>
        <h3>Submit a document for review</h3>
        <p class="text-muted">${isFleet ? 'Upload your Driving Licence for manual officer review, or upload RC, Insurance, and PUC for a car you host.' : 'Upload your Driving Licence for manual officer review.'}</p>
        ${ownerPanel ? '<p class="notice info" data-testid="car-docs-moved">RC, Insurance and PUC for your cars are uploaded under <a href="host-onboarding.html?tab=documents">Car Documents</a>.</p>' : ''}

        <form id="doc-upload-form" class="form-stack">
          <label>Document Type<select name="kind" id="doc-kind">${documentKinds.map(k => `<option value="${k}" ${selectedVehicle && k === 'RC' ? 'selected' : ''}>${k}</option>`).join('')}</select></label>
          ${isFleet ? `
          <label id="doc-vehicle-field" ${selectedVehicle ? '' : 'hidden'}>Vehicle
            <select name="vehicleId" id="doc-vehicle" ${selectedVehicle ? 'required' : 'disabled'}>
              <option value="">Select the car this document belongs to</option>
              ${vehicleOptions}
            </select>
          </label>
          ${vehicles.length ? '' : '<p class="text-muted" id="doc-no-vehicles">List a car first to upload its RC, Insurance and PUC.</p>'}` : ''}
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

    <!-- Submitted Records Table (owners: personal documents only; car documents are on Car Documents) -->
    <section class="panel" style="margin-top:24px;">
      <h3>Submitted Verification Records</h3>
      ${records.length ? `
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
              ${records.map(doc => `
                <tr>
                  <td><strong>${esc(doc.kind)}</strong></td>
                  <td>${sourceCell(doc, doc.source || 'MANUAL')}</td>
                  <td>${docStatusBadge(doc)}</td>
                  <td>${doc.validUntil ? d(doc.validUntil) : '—'}</td>
                  <td>${esc(doc.reviewNote || 'Pending review by verification officer')}</td>
                  <td>${doc.mediaId || String(doc.source || '').startsWith('DIGILOCKER_LIVE') ? `
                    <button class="button btn-ghost btn-sm view-user-doc-btn" data-id="${esc(doc.id)}" data-kind="${esc(doc.kind)}">
                      View Document ↗
                    </button>` : '<span class="text-muted">No file</span>'}
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

  // RC, Insurance and PUC belong to a vehicle; the selector is only enabled (and required) for those types.
  const kindSelect = $('#doc-kind'), vehicleField = $('#doc-vehicle-field'), vehicleSelect = $('#doc-vehicle');
  const syncVehicleField = () => {
    if (!vehicleField || !vehicleSelect) return;
    const needsVehicle = VEHICLE_DOCUMENT_KINDS.includes(kindSelect.value);
    vehicleField.hidden = !needsVehicle;
    vehicleSelect.disabled = !needsVehicle;
    vehicleSelect.required = needsVehicle;
  };
  if (kindSelect) { kindSelect.onchange = syncVehicleField; syncVehicleField(); }

  bindForm('#doc-upload-form', async (data, form) => {
    // Checked before uploading so a rejected submission does not leave an orphaned file; the API enforces the same rules.
    if (VEHICLE_DOCUMENT_KINDS.includes(data.kind) && !data.vehicleId) throw new Error('Select the car this ' + data.kind + ' document belongs to.');
    const file = form.file.files[0];
    if (file && !DOCUMENT_UPLOAD_TYPES.includes(file.type)) throw new Error('Upload a JPEG, PNG or WebP image.');
    if (file && file.size > DOCUMENT_UPLOAD_MAX_BYTES) throw new Error('The image must be 8 MB or smaller.');
    const media = await uploadFile(file, data.kind);
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
/* ─── OWNER (HOST / DEALER) PANEL SECTIONS ───────────────────────────── */
// The owner menu: each item is a section of the fleet page (host-onboarding.html?tab=…), plus Account.
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

async function host(tab, focusVehicleId) {
  if (!requireUser(['HOST','DEALER','ADMIN'])) return;
  tab = HOST_SECTION_IDS.includes(tab) ? tab : hostSectionFromUrl();
  focusVehicleId = focusVehicleId || new URLSearchParams(location.search).get('vehicle') || '';
  const [vehicles, savedPayoutAccount, hosted] = await Promise.all([
    api('/vehicles/mine'),
    api('/payouts/account').catch(() => null),
    api('/bookings/host-bookings').catch(() => []),
  ]);
  // The endpoint returns an empty body when no account exists, which api() turns into {}; treat that as "none".
  const payoutAccount = savedPayoutAccount?.id ? savedPayoutAccount : null;
  const dealer = user.role === 'DEALER';

  $('#app').innerHTML = `
    <div id="host-head">${sectionHead(HOST_SECTION_HEADS[tab][0], HOST_SECTION_HEADS[tab][1], dealer ? 'DEALER FLEET' : 'HOST FLEET')}</div>

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
    toast('Car registered! Now upload its RC, Insurance and PUC.');
    await host('documents', result.id);
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

  const isFleet = ['HOST','DEALER','ADMIN'].includes(user.role);
  const [trips, hosted, kycInfo, accountInfo, myVehicles] = await Promise.all([
    api('/bookings/my-trips').catch(() => []),
    isFleet ? api('/bookings/host-bookings').catch(() => []) : Promise.resolve([]),
    api('/kyc').catch(() => ({ documents: [], sessions: [], environment: 'live', configured: false })),
    api('/account/dashboard').catch(() => null),
    // Only vehicles this account hosts; the server re-checks ownership when a document is submitted.
    user.role === 'ADMIN' && activeTab === 'kyc' ? api('/vehicles/mine').catch(() => []) : Promise.resolve([]),
  ]);

  const activeCount = trips.filter(b => b.status === 'ACTIVE').length;
  // Customers reach each section from the header menu, so the page shows only that section (no summary cards or tabs).
  const sectionContent = activeTab === 'kyc' ? renderKycTabHtml(kycInfo, myVehicles) : activeTab === 'profile' ? renderProfileTabHtml(kycInfo) : renderTripsTabHtml(trips, hosted, accountInfo);
  if (user.role === 'CUSTOMER') {
    const [title, intro] = CUSTOMER_SECTION_HEADS[activeTab] || CUSTOMER_SECTION_HEADS.trips;
    $('#app').innerHTML = `${sectionHead(title, intro, 'MY ACCOUNT')}<div id="account-tab-content" data-section="${esc(activeTab)}">${sectionContent}</div>`;
    if (activeTab === 'kyc') bindKycEvents(kycInfo); else if (activeTab !== 'profile') bindBookingEvents();
    return;
  }

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
        <span style="font-size:12px;color:var(--muted);">${user.isVerified ? (user.demoVerification ? 'Verified (local demo mode)' : 'DigiLocker Authenticated') : 'Upload DL & Aadhaar'}</span>
      </div>
      <div class="stat">
        <div class="stat-lbl">My Bookings</div>
        <strong style="font-size:22px;">${accountInfo?.role === 'CUSTOMER' ? Object.values(accountInfo.bookingCounts || {}).reduce((sum, value) => sum + Number(value || 0), 0) : trips.length}</strong>
        <span style="font-size:12px;color:var(--muted);">${activeCount} Active Trips</span>
      </div>
    </div>

    ${accountInfo?.role === 'HOST' || accountInfo?.role === 'DEALER' ? `
      <div class="notice" style="margin-bottom:22px;display:flex;justify-content:space-between;gap:16px;flex-wrap:wrap;align-items:center;">
        <span><strong>${accountInfo.role === 'DEALER' ? 'Dealer fleet' : 'Host fleet'}:</strong> ${Number(accountInfo.fleet?.active || 0)} active · ${Number(accountInfo.fleet?.pendingApproval || 0)} awaiting approval</span>
        <span><strong>Collected bookings:</strong> ₹${Number(accountInfo.earnings?.grossCollected || 0).toLocaleString('en-IN')}</span>
      </div>` : accountInfo?.role === 'ADMIN' ? `
      <div class="notice" style="margin-bottom:22px;display:flex;justify-content:space-between;gap:16px;flex-wrap:wrap;align-items:center;">
        <span><strong>Operations:</strong> ${Number(accountInfo.metrics?.pendingDocuments || 0)} documents pending · ${Number(accountInfo.metrics?.pendingRefunds || 0)} refunds pending</span>
        <span><strong>Today:</strong> ₹${Number(accountInfo.metrics?.todayCollected || 0).toLocaleString('en-IN')}</span>
      </div>` : ''}

    <!-- Segmented Account Navigation Tabs -->
    <div class="admin-tabs" style="margin-bottom: 24px;">
      <button type="button" class="${activeTab === 'trips' ? 'active' : ''}" data-account-tab="trips">
        🧳 My Trips <span>${trips.length}</span>
      </button>
      <button type="button" class="${activeTab === 'kyc' ? 'active' : ''}" data-account-tab="kyc">
        🪪 Verification &amp; KYC <span>${user.isVerified ? '✓' : '!'}</span>
      </button>
      <button type="button" class="${activeTab === 'profile' ? 'active' : ''}" data-account-tab="profile">
        👤 Profile Details
      </button>
    </div>

    <div id="account-tab-content">
      ${activeTab === 'kyc' ? renderKycTabHtml(kycInfo, myVehicles) : activeTab === 'profile' ? renderProfileTabHtml(kycInfo) : renderTripsTabHtml(trips, hosted, accountInfo)}
    </div>`;

  if (activeTab === 'trips') bindBookingEvents();
  if (activeTab === 'kyc') bindKycEvents(kycInfo);
}

function switchAccountTab(tabName) {
  const url = new URL(location.href);
  url.searchParams.set('tab', tabName);
  history.replaceState(null, '', url.toString());
  syncCustomerMenu();
  $$('#mobile-bnav .bnav-item').forEach(a => a.classList.toggle('active', a.getAttribute('href') === 'dashboard.html?tab=' + tabName));
  dashboard(tabName);
}

function renderTripsTabHtml(trips, hosted, accountInfo) {
  return `
    ${!user.isVerified ? `
      <div class="notice" style="margin-bottom:22px">
        <strong>Verification Required:</strong> Complete Aadhaar eKYC and Driving Licence verification to activate self-drive privileges.
        <button type="button" data-account-tab="kyc" class="button btn-sm btn-orange" style="margin-left:12px">Complete KYC →</button>
      </div>` : ''}

    <section class="panel">
      <h3>My Trip Bookings</h3>
      ${renderBookingTable(trips, false)}
    </section>

    ${['HOST', 'DEALER'].includes(user.role) ? '<p class="notice info" style="margin-top:24px">Bookings on your cars are under <a href="host-onboarding.html?tab=bookings">Bookings</a>.</p>' : hosted.length ? `
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
        <button type="button" data-account-tab="kyc" class="button btn-orange">Manage KYC Documents</button>
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
                    ? `<button class="btn-ghost btn-sm cancel-booking-btn" data-id="${esc(b.id)}">Cancel</button>` : ''}
                  <a class="button btn-ghost btn-sm" href="agreement.html?id=${encodeURIComponent(b.id)}">Agreement</a>
                  ${b.invoice ? `<a class="button btn-ghost btn-sm" href="invoice.html?id=${encodeURIComponent(b.invoice.id)}">Receipt</a>` : ''}
                  ${!isHost && b.status === 'COMPLETED' ? `<button class="button btn-outline btn-sm review-booking-btn" data-id="${esc(b.id)}">Rate vehicle</button><button class="button btn-outline btn-sm party-review-btn" data-id="${esc(b.id)}" data-target-role="HOST">Rate host</button>` : ''}
                  ${isHost && b.status === 'COMPLETED' ? `<button class="button btn-outline btn-sm party-review-btn" data-id="${esc(b.id)}" data-target-role="CUSTOMER">Rate customer</button>` : ''}
                  ${!isHost && b.status === 'ACTIVE' ? `<button class="button btn-outline btn-sm inspection-btn" data-id="${esc(b.id)}" data-stage="DAMAGE">Report damage</button>` : ''}
                  ${isHost && ['CONFIRMED','ACTIVE'].includes(b.status)
                    ? `<button class="button btn-orange btn-sm inspection-btn" data-id="${esc(b.id)}" data-stage="${b.status === 'CONFIRMED' ? 'PICKUP' : 'RETURN'}">${b.status === 'CONFIRMED' ? 'Record Pickup' : 'Record Return'}</button>` : ''}
                </div>
              </td>
            </tr>`).join('')}
        </tbody>
      </table>
    </div>`;
}

function bindBookingEvents() {
  $$('.review-booking-btn').forEach(btn => {
    btn.onclick = async () => {
      const rating = Number(prompt('Rate this vehicle from 1 to 5 stars:'));
      if (!Number.isInteger(rating) || rating < 1 || rating > 5) return toast('Choose a rating from 1 to 5.');
      const comment = prompt('Optional review comment:') || '';
      btn.disabled = true;
      try {
        await post('/reviews', { bookingId: btn.dataset.id, rating, comment });
        toast('Thank you. Your verified review was submitted.');
        await dashboard();
      } catch (e) { toast(e.message, 'error'); btn.disabled = false; }
    };
  });
  $$('.party-review-btn').forEach(btn => {
    btn.onclick = async () => {
      const target = btn.dataset.targetRole === 'HOST' ? 'host' : 'customer';
      const rating = Number(prompt(`Rate this ${target} from 1 to 5 stars:`));
      if (!Number.isInteger(rating) || rating < 1 || rating > 5) return toast('Choose a rating from 1 to 5.');
      const comment = prompt('Optional review comment:') || '';
      btn.disabled = true;
      try {
        await post('/reviews/party', { bookingId: btn.dataset.id, targetRole: btn.dataset.targetRole, rating, comment });
        toast(`Your ${target} rating was submitted.`);
        await dashboard();
      } catch (e) { toast(e.message, true); btn.disabled = false; }
    };
  });
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
      const stage = btn.dataset.stage;
      const isDamage = stage === 'DAMAGE';
      const selfieKind = stage === 'PICKUP' ? 'SELFIE_PICKUP' : 'SELFIE_RETURN';
      const conditionKind = stage === 'PICKUP' ? 'INSPECTION_PICKUP' : 'INSPECTION_RETURN';
      showDialog(`
        <h3>${esc(isDamage ? 'Trip Damage Report' : stage + ' Vehicle Inspection')}</h3>
        <form id="inspection-submit-form" class="form-stack">
          ${inp('odometer',isDamage ? 'Odometer Reading (optional)' : 'Current Odometer Reading (km)','number','min="0" max="2000000"' + (isDamage ? '' : ' required'))}
          ${inp('fuelPercent','Fuel level (%)','number','min="0" max="100" step="1"')}
          <label>${isDamage ? 'Damage description' : 'Vehicle condition / existing damage'}<textarea name="damageNote" required maxlength="2000" placeholder="Describe condition and any visible damage. Enter No visible damage when applicable."></textarea></label>
          ${isDamage ? '' : `<label>Odometer Photo Proof<input name="odometerFile" type="file" accept="image/jpeg,image/png,image/webp" required></label>
          <label>${stage === 'PICKUP' ? 'Pickup' : 'Return'} Selfie<input name="selfieFile" type="file" accept="image/jpeg,image/png,image/webp" required></label>
          <label>${stage === 'PICKUP' ? 'Pickup' : 'Return'} Condition Photos<input name="conditionFiles" type="file" accept="image/jpeg,image/png,image/webp" multiple required></label>`}
          ${isDamage ? '<label>Damage Photos<input name="damageFiles" type="file" accept="image/jpeg,image/png,image/webp" multiple required></label>' : ''}
          <label>Condition &amp; Vehicle Notes
            <textarea name="note" maxlength="1000" placeholder="Record tire condition, fuel level, scratch checks…"></textarea>
          </label>
          <button type="submit" class="button btn-orange">Save Inspection Record</button>
        </form>`);

      bindForm('#inspection-submit-form', async (data, form) => {
        const uploads = [];
        if (isDamage) {
          for (const file of Array.from(form.damageFiles.files || [])) uploads.push(await uploadFile(file, 'DAMAGE'));
        } else {
          uploads.push(await uploadFile(form.odometerFile.files[0], 'ODOMETER'));
          uploads.push(await uploadFile(form.selfieFile.files[0], selfieKind));
          for (const file of Array.from(form.conditionFiles.files || [])) uploads.push(await uploadFile(file, conditionKind));
        }
        if (!uploads.length) throw new Error('Upload at least one inspection photo');
        await post('/bookings/' + btn.dataset.id + '/inspection', {
          stage,
          odometer: Number(data.odometer || 0),
          fuelPercent: Number(data.fuelPercent || 0), damageNote: data.damageNote,
          mediaId: uploads[0].id,
          mediaIds: uploads.map(item => item.id),
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

/* ─── ADMIN DASHBOARD ────────────────────────────────────────────────── */
// Document verification review (admin): open the original, check it, then approve with expiry or reject.
// Used from the Documents tab and from a car folder's Compliance tab; afterSave decides where to return.
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

async function adminPage(tab) {
  if (!requireUser(['ADMIN'])) return;
  tab = ADMIN_SECTIONS.includes(tab) ? tab : adminSectionFromUrl();
  adminData = await api('/admin');
  adminData.payouts = await api('/payouts').catch(() => []);
  adminData.payoutAccounts = await api('/payouts/accounts').catch(() => []);

  $('#app').innerHTML = `
    <div class="admin-workspace">
    ${sectionHead('Administration &amp; Operations', 'Approve car listings, verify KYC documents, and reconcile payments.', 'ADMIN PANEL')}

    <section id="admin-dashboard" aria-label="Dashboard" hidden>
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
    </section>

    <section id="admin-records" hidden>
    <div class="admin-toolbar">
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
  // Dashboard shows the summary cards; every other section shows its records with the toolbar.
  const dashboard = tab === 'dashboard';
  $('#admin-dashboard').hidden = !dashboard;
  $('#admin-records').hidden = dashboard;
  $$('#header [data-tab]').forEach(b => { b.classList.toggle('active', b.dataset.tab === tab); if (b.dataset.tab === tab) b.setAttribute('aria-current', 'page'); else b.removeAttribute('aria-current'); });
  if (dashboard) return;
  const statusSelect = $('#admin-status');
  const selectedStatus = statusSelect.value;
  const statuses = [...new Set(adminData[tab].map(item => tab === 'bookings' ? formatBookingStatus(item) : item.status || item.role || item.action).filter(Boolean))].sort();
  statusSelect.innerHTML = '<option value="">All statuses</option>' + statuses.map(status => `<option value="${esc(status)}">${esc((status || '').replaceAll('_', ' '))}</option>`).join('');
  statusSelect.value = statuses.includes(selectedStatus) ? selectedStatus : '';
  const query = $('#admin-search').value.trim().toLowerCase();
  const data = adminData[tab].filter(item => (!statusSelect.value || (tab === 'bookings' ? formatBookingStatus(item) : item.status || item.role || item.action) === statusSelect.value) && (!query || JSON.stringify(item).toLowerCase().includes(query)));
  $('#admin-record-count').textContent = `${data.length} of ${adminData[tab].length} loaded records`;
  if (!data.length && !(tab === 'payouts' && adminData.payoutAccounts.length)) {
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
      ${flags.size ? `<p class="notice" data-testid="booking-review-notice">${flags.size} upcoming booking(s) need review: the car is no longer available or compliant for the trip. Nothing has been cancelled or refunded automatically.</p>` : ''}
      <section class="panel table-wrap">
        <table>
          <thead><tr><th>Customer / Vehicle</th><th>Trip Schedule</th><th>Total</th><th>Status</th><th>Payment &amp; Invoicing</th></tr></thead>
          <tbody>
            ${data.map(b => `
              <tr>
                <td>${esc(b.customer.firstName + ' ' + b.customer.lastName)}<p>${esc(b.vehicle.make + ' ' + b.vehicle.model)}</p></td>
                <td>${dt(b.startDate)}<br>${dt(b.endDate)}<p class="text-muted">${esc(b.bookingRef)}</p>${formatBookingStatus(b) === 'PENDING' ? `<small>Hold expires: ${dt(b.expiresAt)}</small>` : ''}</td>
                <td><strong>${money(b.totalAmount)}</strong></td>
                <td>${badge(formatBookingStatus(b))}${b.payment ? `<br>${badge(b.payment.status)}` : ''}${flags.has(b.id) ? `<div class="booking-review-flag" data-testid="booking-review-flag"><span class="badge warn">Needs review</span><ul class="eligibility-reasons">${flagText(flags.get(b.id)).map(t => `<li>${esc(t)}</li>`).join('')}</ul></div>` : ''}</td>
                <td>
                  ${formatBookingStatus(b) === 'PENDING' ? `<button class="button btn-sm record-pmt-action" data-id="${esc(b.id)}" data-amount="${esc(b.totalAmount)}">Record Payment</button><button class="btn-outline btn-sm booking-hold-action" data-id="${esc(b.id)}">Manage hold</button>` : ''}
                  ${b.payment?.status === 'REFUND_PENDING' ? `<button class="button btn-ghost btn-sm record-ref-action" data-id="${esc(b.id)}">Record Refund</button>` : ''}
                  ${['ACTIVE','COMPLETED'].includes(formatBookingStatus(b)) ? `<button class="btn-outline btn-sm booking-settlement-action" data-id="${esc(b.id)}">Settlement preview</button>` : ''}
                  <a class="button btn-ghost btn-sm" href="agreement.html?id=${encodeURIComponent(b.id)}">Agreement</a>
                  ${b.invoice ? `<a class="button btn-ghost btn-sm" href="invoice.html?id=${encodeURIComponent(b.invoice.id)}">Receipt</a>` : ''}
                </td>
              </tr>`).join('')}
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
        <table>
          <thead><tr><th>Name</th><th>Email</th><th>Role</th><th>KYC Approval</th><th>DL Expiry</th><th>Account control</th></tr></thead>
          <tbody>
            ${data.map(u => `
              <tr>
                <td>${esc(u.firstName + ' ' + u.lastName)}</td>
                <td>${esc(u.email)}</td>
                <td>${badge(u.role)}</td>
                <td>${badge(u.isVerified ? 'APPROVED' : 'PENDING')}</td>
                <td>${d(u.dlValidUntil)}</td>
                <td>${u.role === 'ADMIN' ? '<span class="text-muted">Protected admin</span>' : `<button class="btn-${u.isBlocked ? 'outline' : 'ghost'} btn-sm user-block-action" data-id="${esc(u.id)}" data-blocked="${u.isBlocked ? 'false' : 'true'}">${u.isBlocked ? 'Unblock' : 'Block account'}</button>`}</td>
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

  // Admin action dialog bindings
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

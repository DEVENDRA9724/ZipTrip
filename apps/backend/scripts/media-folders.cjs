// Same folder rule as src/media/storage-key.ts (kept identical by src/media/storage-key.spec.ts), for maintenance scripts.
'use strict';
const DOCUMENT_KINDS = ['AADHAAR', 'DL', 'RC', 'INSURANCE', 'PUC'];
const PHOTO_KINDS = ['FRONT', 'REAR', 'LEFT', 'RIGHT', 'INTERIOR', 'BOOT', 'BONNET', 'ODOMETER'];
const safeSegment = (value) => String(value).replace(/[^A-Za-z0-9_-]/g, '').slice(0, 64) || 'unknown';

function mediaStorageKey(kind, ownerId, extension, id) {
  const owner = safeSegment(ownerId);
  const file = safeSegment(id) + extension;
  if (DOCUMENT_KINDS.includes(kind)) return `documents/${kind.toLowerCase()}/${owner}/${file}`;
  if (PHOTO_KINDS.includes(kind)) return `vehicles/${owner}/${kind}/${file}`;
  if (kind === 'SELFIE_KYC') return `kyc/${owner}/selfie/${file}`;
  return `inspections/${owner}/${safeSegment(kind)}/${file}`;
}

// True when a stored key already follows the folder layout.
const isFolderKey = (key) => /^(documents|vehicles|kyc|inspections)\//.test(String(key));

module.exports = { mediaStorageKey, isFolderKey };

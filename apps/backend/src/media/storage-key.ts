import { randomUUID } from 'node:crypto';
import { DOCUMENT_KINDS, PHOTO_KINDS } from '../common/validation';

// Folder layout for uploaded files inside the bucket (below S3_PREFIX, for example "media/"):
//   vehicles/<owner>/<FRONT|REAR|…>/<id>.jpg       car listing photos
//   documents/<rc|insurance|puc|dl|aadhaar>/<owner>/<id>.enc   private documents (app-encrypted)
//   kyc/<owner>/selfie/<id>.jpg                   e-KYC selfies
//   inspections/<owner>/<KIND>/<id>.jpg           handover, damage and odometer photos
// The same rule is in scripts/media-folders.cjs for the migration script; a test keeps them identical.
const safeSegment = (value: string) =>
  String(value)
    .replace(/[^A-Za-z0-9_-]/g, '')
    .slice(0, 64) || 'unknown';

export function mediaStorageKey(
  kind: string,
  ownerId: string,
  extension: '.jpg' | '.enc',
  id: string = randomUUID(),
) {
  const owner = safeSegment(ownerId);
  const file = safeSegment(id) + extension;
  if ((DOCUMENT_KINDS as readonly string[]).includes(kind))
    return `documents/${kind.toLowerCase()}/${owner}/${file}`;
  if ((PHOTO_KINDS as readonly string[]).includes(kind))
    return `vehicles/${owner}/${kind}/${file}`;
  if (kind === 'SELFIE_KYC') return `kyc/${owner}/selfie/${file}`;
  return `inspections/${owner}/${safeSegment(kind)}/${file}`;
}

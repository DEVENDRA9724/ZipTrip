"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.mediaStorageKey = mediaStorageKey;
const node_crypto_1 = require("node:crypto");
const validation_1 = require("../common/validation");
const safeSegment = (value) => String(value)
    .replace(/[^A-Za-z0-9_-]/g, '')
    .slice(0, 64) || 'unknown';
function mediaStorageKey(kind, ownerId, extension, id = (0, node_crypto_1.randomUUID)()) {
    const owner = safeSegment(ownerId);
    const file = safeSegment(id) + extension;
    if (validation_1.DOCUMENT_KINDS.includes(kind))
        return `documents/${kind.toLowerCase()}/${owner}/${file}`;
    if (validation_1.PHOTO_KINDS.includes(kind))
        return `vehicles/${owner}/${kind}/${file}`;
    if (kind === 'SELFIE_KYC')
        return `kyc/${owner}/selfie/${file}`;
    return `inspections/${owner}/${safeSegment(kind)}/${file}`;
}
//# sourceMappingURL=storage-key.js.map
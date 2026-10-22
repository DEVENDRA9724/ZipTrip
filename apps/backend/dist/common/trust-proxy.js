"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.trustProxySetting = trustProxySetting;
function trustProxySetting(raw) {
    const value = raw?.trim();
    if (!value)
        return undefined;
    if (/^(true|false)$/i.test(value))
        return value.toLowerCase() === 'true';
    if (/^\d+$/.test(value))
        return Number(value);
    const entries = value
        .split(',')
        .map((item) => item.trim())
        .filter(Boolean);
    if (!entries.length ||
        entries.some((item) => !/^[0-9a-fA-F:./]+$|^(loopback|linklocal|uniquelocal)$/.test(item)))
        throw new Error('TRUST_PROXY must be true, false, a hop count, or a comma list of addresses, subnets, loopback, linklocal or uniquelocal');
    return entries;
}
//# sourceMappingURL=trust-proxy.js.map
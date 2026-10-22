"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CONTENT_SECURITY_POLICY = void 0;
exports.CONTENT_SECURITY_POLICY = [
    "default-src 'self'",
    "script-src 'self'",
    "script-src-attr 'none'",
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "font-src 'self' data: https://fonts.gstatic.com",
    "img-src 'self' data: blob: https:",
    "connect-src 'self'",
    "object-src 'none'",
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'self'",
].join('; ');
//# sourceMappingURL=security-headers.js.map
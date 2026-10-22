"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.externalImageUrl = externalImageUrl;
const common_1 = require("@nestjs/common");
function externalImageUrl(value) {
    if (value == null || (typeof value === 'string' && !value.trim()))
        return null;
    const raw = typeof value === 'string' ? value.trim() : '';
    const invalid = new common_1.BadRequestException('Image URL must be a single https:// address (max 2048 characters)');
    const hasControlCharacter = [...raw].some((ch) => {
        const code = ch.charCodeAt(0);
        return code < 0x20 || code === 0x7f;
    });
    if (!raw ||
        raw.length > 2048 ||
        hasControlCharacter ||
        /[\s"'<>`\\]/.test(raw))
        throw invalid;
    let url;
    try {
        url = new URL(raw);
    }
    catch {
        throw invalid;
    }
    if (url.protocol !== 'https:' ||
        !url.hostname ||
        url.username ||
        url.password)
        throw invalid;
    return url.href;
}
//# sourceMappingURL=image-url.js.map
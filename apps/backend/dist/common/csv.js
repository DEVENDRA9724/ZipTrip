"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.csvCell = csvCell;
function csvCell(value) {
    let text = String(value ?? '');
    if (typeof value !== 'number' && /^[=+\-@\t\r]/.test(text))
        text = "'" + text;
    return '"' + text.replace(/"/g, '""') + '"';
}
//# sourceMappingURL=csv.js.map
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.isLocalDevelopment = isLocalDevelopment;
function isLocalDevelopment(env = process.env) {
    return env.NODE_ENV === 'development' || env.NODE_ENV === 'test';
}
//# sourceMappingURL=environment.js.map
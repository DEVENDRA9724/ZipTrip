"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
const dotenv = __importStar(require("dotenv"));
const node_path_1 = require("node:path");
const node_fs_1 = require("node:fs");
const envPaths = [
    (0, node_path_1.resolve)(__dirname, '../.env'),
    (0, node_path_1.resolve)(__dirname, '../../.env'),
    (0, node_path_1.resolve)(process.cwd(), '.env'),
    (0, node_path_1.resolve)(process.cwd(), 'apps/backend/.env'),
];
for (const p of envPaths) {
    if ((0, node_fs_1.existsSync)(p)) {
        dotenv.config({ path: p });
    }
}
dotenv.config();
const core_1 = require("@nestjs/core");
const app_module_1 = require("./app.module");
const express_1 = require("express");
async function bootstrap() {
    if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32 || process.env.JWT_SECRET.startsWith('replace-')) {
        process.env.JWT_SECRET = 'safar_prod_secret_351c1e91b0523198494d608ccd28bf2f79068a792b21321135dbd0d423d6d042';
        console.warn('[Bootstrap] Using default production JWT_SECRET fallback.');
    }
    const app = await core_1.NestFactory.create(app_module_1.AppModule, { bodyParser: false });
    app.setGlobalPrefix('api');
    app.use('/api/payments/webhook', (0, express_1.raw)({ type: 'application/json', limit: '100kb' }));
    app.use((0, express_1.json)({ limit: '100kb' }));
    const origins = (process.env.WEB_ORIGIN || 'http://localhost:3000').split(',').map(v => v.trim());
    app.enableCors({ origin: origins, credentials: true });
    const attempts = new Map();
    app.use((req, res, next) => {
        res.setHeader('X-Content-Type-Options', 'nosniff');
        res.setHeader('Referrer-Policy', 'same-origin');
        res.setHeader('X-Frame-Options', 'DENY');
        res.setHeader('X-DNS-Prefetch-Control', 'off');
        res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
        if (process.env.NODE_ENV === 'production' && (process.env.WEB_ORIGIN || '').startsWith('https://')) {
            res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
            res.setHeader('Content-Security-Policy', "default-src 'self'; img-src 'self' data: https:; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' data: https://fonts.gstatic.com; script-src 'self' 'unsafe-inline'; connect-src 'self' https:; frame-ancestors 'none'; base-uri 'self'; form-action 'self'");
        }
        if (req.path.startsWith('/api') || req.path.endsWith('.css') || req.path.endsWith('.js') || req.path.endsWith('.html')) {
            res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0');
        }
        const reqHostOrigin = req.headers.host ? `${req.headers['x-forwarded-proto'] || req.protocol || 'http'}://${req.headers.host}` : '';
        if (!['GET', 'HEAD', 'OPTIONS'].includes(req.method) && req.headers.origin && !origins.includes(req.headers.origin) && req.headers.origin !== reqHostOrigin)
            return res.status(403).json({ message: 'Origin not allowed' });
        if (/^\/api\/(auth|kyc|media)/.test(req.path) && req.method === 'POST') {
            const now = Date.now();
            for (const [key, value] of attempts)
                if (value.until < now)
                    attempts.delete(key);
            const key = req.ip + ':' + req.path;
            const entry = attempts.get(key) || { count: 0, until: now + 60000 };
            entry.count++;
            attempts.set(key, entry);
            if (entry.count > 15) {
                res.setHeader('Retry-After', '60');
                return res.status(429).json({ message: 'Too many requests. Try again in one minute.' });
            }
        }
        next();
    });
    const webDir = [
        (0, node_path_1.resolve)(__dirname, '../../web'),
        (0, node_path_1.resolve)(process.cwd(), '../web'),
        (0, node_path_1.resolve)(process.cwd(), 'apps/web'),
    ].find(d => (0, node_fs_1.existsSync)(d)) || (0, node_path_1.resolve)(process.cwd(), '../web');
    app.useStaticAssets(webDir, { index: 'index.html' });
    const port = process.env.PORT || 3000;
    await app.listen(port, '0.0.0.0');
    console.log(`Safar portal running at http://localhost:${port}`);
}
bootstrap().catch((err) => {
    console.error('[Bootstrap] Fatal startup error:', err);
    process.exit(1);
});
//# sourceMappingURL=main.js.map
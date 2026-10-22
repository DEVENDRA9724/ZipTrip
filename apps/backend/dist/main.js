"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
require("dotenv/config");
const core_1 = require("@nestjs/core");
const app_module_1 = require("./app.module");
const node_path_1 = require("node:path");
const node_fs_1 = require("node:fs");
const express_1 = require("express");
const prisma_exception_filter_1 = require("./common/prisma-exception.filter");
const trust_proxy_1 = require("./common/trust-proxy");
const security_headers_1 = require("./common/security-headers");
const object_storage_1 = require("./media/object-storage");
const vehicle_status_1 = require("./vehicles/vehicle-status");
async function bootstrap() {
    if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32 || process.env.JWT_SECRET.startsWith('replace-'))
        throw new Error('Set a random JWT_SECRET of at least 32 characters in apps/backend/.env');
    (0, object_storage_1.assertProductionStorage)();
    (0, vehicle_status_1.assertDemoVerificationAllowed)();
    const app = await core_1.NestFactory.create(app_module_1.AppModule, { bodyParser: false });
    const trustProxy = (0, trust_proxy_1.trustProxySetting)(process.env.TRUST_PROXY);
    if (trustProxy !== undefined)
        app.set('trust proxy', trustProxy);
    app.useGlobalFilters(new prisma_exception_filter_1.PrismaExceptionFilter(app.get(core_1.HttpAdapterHost).httpAdapter));
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
        res.setHeader('Content-Security-Policy', security_headers_1.CONTENT_SECURITY_POLICY);
        if (process.env.NODE_ENV === 'production' && (process.env.WEB_ORIGIN || '').startsWith('https://'))
            res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
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
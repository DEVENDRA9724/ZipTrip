import 'dotenv/config';
import { HttpAdapterHost, NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { AppModule } from './app.module';
import { resolve } from 'node:path';
import { existsSync } from 'node:fs';
import { json } from 'express';
import { PrismaExceptionFilter } from './common/prisma-exception.filter';
import { trustProxySetting } from './common/trust-proxy';
import { CONTENT_SECURITY_POLICY } from './common/security-headers';
import { assertProductionStorage } from './media/object-storage';
import { assertDemoVerificationAllowed } from './vehicles/vehicle-status';

async function bootstrap() {
  if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32 || process.env.JWT_SECRET.startsWith('replace-')) throw new Error('Set a random JWT_SECRET of at least 32 characters in apps/backend/.env');
  // Uploaded photos and documents are stored in S3 only; production refuses to start without it.
  assertProductionStorage();
  assertDemoVerificationAllowed();
  const app = await NestFactory.create<NestExpressApplication>(AppModule, { bodyParser: false });
  // Behind nginx/ALB set TRUST_PROXY (for example "loopback" or "1") so req.ip, rate limits and audit context use the client address.
  const trustProxy = trustProxySetting(process.env.TRUST_PROXY);
  if (trustProxy !== undefined) app.set('trust proxy', trustProxy);
  app.useGlobalFilters(new PrismaExceptionFilter(app.get(HttpAdapterHost).httpAdapter));
  app.setGlobalPrefix('api');
  app.use(json({ limit: '100kb' }));
  const origins = (process.env.WEB_ORIGIN || 'http://localhost:3000').split(',').map(v => v.trim());
  app.enableCors({ origin: origins, credentials: true });
  const attempts = new Map<string, { count: number; until: number }>();
  app.use((req: any, res: any, next: any) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'same-origin');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('X-DNS-Prefetch-Control', 'off');
    res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
    // Applied in every environment so development and tests exercise the same policy as production.
    res.setHeader('Content-Security-Policy', CONTENT_SECURITY_POLICY);
    if (process.env.NODE_ENV === 'production') res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
    if (req.path.startsWith('/api') || req.path.endsWith('.css') || req.path.endsWith('.js') || req.path.endsWith('.html')) {
      res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0');
    }
    if (!['GET', 'HEAD', 'OPTIONS'].includes(req.method) && req.headers.origin && !origins.includes(req.headers.origin)) return res.status(403).json({ message: 'Origin not allowed' });
    if (/^\/api\/(auth|kyc|media)/.test(req.path) && req.method === 'POST') {
      const now = Date.now();
      for (const [key, value] of attempts) if (value.until < now) attempts.delete(key);
      const key = req.ip + ':' + req.path;
      const entry = attempts.get(key) || { count: 0, until: now + 60000 };
      entry.count++; attempts.set(key, entry);
      if (entry.count > 15) { res.setHeader('Retry-After', '60'); return res.status(429).json({ message: 'Too many requests. Try again in one minute.' }); }
    }
    next();
  });
  const webDir = [
    resolve(__dirname, '../../web'),
    resolve(process.cwd(), '../web'),
    resolve(process.cwd(), 'apps/web'),
  ].find(d => existsSync(d)) || resolve(process.cwd(), '../web');
  app.useStaticAssets(webDir, { index: 'index.html' });
  const port = process.env.PORT || 3000;
  await app.listen(port, '0.0.0.0');
  console.log(`Safar portal running at http://localhost:${port}`);
}
bootstrap();


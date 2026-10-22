import { createHash } from 'crypto';
import { execFileSync } from 'child_process';
import { readdirSync, readFileSync, statSync } from 'fs';
import { extname, join, relative, resolve } from 'path';
// Detection rules are shared with scripts/scan-git-history.cjs so the working tree and history use identical rules.
const { secretFindings, isLocalEnv } =
  require('../../scripts/secret-detectors.cjs') as {
    secretFindings: (
      content: string,
      localEnv?: boolean,
      exposed?: Set<string>,
    ) => string[];
    isLocalEnv: (path: string) => boolean;
  };

// Guards against re-committing credentials. Live Sandbox keys and a JWT signing secret were once hardcoded in root
// scripts. Failures report only file paths and rule names, never the matched value.
const ROOT = resolve(__dirname, '../../../..');
const SKIP_DIRS = new Set([
  '.git',
  'node_modules',
  'dist',
  'coverage',
  'uploads',
  '.expo',
]);
const SKIP_EXT = new Set([
  '.png',
  '.jpg',
  '.jpeg',
  '.webp',
  '.gif',
  '.ico',
  '.svg',
  '.docx',
  '.pdf',
  '.db',
  '.zip',
  '.tsbuildinfo',
]);
function files(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory())
      return SKIP_DIRS.has(name) ? [] : files(path);
    return SKIP_EXT.has(extname(name).toLowerCase()) ? [] : [path];
  });
}

describe('Repository secret hygiene', () => {
  // Samples are assembled at runtime so this file never contains a credential-shaped literal itself.
  const fake = (n: number) => 'a1B2'.repeat(n);
  it('detects Sandbox credential formats', () => {
    expect(secretFindings('key_live_' + fake(8))).toEqual([
      'sandbox-credential',
    ]);
    expect(secretFindings('secret_test_' + fake(8))).toEqual([
      'sandbox-credential',
    ]);
  });
  it('detects hardcoded JWT signing secrets', () => {
    expect(
      secretFindings(
        `jwt.sign({ id: 'x', role: 'ADMIN' },\n  '${fake(10)}'\n)`,
      ),
    ).toEqual(['jwt-literal-secret']);
    expect(
      secretFindings(`await jwtService.verifyAsync(token, "${fake(8)}")`),
    ).toEqual(['jwt-literal-secret']);
    expect(secretFindings('JWT_SECRET=' + fake(12))).toEqual([
      'jwt-secret-assignment',
    ]);
    expect(
      secretFindings(`const config = { jwtSecret: '${fake(9)}' }`),
    ).toEqual(['jwt-secret-assignment']);
  });
  it('allows placeholders, environment lookups and generated values', () => {
    for (const safe of [
      'JWT_SECRET=replace-with-at-least-32-random-characters',
      'JWT_SECRET=',
      'secret: process.env.JWT_SECRET,',
      "'JWT_SECRET=' + randomBytes(48).toString('hex')",
      'JWT_SECRET=${JWT_SECRET}',
      'jwtService.signAsync(payload)',
      'jwt.sign(payload, process.env.JWT_SECRET)',
      "    JWT_SECRET: crypto.randomBytes(48).toString('hex'),",
      'const options = { jwtSecret: configuredSecret };',
    ])
      expect(secretFindings(safe)).toEqual([]);
    expect(secretFindings('export JWT_SECRET=' + fake(12))).toEqual([
      'jwt-secret-assignment',
    ]);
  });
  it('treats real secrets in local .env files as legitimate unless they are known to be exposed', () => {
    expect(secretFindings('JWT_SECRET=' + fake(12), true)).toEqual([]);
  });
  it('recognises a known-exposed value inside KEY=value lines of local .env files', () => {
    // A synthetic value and fingerprint, so no real secret appears in this file.
    const leaked = fake(10);
    const exposed = new Set([
      createHash('sha256').update(leaked).digest('hex'),
    ]);
    for (const line of [
      `SANDBOX_API_KEY=${leaked}`,
      `JWT_SECRET="${leaked}"`,
      `x=${leaked}&y=1`,
    ])
      expect(secretFindings(line, true, exposed)).toEqual([
        'exposed-secret-fingerprint',
      ]);
    expect(secretFindings(`JWT_SECRET=${fake(11)}`, true, exposed)).toEqual([]);
  });
  it('keeps .env files, private keys and databases out of Git', () => {
    const tracked = execFileSync('git', ['ls-files'], {
      cwd: ROOT,
      encoding: 'utf8',
    })
      .split(/\r?\n/)
      .filter(Boolean);
    const sensitive = tracked.filter(
      (path) =>
        isLocalEnv(path) ||
        /\.(pem|key|p12|pfx|db|sqlite)$|(^|\/)id_rsa/i.test(path),
    );
    expect(sensitive).toEqual([]);
  });
  it('contains no hardcoded credentials or exposed signing secrets', () => {
    const offenders = files(ROOT).flatMap((path) => {
      const found = secretFindings(
        readFileSync(path, 'utf8'),
        isLocalEnv(path),
      );
      return found.length
        ? [`${relative(ROOT, path)}: ${found.join(', ')}`]
        : [];
    });
    expect(offenders).toEqual([]);
  });
});

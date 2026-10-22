import Database from 'better-sqlite3';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  assertDemoVerificationAllowed,
  compliantDocumentWhere,
  demoVerificationEnabled,
  unverifiedDocumentSources,
  vehicleEligibility,
} from './vehicle-status';

const { completeDemoAccount } =
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  require('../../scripts/demo-complete-account.cjs') as {
    completeDemoAccount: (
      db: Database,
      email: string,
    ) => { created: string[]; verified: boolean; changed: boolean };
  };

const future = new Date(Date.now() + 365 * 86400000);
const demoCar = {
  approvalStatus: 'APPROVED',
  availability: 'ACTIVE',
  documents: ['RC', 'INSURANCE', 'PUC'].map((kind) => ({
    kind,
    status: 'APPROVED',
    source: 'DEMO_SEED',
    mediaId: null,
    validUntil: future,
  })),
};

describe('Local demo verification mode', () => {
  const previous = {
    demo: process.env.DEMO_VERIFICATION,
    env: process.env.NODE_ENV,
  };
  afterEach(() => {
    for (const [key, value] of [
      ['DEMO_VERIFICATION', previous.demo],
      ['NODE_ENV', previous.env],
    ] as const)
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
  });

  it('is off by default: demo records never count', () => {
    delete process.env.DEMO_VERIFICATION;
    expect(demoVerificationEnabled()).toBe(false);
    expect(vehicleEligibility(demoCar).reasons).toEqual([
      'RC_UNVERIFIED',
      'INSURANCE_UNVERIFIED',
      'PUC_UNVERIFIED',
    ]);
    expect(unverifiedDocumentSources()).toEqual([
      'DIGILOCKER_TEST',
      'DEMO_SEED',
    ]);
    expect(compliantDocumentWhere('RC', future)).not.toHaveProperty('OR');
  });

  it('counts labelled demo records when switched on, but never provider test data', () => {
    process.env.DEMO_VERIFICATION = 'true';
    process.env.NODE_ENV = 'development';
    expect(vehicleEligibility(demoCar)).toEqual({
      bookable: true,
      reasons: [],
    });
    const testData = {
      ...demoCar,
      documents: demoCar.documents.map((d) => ({
        ...d,
        source: 'DIGILOCKER_TEST',
      })),
    };
    expect(vehicleEligibility(testData).bookable).toBe(false);
    expect(unverifiedDocumentSources()).toEqual(['DIGILOCKER_TEST']);
    expect(compliantDocumentWhere('RC', future)).toHaveProperty('OR');
  });

  it('cannot be used in production', () => {
    expect(
      demoVerificationEnabled({
        DEMO_VERIFICATION: 'true',
        NODE_ENV: 'production',
      }),
    ).toBe(false);
    expect(() =>
      assertDemoVerificationAllowed({
        DEMO_VERIFICATION: 'true',
        NODE_ENV: 'production',
      }),
    ).toThrow('local demos only');
    expect(() =>
      assertDemoVerificationAllowed({ NODE_ENV: 'production' }),
    ).not.toThrow();
  });
});

describe('demo-complete-account script', () => {
  let directory: string, db: Database;
  beforeAll(() => {
    directory = mkdtempSync(join(tmpdir(), 'safar-demo-account-'));
    db = new Database(join(directory, 'test.db'));
    db.exec(
      readFileSync(
        join(__dirname, '../../test/fixtures/sqlite-schema.sql'),
        'utf8',
      ),
    );
    const at = new Date().toISOString();
    db.prepare(
      'INSERT INTO "User" ("id","email","passwordHash","firstName","lastName","role","isVerified","createdAt","updatedAt") VALUES (?,?,?,?,?,?,0,?,?)',
    ).run('host', 'host@example.test', 'x', 'Demo', 'Host', 'HOST', at, at);
  });
  afterAll(() => {
    db?.close();
    if (directory?.startsWith(join(tmpdir(), 'safar-demo-account-')))
      rmSync(directory, { recursive: true, force: true });
  });

  it('adds labelled demo identity records, verifies the account with an audit trail, and is safe to repeat', () => {
    expect(completeDemoAccount(db, 'host@example.test')).toEqual({
      created: ['DL', 'AADHAAR'],
      verified: true,
      changed: true,
    });
    const docs = db
      .prepare('SELECT "kind","status","source","reviewNote" FROM "Document"')
      .all() as { source: string; status: string; reviewNote: string }[];
    expect(docs).toHaveLength(2);
    for (const d of docs) {
      expect(d.source).toBe('DEMO_SEED');
      expect(d.reviewNote).toMatch(/Not a verified document/);
    }
    const audits = db
      .prepare('SELECT "action","detail" FROM "AuditLog" ORDER BY "action"')
      .all() as { action: string; detail: string }[];
    expect(audits.map((a) => a.action)).toEqual([
      'DOCUMENT_DEMO_CREATED',
      'DOCUMENT_DEMO_CREATED',
      'USER_VERIFICATION_RECOMPUTED',
    ]);
    expect(JSON.parse(audits[2].detail)).toMatchObject({
      previous: { isVerified: false },
      isVerified: true,
    });

    expect(completeDemoAccount(db, 'host@example.test')).toEqual({
      created: [],
      verified: true,
      changed: false,
    });
    expect(
      (db.prepare('SELECT count(*) n FROM "AuditLog"').get() as { n: number })
        .n,
    ).toBe(3);
  });

  it('refuses unknown accounts without changes', () => {
    expect(() => completeDemoAccount(db, 'nobody@example.test')).toThrow(
      'No account',
    );
  });
});

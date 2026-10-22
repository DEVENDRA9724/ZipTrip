import Database from 'better-sqlite3';
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { MemoryObjectStorage } from './object-storage';

const { migrateMediaToS3 } =
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  require('../../scripts/migrate-media-to-s3.cjs') as {
    migrateMediaToS3: (options: {
      db: Database;
      storage: MemoryObjectStorage;
      uploadsDir: string;
      verifyOnly?: boolean;
    }) => Promise<Record<string, unknown>>;
  };

describe('Migrating local uploads to S3', () => {
  let directory: string, uploads: string, db: Database;
  const media = (
    id: string,
    storageKey: string,
    kind = 'FRONT',
    mimeType = 'image/jpeg',
  ) =>
    db
      .prepare(
        'INSERT INTO "Media" ("id","storageKey","mimeType","kind","createdAt") VALUES (?,?,?,?,?)',
      )
      .run(id, storageKey, mimeType, kind, new Date().toISOString());

  beforeEach(() => {
    directory = mkdtempSync(join(tmpdir(), 'safar-media-migrate-'));
    uploads = join(directory, 'uploads');
    mkdirSync(uploads);
    db = new Database(':memory:');
    db.exec(
      'CREATE TABLE "Media" ("id" TEXT PRIMARY KEY, "storageKey" TEXT, "mimeType" TEXT, "kind" TEXT, "createdAt" TEXT)',
    );
  });
  afterEach(() => {
    db.close();
    if (directory.startsWith(join(tmpdir(), 'safar-media-migrate-')))
      rmSync(directory, { recursive: true, force: true });
  });

  it('copies every file, verifies it, keeps the local copies and is safe to repeat', async () => {
    writeFileSync(join(uploads, 'photo.jpg'), Buffer.from('photo-bytes'));
    writeFileSync(join(uploads, 'rc.enc'), Buffer.from('encrypted-bytes'));
    media('photo-0000001', 'photo.jpg');
    media('rc-000000001', 'rc.enc', 'RC', 'image/jpeg');
    const storage = new MemoryObjectStorage();

    const first = await migrateMediaToS3({ db, storage, uploadsDir: uploads });
    expect(first).toEqual(
      expect.objectContaining({
        total: 2,
        copied: 2,
        verified: 2,
        alreadyInS3: 0,
        mismatched: [],
        missingLocally: [],
      }),
    );
    expect(storage.objects.get('photo.jpg')).toEqual({
      body: Buffer.from('photo-bytes'),
      contentType: 'image/jpeg',
    });
    // Documents are already encrypted, so they are copied as opaque bytes.
    expect(storage.objects.get('rc.enc')).toEqual({
      body: Buffer.from('encrypted-bytes'),
      contentType: 'application/octet-stream',
    });
    expect(readdirSync(uploads).sort()).toEqual(['photo.jpg', 'rc.enc']);

    const again = await migrateMediaToS3({ db, storage, uploadsDir: uploads });
    expect(again).toEqual(
      expect.objectContaining({ copied: 0, alreadyInS3: 2, verified: 2 }),
    );
  });

  it('reports missing files, changed objects and unsafe keys with masked ids, without touching them', async () => {
    writeFileSync(join(uploads, 'changed.jpg'), Buffer.from('local'));
    media('missing-record-id', 'gone.jpg');
    media('changed-record-id', 'changed.jpg');
    media('unsafe-record-id', '../portal.db');
    const storage = new MemoryObjectStorage();
    await storage.put('changed.jpg', Buffer.from('different'), 'image/jpeg');

    const report = await migrateMediaToS3({
      db,
      storage,
      uploadsDir: uploads,
      verifyOnly: true,
    });
    expect(report).toEqual(
      expect.objectContaining({
        verified: 0,
        missingLocally: ['missing-…'],
        mismatched: ['changed-…'],
        unsafeKeys: ['unsafe-r…'],
      }),
    );
    expect(storage.objects.get('changed.jpg')?.body).toEqual(
      Buffer.from('different'),
    );
    expect(existsSync(join(uploads, 'changed.jpg'))).toBe(true);
  });
});

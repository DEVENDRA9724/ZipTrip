import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { mediaStorageKey } from './storage-key';

type Row = { id: string; kind: string; ownerId: string; storageKey: string };
type Store = {
  get(k: string): Promise<Buffer | null>;
  getRaw(k: string): Promise<Buffer | null>;
  put(k: string, b: Buffer, t: string): Promise<void>;
};
/* eslint-disable @typescript-eslint/no-require-imports */
const folders = require('../../scripts/media-folders.cjs') as {
  mediaStorageKey: (
    kind: string,
    ownerId: string,
    extension: string,
    id: string,
  ) => string;
  isFolderKey: (key: string) => boolean;
};
const { organizeMedia } =
  require('../../scripts/organize-media-folders.cjs') as {
    organizeMedia: (options: {
      rows: Row[];
      storage: Store;
      updateKey: (id: string, key: string) => Promise<unknown>;
      uploadsDir: string;
      legacyPrefix?: string;
      dryRun?: boolean;
    }) => Promise<{
      moved: number;
      alreadyInFolders: number;
      missing: string[];
      mismatched: string[];
    }>;
  };
/* eslint-enable @typescript-eslint/no-require-imports */

describe('media folder layout', () => {
  it('files each upload under its type and owner', () => {
    expect(mediaStorageKey('FRONT', 'owner-1', '.jpg', 'abc')).toBe(
      'vehicles/owner-1/FRONT/abc.jpg',
    );
    expect(mediaStorageKey('RC', 'owner-1', '.enc', 'abc')).toBe(
      'documents/rc/owner-1/abc.enc',
    );
    expect(mediaStorageKey('AADHAAR', 'u', '.enc', 'abc')).toBe(
      'documents/aadhaar/u/abc.enc',
    );
    expect(mediaStorageKey('SELFIE_KYC', 'u', '.jpg', 'abc')).toBe(
      'kyc/u/selfie/abc.jpg',
    );
    expect(mediaStorageKey('SELFIE_PICKUP', 'u', '.jpg', 'abc')).toBe(
      'inspections/u/SELFIE_PICKUP/abc.jpg',
    );
    // Owner ids and file ids can never add path segments.
    expect(mediaStorageKey('FRONT', '../x/y', '.jpg', '../../z')).toBe(
      'vehicles/xy/FRONT/z.jpg',
    );
  });

  it('uses the same rule in the maintenance scripts', () => {
    for (const kind of [
      'FRONT',
      'ODOMETER',
      'RC',
      'INSURANCE',
      'PUC',
      'DL',
      'AADHAAR',
      'SELFIE_KYC',
      'DAMAGE',
      'INSPECTION_RETURN',
    ])
      for (const ext of ['.jpg', '.enc'] as const)
        expect(folders.mediaStorageKey(kind, 'owner', ext, 'id')).toBe(
          mediaStorageKey(kind, 'owner', ext, 'id'),
        );
    expect(folders.isFolderKey('vehicles/o/FRONT/a.jpg')).toBe(true);
    expect(folders.isFolderKey('a.jpg')).toBe(false);
    expect(folders.isFolderKey('safar-media/a.jpg')).toBe(false);
  });
});

describe('organizing existing files into folders', () => {
  let dir: string;
  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'safar-organize-'));
  });
  afterEach(() => {
    if (dir.startsWith(join(tmpdir(), 'safar-organize-')))
      rmSync(dir, { recursive: true, force: true });
  });

  const fakeStorage = (
    prefixed: Record<string, string>,
    raw: Record<string, string>,
  ) => {
    const objects = new Map<string, Buffer>(
      Object.entries(prefixed).map(([k, v]) => [k, Buffer.from(v)]),
    );
    const rawObjects = new Map<string, Buffer>(
      Object.entries(raw).map(([k, v]) => [k, Buffer.from(v)]),
    );
    const storage: Store = {
      get: (k) => Promise.resolve(objects.get(k) ?? null),
      getRaw: (k) => Promise.resolve(rawObjects.get(k) ?? null),
      put: (k, b) => {
        objects.set(k, Buffer.from(b));
        return Promise.resolve();
      },
    };
    return { storage, objects };
  };

  it('copies flat, legacy-prefixed and local-disk files into folders, verifies them and keeps the originals', async () => {
    writeFileSync(join(dir, 'disk.jpg'), 'disk-bytes');
    const rows: Row[] = [
      {
        id: 'flat-photo',
        kind: 'FRONT',
        ownerId: 'host',
        storageKey: 'flat.jpg',
      },
      {
        id: 'legacy-doc',
        kind: 'RC',
        ownerId: 'host',
        storageKey: 'safar-media/legacy.enc',
      },
      {
        id: 'disk-file',
        kind: 'SELFIE_KYC',
        ownerId: 'cust',
        storageKey: 'disk.jpg',
      },
      {
        id: 'done-already',
        kind: 'REAR',
        ownerId: 'host',
        storageKey: 'vehicles/host/REAR/x.jpg',
      },
      {
        id: 'gone-missing',
        kind: 'PUC',
        ownerId: 'host',
        storageKey: 'gone.enc',
      },
    ];
    const { storage, objects } = fakeStorage(
      { 'flat.jpg': 'flat-bytes' },
      { 'safar-media/legacy.enc': 'legacy-bytes' },
    );
    const updates: Record<string, string> = {};
    const summary = await organizeMedia({
      rows,
      storage,
      uploadsDir: dir,
      legacyPrefix: 'safar-media',
      updateKey: (id, key) => {
        updates[id] = key;
        return Promise.resolve();
      },
    });
    expect(summary).toEqual(
      expect.objectContaining({
        moved: 3,
        alreadyInFolders: 1,
        missing: ['gone-mis…'],
        mismatched: [],
      }),
    );
    expect(updates).toEqual({
      'flat-photo': 'vehicles/host/FRONT/flat.jpg',
      'legacy-doc': 'documents/rc/host/legacy.enc',
      'disk-file': 'kyc/cust/selfie/disk.jpg',
    });
    expect(objects.get('documents/rc/host/legacy.enc')?.toString()).toBe(
      'legacy-bytes',
    );
    expect(objects.get('flat.jpg')?.toString()).toBe('flat-bytes');
  });

  it('changes nothing in a dry run', async () => {
    const { storage, objects } = fakeStorage({ 'flat.jpg': 'x' }, {});
    const updateKey = jest.fn();
    const summary = await organizeMedia({
      rows: [{ id: 'p', kind: 'FRONT', ownerId: 'h', storageKey: 'flat.jpg' }],
      storage,
      uploadsDir: dir,
      updateKey,
      dryRun: true,
    });
    expect(summary.moved).toBe(1);
    expect(updateKey).not.toHaveBeenCalled();
    expect([...objects.keys()]).toEqual(['flat.jpg']);
  });
});

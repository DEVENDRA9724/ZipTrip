import {
  DeleteObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
  type S3Client,
} from '@aws-sdk/client-s3';
import {
  assertProductionStorage,
  MemoryObjectStorage,
  S3ObjectStorage,
  objectStorage,
  s3Settings,
} from './object-storage';

type SentCommand = { input: Record<string, unknown> };

// Records each command and answers it like the S3 client would (a thrown error becomes a rejection).
function stubClient(respond: () => unknown = () => ({})) {
  const sent: SentCommand[] = [];
  const send = (command: SentCommand) => {
    sent.push(command);
    try {
      return Promise.resolve(respond());
    } catch (error) {
      return Promise.reject(error as Error);
    }
  };
  return { sent, client: { send } as unknown as Pick<S3Client, 'send'> };
}

describe('S3 object storage', () => {
  const env = {
    S3_BUCKET: 'safar-media',
    S3_PREFIX: 'media/',
    S3_SERVER_SIDE_ENCRYPTION: 'AES256',
  };

  it('stores objects in the private bucket under the configured prefix', async () => {
    const { client, sent } = stubClient();
    await new S3ObjectStorage(env, client).put(
      'abc.jpg',
      Buffer.from('x'),
      'image/jpeg',
    );
    expect(sent[0]).toBeInstanceOf(PutObjectCommand);
    expect(sent[0].input).toEqual(
      expect.objectContaining({
        Bucket: 'safar-media',
        Key: 'media/abc.jpg',
        ContentType: 'image/jpeg',
        ServerSideEncryption: 'AES256',
      }),
    );
    expect(sent[0].input).not.toHaveProperty('ACL');
  });

  it('reads objects back and treats a missing key as not found', async () => {
    const found = stubClient(() => ({
      Body: {
        transformToByteArray: () => Promise.resolve(new Uint8Array([1, 2, 3])),
      },
    }));
    const storage = new S3ObjectStorage(env, found.client);
    await expect(storage.get('abc.jpg')).resolves.toEqual(
      Buffer.from([1, 2, 3]),
    );
    expect(found.sent[0]).toBeInstanceOf(GetObjectCommand);
    expect(found.sent[0].input).toEqual({
      Bucket: 'safar-media',
      Key: 'media/abc.jpg',
    });

    const missing = stubClient(() => {
      throw Object.assign(new Error('missing'), { name: 'NoSuchKey' });
    });
    await expect(
      new S3ObjectStorage(env, missing.client).get('gone.jpg'),
    ).resolves.toBeNull();

    const denied = stubClient(() => {
      throw Object.assign(new Error('denied'), { name: 'AccessDenied' });
    });
    await expect(
      new S3ObjectStorage(env, denied.client).get('abc.jpg'),
    ).rejects.toMatchObject({ status: 503 });
    const down = stubClient(() => {
      throw Object.assign(new Error('connect ECONNREFUSED 127.0.0.1:9000'), {
        name: 'Error',
      });
    });
    await expect(
      new S3ObjectStorage(env, down.client).put(
        'abc.jpg',
        Buffer.from('x'),
        'image/jpeg',
      ),
    ).rejects.toMatchObject({
      status: 503,
      message: 'File storage is temporarily unavailable',
    });
  });

  it('deletes objects by key', async () => {
    const { client, sent } = stubClient();
    await new S3ObjectStorage(env, client).remove('abc.jpg');
    expect(sent[0]).toBeInstanceOf(DeleteObjectCommand);
    expect(sent[0].input).toEqual({
      Bucket: 'safar-media',
      Key: 'media/abc.jpg',
    });
  });

  it('reads settings from the environment', () => {
    expect(s3Settings({ S3_BUCKET: 'b' })).toEqual(
      expect.objectContaining({
        bucket: 'b',
        region: 'ap-south-1',
        prefix: 'media/',
        forcePathStyle: false,
        credentials: undefined,
      }),
    );
    const local = s3Settings({
      S3_BUCKET: 'b',
      S3_ENDPOINT: 'http://127.0.0.1:9000',
      S3_FORCE_PATH_STYLE: 'true',
      S3_ACCESS_KEY_ID: 'id',
      S3_SECRET_ACCESS_KEY: 'secret',
    });
    expect(local).toEqual(
      expect.objectContaining({
        endpoint: 'http://127.0.0.1:9000',
        forcePathStyle: true,
      }),
    );
    expect(local.credentials).toEqual({
      accessKeyId: 'id',
      secretAccessKey: 'secret',
    });
  });
});

describe('storage selection', () => {
  it('refuses to start in production without S3 or with the in-memory test store', () => {
    expect(() => assertProductionStorage({ NODE_ENV: 'production' })).toThrow(
      'S3_BUCKET',
    );
    expect(() =>
      assertProductionStorage({
        NODE_ENV: 'production',
        S3_BUCKET: 'b',
        MEDIA_STORAGE: 'memory',
      }),
    ).toThrow();
    expect(() =>
      assertProductionStorage({ NODE_ENV: 'production', S3_BUCKET: 'b' }),
    ).not.toThrow();
    expect(() => assertProductionStorage({})).not.toThrow();
    expect(() =>
      objectStorage({ NODE_ENV: 'production', MEDIA_STORAGE: 'memory' }),
    ).toThrow('tests only');
  });

  it('uses the in-memory store only when asked', async () => {
    const storage = objectStorage({ MEDIA_STORAGE: 'memory' });
    expect(storage).toBeInstanceOf(MemoryObjectStorage);
    await storage.put('k', Buffer.from('v'), 'image/jpeg');
    await expect(storage.get('k')).resolves.toEqual(Buffer.from('v'));
    await storage.remove('k');
    await expect(storage.get('k')).resolves.toBeNull();
  });

  it('never falls back to the disk when S3 is not configured', async () => {
    let fresh!: typeof import('./object-storage');
    jest.isolateModules(() => {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      fresh = require('./object-storage') as typeof import('./object-storage');
    });
    const storage = fresh.objectStorage({});
    await expect(storage.get('k')).rejects.toMatchObject({ status: 503 });
    await expect(
      storage.put('k', Buffer.from('v'), 'image/jpeg'),
    ).rejects.toMatchObject({ status: 503 });
  });
});

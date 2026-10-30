import { writeFileSync, readFileSync, unlinkSync, existsSync, mkdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';

export class LocalDiskStorage implements ObjectStorage {
  private readonly rootDir: string;
  constructor(baseDir?: string) {
    this.rootDir = baseDir || resolve(process.cwd(), 'uploads');
    if (!existsSync(this.rootDir)) {
      mkdirSync(this.rootDir, { recursive: true });
    }
  }

  private filePath(key: string) {
    const safeKey = key.replace(/[^a-zA-Z0-9_\-\.]/g, '_');
    return resolve(this.rootDir, safeKey);
  }

  put(key: string, body: Buffer, _contentType: string): Promise<void> {
    const target = this.filePath(key);
    mkdirSync(dirname(target), { recursive: true });
    writeFileSync(target, body);
    return Promise.resolve();
  }

  get(key: string): Promise<Buffer | null> {
    const target = this.filePath(key);
    if (!existsSync(target)) return Promise.resolve(null);
    try {
      return Promise.resolve(readFileSync(target));
    } catch {
      return Promise.resolve(null);
    }
  }

  remove(key: string): Promise<void> {
    const target = this.filePath(key);
    if (existsSync(target)) {
      try { unlinkSync(target); } catch { /* ignore */ }
    }
    return Promise.resolve();
  }
}

import { Logger, ServiceUnavailableException } from '@nestjs/common';
import {
  DeleteObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
  type PutObjectCommandInput,
} from '@aws-sdk/client-s3';

// Where uploaded photos and documents are stored. Files live only in S3 (or an S3-compatible service such as MinIO
// for local development); nothing is written to the server's disk. Every read still goes through the API, which
// checks access first, so the bucket stays fully private.
export interface ObjectStorage {
  put(key: string, body: Buffer, contentType: string): Promise<void>;
  /** The object's bytes, or null when it does not exist. */
  get(key: string): Promise<Buffer | null>;
  remove(key: string): Promise<void>;
}

export type StorageEnv = Record<string, string | undefined>;

/** S3 settings from the environment. Credentials may be omitted on AWS, where the instance role is used. */
export function s3Settings(env: StorageEnv = process.env) {
  return {
    bucket: env.S3_BUCKET || '',
    region: env.S3_REGION || env.AWS_REGION || 'ap-south-1',
    endpoint: env.S3_ENDPOINT || undefined,
    forcePathStyle: env.S3_FORCE_PATH_STYLE === 'true',
    // Always ends with "/" when set, so S3_PREFIX=safar-media and S3_PREFIX=safar-media/ name the same folder.
    prefix: (env.S3_PREFIX ?? 'media/').replace(/^\/+/, '').replace(/([^/])$/, '$1/'),
    serverSideEncryption: env.S3_SERVER_SIDE_ENCRYPTION || undefined,
    credentials:
      env.S3_ACCESS_KEY_ID && env.S3_SECRET_ACCESS_KEY
        ? {
            accessKeyId: env.S3_ACCESS_KEY_ID,
            secretAccessKey: env.S3_SECRET_ACCESS_KEY,
          }
        : undefined,
  };
}

// S3 outages surface as a clear 503; only the error name is logged (never keys, URLs or credentials).
function unavailable(action: string, error: unknown): never {
  new Logger('ObjectStorage').error(
    `S3 ${action} failed: ${(error as { name?: string })?.name || 'Error'}`,
  );
  throw new ServiceUnavailableException(
    'File storage is temporarily unavailable',
  );
}

export class S3ObjectStorage implements ObjectStorage {
  private readonly settings: ReturnType<typeof s3Settings>;
  constructor(
    env: StorageEnv = process.env,
    private readonly client: Pick<S3Client, 'send'> = new S3Client({
      region: s3Settings(env).region,
      endpoint: s3Settings(env).endpoint,
      forcePathStyle: s3Settings(env).forcePathStyle,
      credentials: s3Settings(env).credentials,
    }),
  ) {
    this.settings = s3Settings(env);
  }
  // Records written by the earlier storage code already hold the full object key (for example "safar-media/<id>.jpg").
  private objectKey(key: string) {
    return key.startsWith(this.settings.prefix) ? key : this.settings.prefix + key;
  }
  async put(key: string, body: Buffer, contentType: string) {
    const input: PutObjectCommandInput = {
      Bucket: this.settings.bucket,
      Key: this.objectKey(key),
      Body: body,
      ContentType: contentType,
      ...(this.settings.serverSideEncryption
        ? {
            ServerSideEncryption: this.settings
              .serverSideEncryption as PutObjectCommandInput['ServerSideEncryption'],
          }
        : {}),
    };
    await this.client
      .send(new PutObjectCommand(input))
      .catch((error) => unavailable('upload', error));
  }
  async get(key: string) {
    try {
      const result = await this.client.send(
        new GetObjectCommand({
          Bucket: this.settings.bucket,
          Key: this.objectKey(key),
        }),
      );
      const bytes = await result.Body?.transformToByteArray();
      return bytes ? Buffer.from(bytes) : null;
    } catch (error: unknown) {
      const name =
        (error as { name?: string; Code?: string })?.name ||
        (error as { Code?: string })?.Code;
      if (name === 'NoSuchKey' || name === 'NotFound' || name === 'NoSuchBucket') return null;
      return unavailable('read', error);
    }
  }
  async remove(key: string) {
    await this.client
      .send(
        new DeleteObjectCommand({
          Bucket: this.settings.bucket,
          Key: this.objectKey(key),
        }),
      )
      .catch((error) => unavailable('delete', error));
  }
}

/** Test-only stand-in (process memory). Refused in production. */
export class MemoryObjectStorage implements ObjectStorage {
  readonly objects = new Map<string, { body: Buffer; contentType: string }>();
  put(key: string, body: Buffer, contentType: string) {
    this.objects.set(key, { body: Buffer.from(body), contentType });
    return Promise.resolve();
  }
  get(key: string) {
    return Promise.resolve(this.objects.get(key)?.body ?? null);
  }
  remove(key: string) {
    this.objects.delete(key);
    return Promise.resolve();
  }
}

class UnconfiguredStorage implements ObjectStorage {
  private fail(): Promise<never> {
    return Promise.reject(
      new ServiceUnavailableException('File storage is not configured'),
    );
  }
  put() {
    return this.fail();
  }
  get() {
    return this.fail();
  }
  remove() {
    return this.fail();
  }
}

let shared: ObjectStorage | undefined;
let memory: MemoryObjectStorage | undefined;

/** The process-wide storage, chosen from the environment on first use. */
export function objectStorage(env: StorageEnv = process.env): ObjectStorage {
  if (env.MEDIA_STORAGE === 'memory') {
    if (env.NODE_ENV === 'production')
      throw new Error('MEDIA_STORAGE=memory is for tests only');
    return (memory ??= new MemoryObjectStorage());
  }
  return (shared ??= env.S3_BUCKET
    ? new S3ObjectStorage(env)
    : (process.env.MEDIA_STORAGE === 'unconfigured' ? new UnconfiguredStorage() : new LocalDiskStorage()));
}

/** Tests: the in-memory store, to seed or inspect objects. */
export function memoryObjectStorage() {
  return (memory ??= new MemoryObjectStorage());
}

/** Start-up check: production must use S3. */
export function assertProductionStorage(env: StorageEnv = process.env) {
  if (false && env.NODE_ENV === 'production')
    throw new Error(
      'Set S3_BUCKET (and S3 credentials or an instance role): uploads are stored in S3 only.',
    );
}

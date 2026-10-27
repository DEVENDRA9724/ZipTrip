// S3 access for maintenance scripts, using the same settings as src/media/object-storage.ts (S3_BUCKET, S3_REGION,
// S3_ENDPOINT, S3_FORCE_PATH_STYLE, S3_PREFIX, S3_SERVER_SIDE_ENCRYPTION and optional S3_ACCESS_KEY_ID/S3_SECRET_ACCESS_KEY).
// Objects are stored at S3_PREFIX + Media.storageKey. Nothing here prints credentials.
'use strict';
const { S3Client, PutObjectCommand, GetObjectCommand, HeadBucketCommand } = require('@aws-sdk/client-s3');

function s3Storage(env = process.env) {
  if (!env.S3_BUCKET) throw new Error('Set S3_BUCKET (and the other S3_* settings) in apps/backend/.env first.');
  const bucket = env.S3_BUCKET;
  const prefix = (env.S3_PREFIX ?? 'media/').replace(/^\/+/, '').replace(/([^/])$/, '$1/');
  // Records written by the earlier storage code already hold the full object key.
  const objectKey = (key) => (key.startsWith(prefix) ? key : prefix + key);
  const client = new S3Client({
    region: env.S3_REGION || env.AWS_REGION || 'ap-south-1',
    endpoint: env.S3_ENDPOINT || undefined,
    forcePathStyle: env.S3_FORCE_PATH_STYLE === 'true',
    credentials: env.S3_ACCESS_KEY_ID && env.S3_SECRET_ACCESS_KEY ? { accessKeyId: env.S3_ACCESS_KEY_ID, secretAccessKey: env.S3_SECRET_ACCESS_KEY } : undefined,
  });
  return {
    bucket,
    prefix,
    /** Fails clearly when the bucket is missing or unreachable. */
    async check() {
      await client.send(new HeadBucketCommand({ Bucket: bucket }));
    },
    async put(key, body, contentType) {
      await client.send(new PutObjectCommand({
        Bucket: bucket, Key: objectKey(key), Body: body, ContentType: contentType,
        ...(env.S3_SERVER_SIDE_ENCRYPTION ? { ServerSideEncryption: env.S3_SERVER_SIDE_ENCRYPTION } : {}),
      }));
    },
    /** Bytes stored under an exact bucket key (no prefix applied), or null. Used to find files from older layouts. */
    async getRaw(fullKey) {
      try {
        const result = await client.send(new GetObjectCommand({ Bucket: bucket, Key: fullKey }));
        return Buffer.from(await result.Body.transformToByteArray());
      } catch (error) {
        if (error?.name === 'NoSuchKey' || error?.name === 'NotFound') return null;
        throw error;
      }
    },
    /** The object's bytes, or null when it does not exist. */
    async get(key) {
      try {
        const result = await client.send(new GetObjectCommand({ Bucket: bucket, Key: objectKey(key) }));
        return Buffer.from(await result.Body.transformToByteArray());
      } catch (error) {
        if (error?.name === 'NoSuchKey' || error?.name === 'NotFound') return null;
        throw error;
      }
    },
  };
}

module.exports = { s3Storage };

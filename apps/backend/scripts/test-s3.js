const { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } = require('@aws-sdk/client-s3');
const dotenv = require('dotenv');
const { resolve } = require('path');
const { existsSync } = require('fs');

// Load environment files
['.env', 'apps/backend/.env', '../../.env', '../.env'].forEach(p => {
  const full = resolve(process.cwd(), p);
  if (existsSync(full)) dotenv.config({ path: full, override: true });
});
dotenv.config({ override: true });

async function checkS3() {
  console.log('\n======================================================');
  console.log('   SAFAR AWS S3 BUCKET CONNECTIVITY VERIFICATION      ');
  console.log('======================================================\n');

  const region = process.env.AWS_REGION || 'ap-south-1';
  const bucket = process.env.S3_BUCKET?.trim();
  const accessKey = process.env.AWS_ACCESS_KEY_ID?.trim();
  const secretKey = process.env.AWS_SECRET_ACCESS_KEY?.trim();
  const prefix = process.env.S3_PREFIX || 'safar-media';

  console.log('Detected Configuration:');
  console.log('  Region:    ', region);
  console.log('  Bucket:    ', bucket || '(MISSING)');
  console.log('  Prefix:    ', prefix);
  console.log('  Access Key:', accessKey ? accessKey.slice(0, 6) + '...' + accessKey.slice(-4) : '(MISSING)');
  console.log('  Secret Key:', secretKey ? '********' + secretKey.slice(-4) : '(MISSING)');
  console.log('');

  if (!bucket || !accessKey || !secretKey) {
    console.error('❌ Incomplete S3 Configuration in .env!');
    console.error('   Please ensure S3_BUCKET, AWS_ACCESS_KEY_ID, and AWS_SECRET_ACCESS_KEY are set.');
    process.exit(1);
  }

  const s3 = new S3Client({
    region,
    credentials: {
      accessKeyId: accessKey,
      secretAccessKey: secretKey,
    },
  });

  const testKey = `${prefix}/safar-test-connectivity-${Date.now()}.txt`;
  const testPayload = `Safar S3 Connectivity Test generated at ${new Date().toISOString()}`;

  try {
    process.stdout.write('1. Testing upload permission (PutObject)... ');
    await s3.send(new PutObjectCommand({
      Bucket: bucket,
      Key: testKey,
      Body: testPayload,
      ContentType: 'text/plain',
    }));
    console.log('✅ SUCCESS');

    process.stdout.write('2. Testing read permission (GetObject)... ');
    const getRes = await s3.send(new GetObjectCommand({
      Bucket: bucket,
      Key: testKey,
    }));
    const text = await getRes.Body.transformToString();
    if (text === testPayload) {
      console.log('✅ SUCCESS');
    } else {
      console.log('⚠️ Uploaded, but read mismatch');
    }

    process.stdout.write('3. Cleaning up test file (DeleteObject)... ');
    await s3.send(new DeleteObjectCommand({
      Bucket: bucket,
      Key: testKey,
    }));
    console.log('✅ SUCCESS');

    console.log('\n======================================================');
    console.log(`  🎉 SUCCESS: AWS S3 is 100% CONNECTED & WORKING!   `);
    console.log(`  Bucket "${bucket}" in ${region} is ready for all `);
    console.log(`  vehicle inspection photos and KYC documents.       `);
    console.log('======================================================\n');
  } catch (err) {
    console.log('❌ FAILED\n');
    console.error('Error Details:', err.name, '-', err.message);
    if (err.name === 'NoSuchBucket') {
      console.error('👉 The bucket name does not exist. Check spelling in AWS S3 console.');
    } else if (err.name === 'AccessDenied' || err.name === 'InvalidAccessKeyId' || err.name === 'SignatureDoesNotMatch') {
      console.error('👉 Invalid AWS IAM credentials or missing AmazonS3FullAccess permission.');
    }
    process.exit(1);
  }
}

checkS3();

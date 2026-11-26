import crypto from 'node:crypto';
import path from 'node:path';

const isProduction = process.env.NODE_ENV === 'production';

function developmentSecret(value: string | undefined): string {
  return value || (isProduction ? '' : crypto.randomBytes(32).toString('hex'));
}

export const env = {
  nodeEnv: process.env.NODE_ENV || 'development',
  isProduction,
  port: Number(process.env.PORT || (isProduction ? 3000 : 3001)),
  appUrl: process.env.APP_URL || (isProduction ? '' : 'http://localhost:3001'),
  sessionSecret: developmentSecret(process.env.SESSION_SECRET),
  csrfSecret: developmentSecret(process.env.CSRF_SECRET),
  signedUrlSecret: developmentSecret(process.env.SIGNED_URL_SECRET),
  paymentWebhookSecret: developmentSecret(process.env.PAYMENT_WEBHOOK_SECRET),
  mfaEncryptionKey: process.env.MFA_ENCRYPTION_KEY || '',
  paymentProvider: process.env.PAYMENT_PROVIDER || 'disabled',
  sessionTtlHours: Number(process.env.SESSION_TTL_HOURS || 24),
  cookieSecure: isProduction || process.env.COOKIE_SECURE === 'true',
  privateStorageDir: path.resolve(process.cwd(), process.env.PRIVATE_STORAGE_DIR || 'storage/private'),
  publicMediaDir: path.resolve(process.cwd(), process.env.PUBLIC_MEDIA_DIR || 'storage/public'),
  mediaStorageProvider: process.env.MEDIA_STORAGE_PROVIDER || (isProduction ? 's3' : 'local'),
  s3Endpoint: process.env.S3_ENDPOINT || '',
  s3Region: process.env.S3_REGION || 'us-east-1',
  s3Bucket: process.env.S3_BUCKET || '',
  s3AccessKeyId: process.env.S3_ACCESS_KEY_ID || '',
  s3SecretAccessKey: process.env.S3_SECRET_ACCESS_KEY || '',
  storyImageAllowedHosts: (process.env.STORY_IMAGE_ALLOWED_HOSTS ||
    'images.unsplash.com,images.pexels.com,cdn.pixabay.com')
    .split(',')
    .map((host) => host.trim().toLowerCase())
    .filter(Boolean),
  geminiApiKey: process.env.GEMINI_API_KEY || '',
};

export function validateProductionEnvironment(): void {
  if (!isProduction) return;

  if (!['local', 's3'].includes(env.mediaStorageProvider)) {
    throw new Error('MEDIA_STORAGE_PROVIDER must be either local or s3.');
  }

  const requiredSecrets: Array<[string, string]> = [
    ['SESSION_SECRET', env.sessionSecret],
    ['CSRF_SECRET', env.csrfSecret],
    ['SIGNED_URL_SECRET', env.signedUrlSecret],
  ];

  for (const [name, value] of requiredSecrets) {
    if (value.length < 32) {
      throw new Error(`Production requires ${name} to contain at least 32 characters.`);
    }

    let productionUrl: URL;
    try {
      productionUrl = new URL(env.appUrl);
    } catch {
      throw new Error('Production requires APP_URL to be a valid HTTPS origin.');
    }
    if (productionUrl.protocol !== 'https:') {
      throw new Error('Production requires APP_URL to use HTTPS.');
    }
  }

  if (!/^[a-fA-F0-9]{64}$/.test(env.mfaEncryptionKey)) {
    throw new Error('Production requires MFA_ENCRYPTION_KEY to be a 32-byte hexadecimal key.');
  }

  if (process.env.COOKIE_SECURE !== 'true') {
    throw new Error('COOKIE_SECURE=true is required in production.');
  }

  if (process.env.USE_MYSQL !== 'true' || !process.env.DATABASE_URL?.startsWith('mysql://')) {
    throw new Error('Production must use a configured MySQL DATABASE_URL.');
  }

  if (env.mediaStorageProvider !== 's3' || !env.s3Bucket) {
    throw new Error('Production requires MEDIA_STORAGE_PROVIDER=s3 and S3_BUCKET for durable story media.');
  }
  if (env.s3Endpoint && (!env.s3AccessKeyId || !env.s3SecretAccessKey)) {
    throw new Error('S3-compatible endpoints require S3_ACCESS_KEY_ID and S3_SECRET_ACCESS_KEY.');
  }
}

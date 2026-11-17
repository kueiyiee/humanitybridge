import crypto from 'node:crypto';
import path from 'node:path';

const isProduction = process.env.NODE_ENV === 'production';

function developmentSecret(value: string | undefined): string {
  return value || (isProduction ? '' : crypto.randomBytes(32).toString('hex'));
}

export const env = {
  nodeEnv: process.env.NODE_ENV || 'development',
  isProduction,
  port: Number(process.env.PORT || 3000),
  appUrl: process.env.APP_URL || 'http://localhost:3000',
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
  geminiApiKey: process.env.GEMINI_API_KEY || '',
};

export function validateProductionEnvironment(): void {
  if (!isProduction) return;

  const requiredSecrets: Array<[string, string]> = [
    ['SESSION_SECRET', env.sessionSecret],
    ['CSRF_SECRET', env.csrfSecret],
    ['SIGNED_URL_SECRET', env.signedUrlSecret],
  ];

  for (const [name, value] of requiredSecrets) {
    if (value.length < 32) {
      throw new Error(`Production requires ${name} to contain at least 32 characters.`);
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
}

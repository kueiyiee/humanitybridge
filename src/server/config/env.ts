import crypto from 'node:crypto';
import path from 'node:path';

function ephemeralDevSecret(label: string): string {
  return crypto
    .createHash('sha256')
    .update(`${label}:${process.cwd()}:humanitybridge-dev`)
    .digest('hex');
}

export const env = {
  nodeEnv: process.env.NODE_ENV || 'development',
  isProduction: process.env.NODE_ENV === 'production',
  port: Number(process.env.PORT || 3000),
  appUrl: process.env.APP_URL || 'http://localhost:3000',
  sessionSecret: process.env.SESSION_SECRET || ephemeralDevSecret('session'),
  csrfSecret: process.env.CSRF_SECRET || ephemeralDevSecret('csrf'),
  signedUrlSecret: process.env.SIGNED_URL_SECRET || ephemeralDevSecret('signed-url'),
  paymentWebhookSecret: process.env.PAYMENT_WEBHOOK_SECRET || ephemeralDevSecret('webhook'),
  sessionTtlHours: Number(process.env.SESSION_TTL_HOURS || 24),
  cookieSecure: process.env.COOKIE_SECURE === 'true',
  privateStorageDir: path.resolve(process.cwd(), process.env.PRIVATE_STORAGE_DIR || 'storage/private'),
  publicMediaDir: path.resolve(process.cwd(), process.env.PUBLIC_MEDIA_DIR || 'storage/public'),
  geminiApiKey: process.env.GEMINI_API_KEY || '',
};

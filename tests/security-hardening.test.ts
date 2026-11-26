import test from 'node:test';
import { hasValidMagicSignature } from '../src/server/utils/fileValidation';
import assert from 'node:assert/strict';
import {
  decryptMfaSecret,
  encryptMfaSecret,
  MfaSecretAuthenticationError,
  signHmac,
  verifyHmac,
} from '../src/server/utils/crypto';

process.env.MFA_ENCRYPTION_KEY = '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';

test('MFA secret encryption round-trips and uses a versioned envelope', () => {
  const secret = 'JBSWY3DPEHPK3PXP';
  const encrypted = encryptMfaSecret(secret);

  assert.match(encrypted, /^v1:/);
  assert.notEqual(encrypted, secret);
  assert.equal(decryptMfaSecret(encrypted), secret);
});

test('MFA secret encryption uses a fresh nonce', () => {
  const secret = 'JBSWY3DPEHPK3PXP';
  assert.notEqual(encryptMfaSecret(secret), encryptMfaSecret(secret));
});

test('tampered MFA ciphertext is rejected', () => {
  const encrypted = encryptMfaSecret('JBSWY3DPEHPK3PXP');
  const parts = encrypted.split(':');
  parts[3] = `${parts[3].slice(0, -2)}00`;
  assert.throws(() => decryptMfaSecret(parts.join(':')), MfaSecretAuthenticationError);
});

test('MFA secrets encrypted with a different key fail with an actionable error', () => {
  const encrypted = encryptMfaSecret('JBSWY3DPEHPK3PXP');
  const originalKey = process.env.MFA_ENCRYPTION_KEY;
  process.env.MFA_ENCRYPTION_KEY = 'abcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789';

  try {
    assert.throws(() => decryptMfaSecret(encrypted), MfaSecretAuthenticationError);
  } finally {
    process.env.MFA_ENCRYPTION_KEY = originalKey;
  }
});

test('HMAC verification rejects modified payloads', () => {
  const secret = 'test-webhook-secret';
  const signature = signHmac('original-payload', secret);
  assert.equal(verifyHmac('original-payload', signature, secret), true);
  assert.equal(verifyHmac('modified-payload', signature, secret), false);
});

test('file signatures validate the complete WebP container marker', () => {
  const webp = Buffer.from('524946462400000057454250', 'hex');
  const wav = Buffer.from('524946462400000057415645', 'hex');
  assert.equal(hasValidMagicSignature(webp, 'image/webp'), true);
  assert.equal(hasValidMagicSignature(wav, 'image/webp'), false);
});

test('file signature validation rejects short and mismatched content', () => {
  assert.equal(hasValidMagicSignature(Buffer.from([0xff, 0xd8]), 'image/jpeg'), false);
  assert.equal(hasValidMagicSignature(Buffer.from('%PDF-1.7'), 'image/jpeg'), false);
  assert.equal(hasValidMagicSignature(Buffer.from('%PDF-1.7'), 'application/pdf'), true);
});

test('JPEG and PNG signatures require their complete file markers', () => {
  const jpeg = Buffer.from('ffd8ffe000', 'hex');
  const png = Buffer.from('89504e470d0a1a0a', 'hex');
  const truncatedPng = Buffer.from('89504e47', 'hex');
  assert.equal(hasValidMagicSignature(jpeg, 'image/jpeg'), true);
  assert.equal(hasValidMagicSignature(png, 'image/png'), true);
  assert.equal(hasValidMagicSignature(truncatedPng, 'image/png'), false);
});

test('AVIF uploads require the ISO base media file type marker', () => {
  const avif = Buffer.from('000000186674797061766966', 'hex');
  const nonAvif = Buffer.from('00000018667479706d69736f', 'hex');
  assert.equal(hasValidMagicSignature(avif, 'image/avif'), true);
  assert.equal(hasValidMagicSignature(nonAvif, 'image/avif'), false);
});

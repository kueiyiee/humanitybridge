import test from 'node:test';
import assert from 'node:assert/strict';
import {
  decryptMfaSecret,
  encryptMfaSecret,
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
  assert.throws(() => decryptMfaSecret(parts.join(':')));
});

test('HMAC verification rejects modified payloads', () => {
  const secret = 'test-webhook-secret';
  const signature = signHmac('original-payload', secret);
  assert.equal(verifyHmac('original-payload', signature, secret), true);
  assert.equal(verifyHmac('modified-payload', signature, secret), false);
});

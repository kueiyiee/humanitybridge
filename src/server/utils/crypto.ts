import crypto from 'node:crypto';
import { argon2id } from '@noble/hashes/argon2.js';
import { bytesToHex, hexToBytes, utf8ToBytes } from '@noble/hashes/utils.js';

const ARGON_PARAMS = {
  t: 3,
  m: 16384,
  p: 1,
  dkLen: 32,
};

export function hashPasswordArgon2id(password: string): string {
  const salt = crypto.randomBytes(16);
  const derived = argon2id(utf8ToBytes(password), salt, ARGON_PARAMS);
  const saltB64 = Buffer.from(salt).toString('base64');
  const hashB64 = Buffer.from(derived).toString('base64');
  return `$argon2id$v=19$m=${ARGON_PARAMS.m},t=${ARGON_PARAMS.t},p=${ARGON_PARAMS.p}$${saltB64}$${hashB64}`;
}

export function verifyPasswordArgon2id(password: string, encodedHash: string): boolean {
  try {
    const parts = encodedHash.split('$');
    if (parts.length !== 6 || parts[1] !== 'argon2id') return false;
    const paramPairs = Object.fromEntries(
      parts[3].split(',').map((kv) => {
        const [k, v] = kv.split('=');
        return [k, Number(v)];
      }),
    );
    const salt = new Uint8Array(Buffer.from(parts[4], 'base64'));
    const expected = new Uint8Array(Buffer.from(parts[5], 'base64'));
    const derived = argon2id(utf8ToBytes(password), salt, {
      m: paramPairs.m || ARGON_PARAMS.m,
      t: paramPairs.t || ARGON_PARAMS.t,
      p: paramPairs.p || ARGON_PARAMS.p,
      dkLen: expected.length,
    });
    if (derived.length !== expected.length) return false;
    return crypto.timingSafeEqual(derived, expected);
  } catch {
    return false;
  }
}

export function generateRandomToken(byteLength = 32): string {
  return crypto.randomBytes(byteLength).toString('hex');
}

export function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

export function signHmac(payload: string, secret: string): string {
  return crypto.createHmac('sha256', secret).update(payload).digest('hex');
}

export function verifyHmac(payload: string, signatureHex: string, secret: string): boolean {
  try {
    const expectedHex = signHmac(payload, secret);
    const a = hexToBytes(expectedHex);
    const b = hexToBytes(signatureHex);
    if (a.length !== b.length) return false;
    return crypto.timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

// Base32 RFC 4648 for TOTP secrets
const BASE32_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

export function generateTotpSecret(): string {
  const bytes = crypto.randomBytes(20);
  let output = '';
  let buffer = 0;
  let bitsLeft = 0;
  for (const byte of bytes) {
    buffer = (buffer << 8) | byte;
    bitsLeft += 8;
    while (bitsLeft >= 5) {
      output += BASE32_ALPHABET[(buffer >> (bitsLeft - 5)) & 31];
      bitsLeft -= 5;
    }
  }
  if (bitsLeft > 0) {
    output += BASE32_ALPHABET[(buffer << (5 - bitsLeft)) & 31];
  }
  return output;
}

function decodeBase32(base32: string): Buffer {
  const clean = base32.toUpperCase().replace(/[^A-Z2-7]/g, '');
  let buffer = 0;
  let bitsLeft = 0;
  const out: number[] = [];
  for (const ch of clean) {
    const val = BASE32_ALPHABET.indexOf(ch);
    if (val === -1) continue;
    buffer = (buffer << 5) | val;
    bitsLeft += 5;
    if (bitsLeft >= 8) {
      out.push((buffer >> (bitsLeft - 8)) & 0xff);
      bitsLeft -= 8;
    }
  }
  return Buffer.from(out);
}

export function generateTotpCode(secret: string, timeStepOffset = 0): string {
  const key = decodeBase32(secret);
  const counter = Math.floor(Date.now() / 1000 / 30) + timeStepOffset;
  const msg = Buffer.alloc(8);
  msg.writeBigUInt64BE(BigInt(counter));
  const hmac = crypto.createHmac('sha1', key).update(msg).digest();
  const offset = hmac[hmac.length - 1] & 0x0f;
  const binary =
    ((hmac[offset] & 0x7f) << 24) |
    ((hmac[offset + 1] & 0xff) << 16) |
    ((hmac[offset + 2] & 0xff) << 8) |
    (hmac[offset + 3] & 0xff);
  return String(binary % 1000000).padStart(6, '0');
}

export function verifyTotpCode(secret: string, code: string): boolean {
  const clean = code.trim();
  if (!/^\d{6}$/.test(clean)) return false;
  for (let offset = -1; offset <= 1; offset++) {
    const expected = generateTotpCode(secret, offset);
    if (crypto.timingSafeEqual(Buffer.from(clean), Buffer.from(expected))) {
      return true;
    }
  }
  return false;
}

export function generateReferenceCode(prefix: string): string {
  const year = new Date().getUTCFullYear();
  const rand = bytesToHex(crypto.randomBytes(3)).toUpperCase();
  return `${prefix}-${year}-${rand}`;
}

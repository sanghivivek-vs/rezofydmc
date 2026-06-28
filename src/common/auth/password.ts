/**
 * Password hashing using Node's built-in scrypt (no native dependencies).
 *
 * Format: `scrypt$N$<saltHex>$<hashHex>`. Verification is constant-time. Keeping
 * this in `common` lets the Identity module hash/verify without pulling in bcrypt
 * (which needs native compilation).
 */

import { randomBytes, scryptSync, timingSafeEqual } from 'crypto';

const KEYLEN = 64;
const SALT_BYTES = 16;
const COST = 16384; // scrypt N

export function hashPassword(plain: string): string {
  if (!plain || plain.length < 8) {
    throw new Error('Password must be at least 8 characters');
  }
  const salt = randomBytes(SALT_BYTES);
  const derived = scryptSync(plain, salt, KEYLEN, { N: COST });
  return `scrypt$${COST}$${salt.toString('hex')}$${derived.toString('hex')}`;
}

export function verifyPassword(plain: string, stored: string): boolean {
  const parts = stored.split('$');
  if (parts.length !== 4 || parts[0] !== 'scrypt') return false;
  const cost = Number(parts[1]);
  const salt = Buffer.from(parts[2], 'hex');
  const expected = Buffer.from(parts[3], 'hex');
  if (!Number.isInteger(cost) || salt.length === 0 || expected.length === 0) return false;
  const derived = scryptSync(plain, salt, expected.length, { N: cost });
  return derived.length === expected.length && timingSafeEqual(derived, expected);
}

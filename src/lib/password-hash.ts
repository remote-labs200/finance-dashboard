/**
 * Password hashing for local auth fallback.
 *
 * Uses SHA-256 with an email-based salt for deterministic verification.
 * Primary authentication is via Supabase Auth. This is a fallback for:
 * - Offline scenarios (no network connectivity)
 * - Supabase service outages
 * - Local-only mode (Supabase not configured)
 *
 * NOTE: SHA-256 is not ideal for password storage (bcrypt/argon2 preferred),
 * but is a pragmatic choice given the available primitives in expo-crypto.
 * The threat model is: protect against casual local storage inspection,
 * not against brute-force attacks on a leaked database.
 */

import * as Crypto from 'expo-crypto';

const HASH_ALGORITHM = Crypto.CryptoDigestAlgorithm.SHA256;

/**
 * Hash a password using email as a salt.
 * The salt ensures two users with the same password have different hashes.
 */
export async function hashPassword(email: string, password: string): Promise<string> {
  const salt = email.toLowerCase().trim();
  return Crypto.digestStringAsync(HASH_ALGORITHM, `${salt}:${password}`);
}

/**
 * Verify a password against a stored hash.
 */
export async function verifyPassword(
  email: string,
  password: string,
  storedHash: string,
): Promise<boolean> {
  if (!storedHash) return false;
  const hash = await hashPassword(email, password);
  return hash === storedHash;
}

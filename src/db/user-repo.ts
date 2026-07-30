import * as Crypto from 'expo-crypto';
import * as SQLite from 'expo-sqlite';

import { LocalUser } from './schema';

// Simple ID generator using expo-crypto (UUID-like)
export function generateId(): string {
  return Crypto.randomUUID();
}

/**
 * Create a local user reference record AFTER Supabase Auth has succeeded.
 * This links the Supabase-authenticated user to local SQLite data.
 * Stores a password hash for offline/local auth fallback.
 */
export async function createUser(
  db: SQLite.SQLiteDatabase,
  email: string,
  supabaseUid?: string,
  passwordHash?: string,
): Promise<LocalUser> {
  const id = supabaseUid ?? generateId();
  const now = new Date().toISOString();
  const hash = passwordHash ?? '';

  const user: LocalUser = {
    id,
    email,
    passwordHash: hash,
    createdAt: now,
    updatedAt: now,
  };

  await db.runAsync(
    'INSERT INTO users (id, email, password_hash, created_at, updated_at) VALUES (?, ?, ?, ?, ?)',
    id,
    email,
    hash,
    now,
    now
  );

  return user;
}

/**
 * Find a local user reference by email (synced from Supabase Auth).
 */
export async function findUserByEmail(
  db: SQLite.SQLiteDatabase,
  email: string
): Promise<LocalUser | null> {
  const result = await db.getFirstAsync<LocalUser>(
    'SELECT id, email, password_hash as passwordHash, created_at as createdAt, updated_at as updatedAt FROM users WHERE email = ?',
    email
  );

  if (!result) return null;
  return result;
}

/**
 * Find a local user reference by ID (matches Supabase Auth UID).
 */
export async function findUserById(
  db: SQLite.SQLiteDatabase,
  id: string
): Promise<LocalUser | null> {
  const result = await db.getFirstAsync<LocalUser>(
    'SELECT id, email, password_hash as passwordHash, created_at as createdAt, updated_at as updatedAt FROM users WHERE id = ?',
    id
  );

  if (!result) return null;
  return result;
}

/**
 * Update the password hash for a local user (for offline auth).
 */
export async function updatePasswordHash(
  db: SQLite.SQLiteDatabase,
  userId: string,
  passwordHash: string,
): Promise<void> {
  const now = new Date().toISOString();
  await db.runAsync(
    'UPDATE users SET password_hash = ?, updated_at = ? WHERE id = ?',
    passwordHash,
    now,
    userId
  );
}

/**
 * Find any user record (for recovery when stored tokens are lost
 * but the SQLite database is intact).
 */
export async function findFirstUser(
  db: SQLite.SQLiteDatabase,
): Promise<LocalUser | null> {
  const result = await db.getFirstAsync<LocalUser>(
    'SELECT id, email, password_hash as passwordHash, created_at as createdAt, updated_at as updatedAt FROM users LIMIT 1'
  );
  return result ?? null;
}
export async function updateUserEmail(
  db: SQLite.SQLiteDatabase,
  userId: string,
  newEmail: string
): Promise<void> {
  const now = new Date().toISOString();
  await db.runAsync(
    'UPDATE users SET email = ?, updated_at = ? WHERE id = ?',
    newEmail,
    now,
    userId
  );
}

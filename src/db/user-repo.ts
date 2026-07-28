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
 */
export async function createUser(
  db: SQLite.SQLiteDatabase,
  email: string,
  supabaseUid?: string
): Promise<LocalUser> {
  const id = supabaseUid ?? generateId();
  const now = new Date().toISOString();

  const user: LocalUser = {
    id,
    email,
    passwordHash: '', // Not used — Supabase Auth handles passwords
    createdAt: now,
    updatedAt: now,
  };

  await db.runAsync(
    'INSERT INTO users (id, email, password_hash, created_at, updated_at) VALUES (?, ?, ?, ?, ?)',
    id,
    email,
    '',
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
 * Update the email on the local user reference (syncs from Supabase Auth).
 */
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

import * as Crypto from 'expo-crypto';
import * as SQLite from 'expo-sqlite';

import { LocalUser } from './schema';

// Simple ID generator using expo-crypto (UUID-like)
export function generateId(): string {
  return Crypto.randomUUID();
}

// Password hashing - using simple SHA256 for now (use scrypt/bcrypt in production)
export async function hashPassword(password: string): Promise<string> {
  const digest = await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, password);
  return digest;
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  const inputHash = await hashPassword(password);
  return inputHash === hash;
}

export async function createUser(
  db: SQLite.SQLiteDatabase,
  email: string,
  passwordHash: string
): Promise<LocalUser> {
  const id = generateId();
  const now = new Date().toISOString();

  const user: LocalUser = {
    id,
    email,
    passwordHash,
    createdAt: now,
    updatedAt: now,
  };

  await db.runAsync(
    'INSERT INTO users (id, email, password_hash, created_at, updated_at) VALUES (?, ?, ?, ?, ?)',
    id,
    email,
    passwordHash,
    now,
    now
  );

  return user;
}

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

export async function updateUserPassword(
  db: SQLite.SQLiteDatabase,
  userId: string,
  newPasswordHash: string
): Promise<void> {
  const now = new Date().toISOString();
  await db.runAsync(
    'UPDATE users SET password_hash = ?, updated_at = ? WHERE id = ?',
    newPasswordHash,
    now,
    userId
  );
}
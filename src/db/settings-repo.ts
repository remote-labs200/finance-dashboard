/**
 * Settings Repository
 *
 * Cloud-first key-value store for per-device app settings
 * (bank connections) and integrations (payment gateways / accounting
 * platforms). Mirrors `public.app_settings` and
 * `public.integrations_settings` on Supabase.
 *
 * Pattern matches preferences-repo.ts: write to Supabase first (source of
 * truth, offline-queued), then cache to local SQLite.
 */

import * as SQLite from "expo-sqlite";
import { cloudDelete, cloudUpsert } from "./cloud-writer";

export type AppSettingsTable = "app_settings" | "integrations_settings";

const TABLES: Record<string, string> = {
  bank_connections: "app_settings",
  integrations: "integrations_settings",
};

function tableFor(key: string): AppSettingsTable {
  if (key.startsWith("bank_")) return "app_settings";
  return "integrations_settings";
}

/**
 * Read all settings for a user from one table, keyed by `key`.
 */
export async function getAllSettings(
  db: SQLite.SQLiteDatabase,
  table: AppSettingsTable,
  userId: string,
): Promise<Record<string, string>> {
  const rows = await db.getAllAsync<{ key: string; value: string | null }>(
    `SELECT key, value FROM ${table} WHERE user_id = ?`,
    userId,
  );
  const out: Record<string, string> = {};
  for (const row of rows) {
    if (row.value !== null) out[row.key] = row.value;
  }
  return out;
}

/**
 * Get a single setting value, or null when unset.
 */
export async function getSetting(
  db: SQLite.SQLiteDatabase,
  table: AppSettingsTable,
  userId: string,
  key: string,
): Promise<string | null> {
  const row = await db.getFirstAsync<{ value: string | null }>(
    `SELECT value FROM ${table} WHERE user_id = ? AND key = ?`,
    userId,
    key,
  );
  return row?.value ?? null;
}

/**
 * Write a setting: cloud-first, then local cache.
 */
export async function setSetting(
  db: SQLite.SQLiteDatabase,
  table: AppSettingsTable,
  userId: string,
  key: string,
  value: string,
): Promise<void> {
  const now = new Date().toISOString();

  await cloudUpsert(
    db,
    table,
    `${userId}_${key}`,
    {
      id: `${userId}_${key}`,
      user_id: userId,
      key,
      value,
      updated_at: now,
    },
    "id",
  );

  await db.runAsync(
    `INSERT OR REPLACE INTO ${table} (id, user_id, key, value, updated_at)
     VALUES (?, ?, ?, ?, ?)`,
    `${userId}_${key}`,
    userId,
    key,
    value,
    now,
  );
}

/**
 * Remove a setting (cloud-first, then local cache).
 */
export async function deleteSetting(
  db: SQLite.SQLiteDatabase,
  table: AppSettingsTable,
  userId: string,
  key: string,
): Promise<void> {
  const id = `${userId}_${key}`;

  try {
    await cloudDelete(db, table, id);
  } catch (err) {
    console.warn("Failed to delete setting from cloud:", err);
  }

  await db.runAsync(
    `DELETE FROM ${table} WHERE user_id = ? AND key = ?`,
    userId,
    key,
  );
}

// Convenience wrappers for the two concrete tables
export const bankSettings = {
  getAll: (db: SQLite.SQLiteDatabase, userId: string) =>
    getAllSettings(db, "app_settings", userId),
  get: (db: SQLite.SQLiteDatabase, userId: string, key: string) =>
    getSetting(db, "app_settings", userId, key),
  set: (
    db: SQLite.SQLiteDatabase,
    userId: string,
    key: string,
    value: string,
  ) => setSetting(db, "app_settings", userId, key, value),
  remove: (db: SQLite.SQLiteDatabase, userId: string, key: string) =>
    deleteSetting(db, "app_settings", userId, key),
};

export const integrationSettings = {
  getAll: (db: SQLite.SQLiteDatabase, userId: string) =>
    getAllSettings(db, "integrations_settings", userId),
  get: (db: SQLite.SQLiteDatabase, userId: string, key: string) =>
    getSetting(db, "integrations_settings", userId, key),
  set: (
    db: SQLite.SQLiteDatabase,
    userId: string,
    key: string,
    value: string,
  ) => setSetting(db, "integrations_settings", userId, key, value),
  remove: (db: SQLite.SQLiteDatabase, userId: string, key: string) =>
    deleteSetting(db, "integrations_settings", userId, key),
};

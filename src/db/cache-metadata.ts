/**
 * Cache metadata — tracks how fresh the local SQLite cache is
 * relative to the Supabase source of truth.
 *
 * Each table in the local cache has a `last_synced_at` timestamp
 * so we know when to pull fresh data from Supabase.
 */

import * as SQLite from 'expo-sqlite';

const CACHE_META_TABLE = `
  CREATE TABLE IF NOT EXISTS cache_metadata (
    table_name TEXT PRIMARY KEY NOT NULL,
    last_synced_at TEXT NOT NULL
  )
`;

export async function initCacheMetadata(db: SQLite.SQLiteDatabase): Promise<void> {
  await db.execAsync(CACHE_META_TABLE);
}

export async function getLastSyncedAt(
  db: SQLite.SQLiteDatabase,
  tableName: string
): Promise<string | null> {
  const row = await db.getFirstAsync<{ last_synced_at: string | null }>(
    'SELECT last_synced_at FROM cache_metadata WHERE table_name = ?',
    tableName
  );
  return row?.last_synced_at ?? null;
}

export async function setLastSyncedAt(
  db: SQLite.SQLiteDatabase,
  tableName: string
): Promise<void> {
  const now = new Date().toISOString();
  await db.runAsync(
    'INSERT OR REPLACE INTO cache_metadata (table_name, last_synced_at) VALUES (?, ?)',
    tableName,
    now
  );
}

/**
 * Clear all sync metadata (e.g. on full resync).
 */
export async function clearAllCacheMetadata(db: SQLite.SQLiteDatabase): Promise<void> {
  await db.runAsync('DELETE FROM cache_metadata');
}

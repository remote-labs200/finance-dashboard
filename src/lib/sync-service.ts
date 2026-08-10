/**
 * Sync Service
 *
 * Handles cloud-first synchronization with Supabase as source of truth.
 * SQLite is the local cache for instant reads and offline support.
 *
 * Flow:
 * 1. Writes go to Supabase first (source of truth), then cache to SQLite
 * 2. If offline, writes go to SQLite and are queued in sync_log
 * 3. On connectivity, queue is flushed to Supabase
 * 4. Full pull refreshes the entire SQLite cache from Supabase
 * 5. refreshFromCloud nukes the local cache and re-pulls from cloud (used on sign-in)
 */

import * as SQLite from "expo-sqlite";
import { supabase } from "./supabase";

// --- Types ---

export type SyncOperation = "upsert" | "delete";
export type SyncStatus = "pending" | "syncing" | "synced" | "error";

export interface SyncLogEntry {
  id: string;
  entity: string;
  entityId: string;
  operation: SyncOperation;
  status: SyncStatus;
  version: number;
  data?: string; // JSON-serialized payload
  errorMessage?: string;
  createdAt: string;
  syncedAt?: string;
}

export interface SyncResult {
  pushed: number;
  pulled: number;
  conflicts: number;
  errors: string[];
}

// --- Sync Log CRUD ---

const SYNC_LOG_TABLE = `
  CREATE TABLE IF NOT EXISTS sync_log (
    id TEXT PRIMARY KEY NOT NULL,
    entity TEXT NOT NULL,
    entity_id TEXT NOT NULL,
    operation TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending',
    version INTEGER NOT NULL DEFAULT 1,
    data TEXT,
    error_message TEXT,
    created_at TEXT NOT NULL,
    synced_at TEXT
  )
`;

const SYNC_LOG_INDEX = `
  CREATE INDEX IF NOT EXISTS idx_sync_log_status ON sync_log(status)
`;

export async function initSyncLog(db: SQLite.SQLiteDatabase): Promise<void> {
  await db.execAsync(SYNC_LOG_TABLE);
  await db.execAsync(SYNC_LOG_INDEX);
}

export async function queueSync(
  db: SQLite.SQLiteDatabase,
  entity: string,
  entityId: string,
  operation: SyncOperation,
  data?: Record<string, unknown>,
): Promise<void> {
  const id = `sync_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
  const now = new Date().toISOString();

  // Get current version
  const existing = await db.getFirstAsync<{ version: number }>(
    "SELECT version FROM sync_log WHERE entity = ? AND entity_id = ? ORDER BY version DESC LIMIT 1",
    entity,
    entityId,
  );
  const version = (existing?.version ?? 0) + 1;

  await db.runAsync(
    `INSERT INTO sync_log (id, entity, entity_id, operation, status, version, data, created_at)
     VALUES (?, ?, ?, ?, 'pending', ?, ?, ?)`,
    id,
    entity,
    entityId,
    operation,
    version,
    data ? JSON.stringify(data) : null,
    now,
  );
}

export async function getPendingSyncEntries(
  db: SQLite.SQLiteDatabase,
  limit: number = 50,
): Promise<SyncLogEntry[]> {
  const rows = await db.getAllAsync<{
    id: string;
    entity: string;
    entity_id: string;
    operation: string;
    status: string;
    version: number;
    data: string | null;
    error_message: string | null;
    created_at: string;
    synced_at: string | null;
  }>(
    `SELECT * FROM sync_log WHERE status = 'pending' ORDER BY created_at ASC LIMIT ?`,
    limit,
  );

  return rows.map((row) => ({
    id: row.id,
    entity: row.entity,
    entityId: row.entity_id,
    operation: row.operation as SyncOperation,
    status: row.status as SyncStatus,
    version: row.version,
    data: row.data ?? undefined,
    errorMessage: row.error_message ?? undefined,
    createdAt: row.created_at,
    syncedAt: row.synced_at ?? undefined,
  }));
}

export async function markSynced(
  db: SQLite.SQLiteDatabase,
  syncId: string,
): Promise<void> {
  await db.runAsync(
    `UPDATE sync_log SET status = 'synced', synced_at = ? WHERE id = ?`,
    new Date().toISOString(),
    syncId,
  );
}

export async function markSyncError(
  db: SQLite.SQLiteDatabase,
  syncId: string,
  error: string,
): Promise<void> {
  await db.runAsync(
    `UPDATE sync_log SET status = 'error', error_message = ? WHERE id = ?`,
    error,
    syncId,
  );
}

// --- Push to Supabase ---

export async function pushToSupabase(
  db: SQLite.SQLiteDatabase,
): Promise<SyncResult> {
  const result: SyncResult = { pushed: 0, pulled: 0, conflicts: 0, errors: [] };

  if (!supabase) {
    result.errors.push("Supabase not configured");
    return result;
  }

  const pending = await getPendingSyncEntries(db, 50);

  for (const entry of pending) {
    try {
      if (entry.operation === "delete") {
        const { error } = await supabase
          .from(entry.entity)
          .delete()
          .eq("id", entry.entityId);

        if (error) throw error;
      } else {
        const data = entry.data ? JSON.parse(entry.data) : {};
        const { error } = await supabase
          .from(entry.entity)
          .upsert({ id: entry.entityId, ...data }, { onConflict: "id" });

        if (error) throw error;
      }

      await markSynced(db, entry.id);
      result.pushed++;
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      await markSyncError(db, entry.id, errorMsg);
      result.errors.push(errorMsg);
    }
  }

  return result;
}

// --- Pull from Supabase ---

export async function pullFromSupabase(
  db: SQLite.SQLiteDatabase,
  table: string,
  lastSyncedAt?: string,
): Promise<number> {
  if (!supabase) return 0;

  let query = supabase.from(table).select("*");

  if (lastSyncedAt) {
    query = query.gt("updated_at", lastSyncedAt);
  }

  const { data, error } = await query;

  if (error || !data) return 0;

  let count = 0;
  for (const row of data) {
    // Upsert into local SQLite
    const columns = Object.keys(row);
    const placeholders = columns.map(() => "?").join(", ");
    const values: SQLite.SQLiteBindValue[] = columns.map(
      (col) => (row as Record<string, unknown>)[col] as SQLite.SQLiteBindValue,
    );

    await db.runAsync(
      `INSERT OR REPLACE INTO ${table} (${columns.join(", ")}) VALUES (${placeholders})`,
      ...values,
    );
    count++;
  }

  return count;
}

// --- Full Sync ---

const SYNC_TABLES = [
  "accounts",
  "categories",
  "clients",
  "transactions",
  "tax_settings",
  "user_preferences",
  "mileage_entries",
  "app_settings",
  "integrations_settings",
];

/**
 * Perform a standard full sync:
 * 1. Pull latest from Supabase first (source of truth refreshes the local cache)
 * 2. Push any offline-queued changes to Supabase
 *
 * The pull-first order ensures cloud data is authoritative — local offline
 * changes are still sent to cloud, but the initial pull guarantees the cache
 * reflects the latest cloud state before any merge occurs.
 *
 * Call this periodically while the app is foregrounded.
 */
export async function performFullSync(
  db: SQLite.SQLiteDatabase,
): Promise<SyncResult> {
  const result: SyncResult = { pushed: 0, pulled: 0, conflicts: 0, errors: [] };

  // Step 1: Pull remote changes (cloud is authoritative)
  for (const table of SYNC_TABLES) {
    try {
      const count = await pullFromSupabase(db, table);
      result.pulled += count;
    } catch (err) {
      result.errors.push(
        `Pull ${table}: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }

  // Step 2: Push local offline-queued changes
  const pushResult = await pushToSupabase(db);
  result.pushed = pushResult.pushed;
  result.errors.push(...pushResult.errors);

  return result;
}

/**
 * Nuclear refresh — clears the entire local cache and re-pulls everything
 * from Supabase. Designed specifically for the sign-in flow when a user
 * authenticates after local data has been cleared or is stale.
 *
 * Should NOT be used for routine background sync (use performFullSync instead).
 */
export async function refreshFromCloud(
  db: SQLite.SQLiteDatabase,
): Promise<SyncResult> {
  const result: SyncResult = { pushed: 0, pulled: 0, conflicts: 0, errors: [] };

  if (!supabase) {
    result.errors.push("Supabase not configured");
    return result;
  }

  // Wipe the local cache so we start clean
  for (const table of SYNC_TABLES) {
    try {
      await db.runAsync(`DELETE FROM ${table}`);
    } catch (err) {
      result.errors.push(
        `Clear ${table}: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }
  try {
    await db.runAsync("DELETE FROM cache_metadata");
  } catch {
    /* ignore — table may not exist */
  }

  // Re-pull everything from Supabase
  for (const table of SYNC_TABLES) {
    try {
      const count = await pullFromSupabase(db, table);
      result.pulled += count;
    } catch (err) {
      result.errors.push(
        `Pull ${table}: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }

  return result;
}

// --- Sync State Helpers ---

/**
 * Returns the most recent successful sync timestamp across all sync_log
 * entries, or null if nothing has ever synced successfully.
 */
export async function getLastSyncedAt(
  db: SQLite.SQLiteDatabase,
): Promise<string | null> {
  const row = await db.getFirstAsync<{ synced_at: string | null }>(
    `SELECT synced_at FROM sync_log
     WHERE status = 'synced' AND synced_at IS NOT NULL
     ORDER BY synced_at DESC LIMIT 1`,
  );
  return row?.synced_at ?? null;
}

// --- Connection Status ---

export async function checkSupabaseConnection(): Promise<boolean> {
  if (!supabase) return false;

  try {
    const { error } = await supabase.from("users").select("id").limit(1);
    return !error;
  } catch {
    return false;
  }
}

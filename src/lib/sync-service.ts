/**
 * Sync Service
 *
 * Handles offline-first synchronization with Supabase.
 * Implements a queue-based sync with conflict resolution (last-write-wins).
 *
 * Flow:
 * 1. Local changes are written to SQLite immediately
 * 2. Changes are queued in a sync_log table
 * 3. On connectivity, queue is flushed to Supabase
 * 4. Remote changes are pulled and merged
 */

import * as SQLite from 'expo-sqlite';
import { supabase } from './supabase';

// --- Types ---

export type SyncOperation = 'upsert' | 'delete';
export type SyncStatus = 'pending' | 'syncing' | 'synced' | 'error';

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
  data?: Record<string, unknown>
): Promise<void> {
  const id = `sync_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
  const now = new Date().toISOString();

  // Get current version
  const existing = await db.getFirstAsync<{ version: number }>(
    'SELECT version FROM sync_log WHERE entity = ? AND entity_id = ? ORDER BY version DESC LIMIT 1',
    entity,
    entityId
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
    now
  );
}

export async function getPendingSyncEntries(
  db: SQLite.SQLiteDatabase,
  limit: number = 50
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
    limit
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
  syncId: string
): Promise<void> {
  await db.runAsync(
    `UPDATE sync_log SET status = 'synced', synced_at = ? WHERE id = ?`,
    new Date().toISOString(),
    syncId
  );
}

export async function markSyncError(
  db: SQLite.SQLiteDatabase,
  syncId: string,
  error: string
): Promise<void> {
  await db.runAsync(
    `UPDATE sync_log SET status = 'error', error_message = ? WHERE id = ?`,
    error,
    syncId
  );
}

// --- Push to Supabase ---

export async function pushToSupabase(
  db: SQLite.SQLiteDatabase
): Promise<SyncResult> {
  const result: SyncResult = { pushed: 0, pulled: 0, conflicts: 0, errors: [] };

  if (!supabase) {
    result.errors.push('Supabase not configured');
    return result;
  }

  const pending = await getPendingSyncEntries(db, 50);

  for (const entry of pending) {
    try {
      if (entry.operation === 'delete') {
        const { error } = await supabase
          .from(entry.entity)
          .delete()
          .eq('id', entry.entityId);

        if (error) throw error;
      } else {
        const data = entry.data ? JSON.parse(entry.data) : {};
        const { error } = await supabase
          .from(entry.entity)
          .upsert({ id: entry.entityId, ...data }, { onConflict: 'id' });

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
  lastSyncedAt?: string
): Promise<number> {
  if (!supabase) return 0;

  let query = supabase.from(table).select('*');

  if (lastSyncedAt) {
    query = query.gt('updated_at', lastSyncedAt);
  }

  const { data, error } = await query;

  if (error || !data) return 0;

  let count = 0;
  for (const row of data) {
    // Upsert into local SQLite
    const columns = Object.keys(row);
    const placeholders = columns.map(() => '?').join(', ');
    const values: SQLite.SQLiteBindValue[] = columns.map((col) => (row as Record<string, unknown>)[col] as SQLite.SQLiteBindValue);

    await db.runAsync(
      `INSERT OR REPLACE INTO ${table} (${columns.join(', ')}) VALUES (${placeholders})`,
      ...values
    );
    count++;
  }

  return count;
}

// --- Full Sync ---

const SYNC_TABLES = ['accounts', 'categories', 'transactions', 'tax_settings'];

export async function performFullSync(
  db: SQLite.SQLiteDatabase
): Promise<SyncResult> {
  const result: SyncResult = { pushed: 0, pulled: 0, conflicts: 0, errors: [] };

  // Step 1: Push local changes
  const pushResult = await pushToSupabase(db);
  result.pushed = pushResult.pushed;
  result.errors.push(...pushResult.errors);

  // Step 2: Pull remote changes
  for (const table of SYNC_TABLES) {
    try {
      const count = await pullFromSupabase(db, table);
      result.pulled += count;
    } catch (err) {
      result.errors.push(`Pull ${table}: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  return result;
}

// --- Connection Status ---

export async function checkSupabaseConnection(): Promise<boolean> {
  if (!supabase) return false;

  try {
    const { error } = await supabase.from('users').select('id').limit(1);
    return !error;
  } catch {
    return false;
  }
}

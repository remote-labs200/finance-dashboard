/**
 * Cloud write helper with offline queue fallback.
 *
 * Every data write goes to Supabase first (source of truth).
 * If the network is unavailable, we queue the operation for later
 * and still write to the local SQLite cache so the UI remains responsive.
 */

import * as SQLite from 'expo-sqlite';
import { supabase } from '@/lib/supabase';
import { queueSync } from '@/lib/sync-service';
import { isNetworkError } from './network-utils';

export type CloudWriteResult = 'written' | 'queued';

/**
 * Write (insert or update) a record to Supabase.
 * Falls back to an offline queue when the network is down.
 */
export async function cloudUpsert(
  db: SQLite.SQLiteDatabase,
  table: string,
  id: string,
  data: Record<string, unknown>
): Promise<CloudWriteResult> {
  if (!supabase) {
    // Local-only mode: Supabase isn't configured, so SQLite is the only store.
    // Let the caller persist locally instead of failing the whole write.
    return 'written';
  }

  try {
    const { error } = await supabase
      .from(table)
      .upsert({ id, ...data }, { onConflict: 'id' });

    if (error) {
      if (isNetworkError(error)) {
        await queueSync(db, table, id, 'upsert', data);
        return 'queued';
      }
      throw error;
    }
    return 'written';
  } catch (err) {
    if (isNetworkError(err)) {
      await queueSync(db, table, id, 'upsert', data);
      return 'queued';
    }
    throw err;
  }
}

/**
 * Delete a record from Supabase.
 * Falls back to an offline queue when the network is down.
 */
export async function cloudDelete(
  db: SQLite.SQLiteDatabase,
  table: string,
  id: string
): Promise<CloudWriteResult> {
  if (!supabase) {
    // Local-only mode: Supabase isn't configured, so SQLite is the only store.
    // Let the caller persist locally instead of failing the whole write.
    return 'written';
  }

  try {
    const { error } = await supabase.from(table).delete().eq('id', id);
    if (error) {
      if (isNetworkError(error)) {
        await queueSync(db, table, id, 'delete');
        return 'queued';
      }
      throw error;
    }
    return 'written';
  } catch (err) {
    if (isNetworkError(err)) {
      await queueSync(db, table, id, 'delete');
      return 'queued';
    }
    throw err;
  }
}

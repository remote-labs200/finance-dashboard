import * as SQLite from 'expo-sqlite';
import { cloudUpsert } from './cloud-writer';
import { supabase } from '@/lib/supabase';
import { isNetworkError } from './network-utils';
import { queueSync } from '@/lib/sync-service';

export type UserPreferenceKey =
  | 'filing_status'
  | 'state'
  | 'tax_year'
  | 'default_currency'
  | 'notifications_enabled';

const PREFERENCE_DEFAULTS: Record<UserPreferenceKey, string> = {
  filing_status: 'single',
  state: '',
  tax_year: String(new Date().getFullYear()),
  default_currency: 'USD',
  notifications_enabled: 'true',
};

export async function getPreference(
  db: SQLite.SQLiteDatabase,
  userId: string,
  key: UserPreferenceKey
): Promise<string> {
  const row = await db.getFirstAsync<{ value: string | null }>(
    'SELECT value FROM user_preferences WHERE user_id = ? AND key = ?',
    userId,
    key
  );
  return row?.value ?? PREFERENCE_DEFAULTS[key];
}

export async function setPreference(
  db: SQLite.SQLiteDatabase,
  userId: string,
  key: UserPreferenceKey,
  value: string
): Promise<void> {
  const now = new Date().toISOString();

  // Write to Supabase first (source of truth)
  // Preferences use composite key (user_id, key) — Supabase table mirrors this
  await cloudUpsert(db, 'user_preferences', `${userId}_${key}`, {
    user_id: userId,
    key,
    value,
    updated_at: now,
  });

  // Cache to local SQLite
  await db.runAsync(
    `INSERT OR REPLACE INTO user_preferences (user_id, key, value, updated_at)
     VALUES (?, ?, ?, ?)`,
    userId,
    key,
    value,
    now
  );
}

export async function getAllPreferences(
  db: SQLite.SQLiteDatabase,
  userId: string
): Promise<Record<string, string>> {
  const rows = await db.getAllAsync<{ key: string; value: string | null }>(
    'SELECT key, value FROM user_preferences WHERE user_id = ?',
    userId
  );

  const prefs: Record<string, string> = { ...PREFERENCE_DEFAULTS };
  for (const row of rows) {
    if (row.value !== null) {
      prefs[row.key] = row.value;
    }
  }
  return prefs;
}

export async function deletePreference(
  db: SQLite.SQLiteDatabase,
  userId: string,
  key: UserPreferenceKey
): Promise<void> {
  // Delete from Supabase first (source of truth)
  // user_preferences uses composite key, not id — delete via filter
  if (supabase) {
    try {
      const { error } = await supabase
        .from('user_preferences')
        .delete()
        .eq('user_id', userId)
        .eq('key', key);

      if (error) {
        if (isNetworkError(error)) {
          await queueSync(db, 'user_preferences', `${userId}_${key}`, 'delete');
        } else {
          throw error;
        }
      }
    } catch (err) {
      if (!isNetworkError(err)) throw err;
      await queueSync(db, 'user_preferences', `${userId}_${key}`, 'delete');
    }
  }

  // Remove from local SQLite cache
  await db.runAsync(
    'DELETE FROM user_preferences WHERE user_id = ? AND key = ?',
    userId,
    key
  );
}

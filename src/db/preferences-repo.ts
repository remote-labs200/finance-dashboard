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
  | 'notifications_enabled'
  // Profile fields
  | 'profile_first_name'
  | 'profile_last_name'
  | 'profile_business_phone'
  // Business information
  | 'business_legal_name'
  | 'business_structure'
  | 'business_ein'
  | 'business_address_line1'
  | 'business_address_line2'
  | 'business_city'
  | 'business_state'
  | 'business_zip'
  // Tax profile
  | 'tax_filing_status'
  | 'tax_entity_type'
  | 'tax_locale'
  // Accounting year
  | 'fy_start_month'
  | 'fy_start_day'
  | 'fy_type';

const PREFERENCE_DEFAULTS: Record<UserPreferenceKey, string> = {
  filing_status: 'single',
  state: '',
  tax_year: String(new Date().getFullYear()),
  default_currency: 'USD',
  notifications_enabled: 'true',
  profile_first_name: '',
  profile_last_name: '',
  profile_business_phone: '',
  business_legal_name: '',
  business_structure: 'sole_prop',
  business_ein: '',
  business_address_line1: '',
  business_address_line2: '',
  business_city: '',
  business_state: '',
  business_zip: '',
  tax_filing_status: 'single',
  tax_entity_type: 'sole_prop',
  tax_locale: 'US',
  fy_start_month: '1',
  fy_start_day: '1',
  fy_type: 'calendar',
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

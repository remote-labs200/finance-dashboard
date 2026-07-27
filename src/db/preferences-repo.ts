import * as SQLite from 'expo-sqlite';

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
  await db.runAsync(
    'DELETE FROM user_preferences WHERE user_id = ? AND key = ?',
    userId,
    key
  );
}

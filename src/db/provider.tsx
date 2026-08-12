import { SQLiteProvider, type SQLiteDatabase } from 'expo-sqlite';
import { type ReactNode } from 'react';

import { MIGRATIONS } from './schema';

export { useSQLiteContext } from 'expo-sqlite';

export function DatabaseProvider({ children }: { children: ReactNode }) {
  return (
    <SQLiteProvider
      databaseName="finance.db"
      onInit={migrateDatabase}
      onError={(error) => {
        console.error('SQLite migration error:', error);
      }}>
      {children}
    </SQLiteProvider>
  );
}

async function migrateDatabase(db: SQLiteDatabase) {
  for (const migration of MIGRATIONS) {
    await db.execAsync(migration);
  }
  // Legacy installs created the transactions table with NOT NULL on
  // account_id/category_id (matching the original Supabase schema).
  // That prevented saving transactions without an account/category
  // (FK violation on the cloud, and a NOT NULL error locally). The
  // cloud ALTER migration handled the server side; this rebuilds the
  // local table so existing installs accept NULL FKs too.
  await rebuildLegacyTransactionsTable(db);
  // Add columns to existing tables created before the current schema.
  await ensureColumn(
    db,
    "categories",
    "is_deductible",
    "INTEGER NOT NULL DEFAULT 1",
  );
}

/**
 * Add a column to an existing table if it is missing.
 * Table/column names are internal constants (never user input).
 */
async function ensureColumn(
  db: SQLiteDatabase,
  table: string,
  column: string,
  definition: string,
): Promise<void> {
  const row = await db.getFirstAsync<{ count: number }>(
    `SELECT COUNT(*) as count FROM pragma_table_info('${table}') WHERE name = ?`,
    column,
  );
  if (!row || row.count === 0) {
    await db.execAsync(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
  }
}

async function rebuildLegacyTransactionsTable(db: SQLiteDatabase) {
  const row = await db.getFirstAsync<{ not_null: number }>(
    `SELECT COUNT(*) as not_null
     FROM pragma_table_info('transactions')
     WHERE name IN ('account_id', 'category_id') AND "notnull" = 1`,
  );
  // Fresh installs already run the new (nullable) CREATE TABLE — skip.
  if (!row || row.not_null === 0) return;

  await db.withExclusiveTransactionAsync(async (txn) => {
    // Preserve any locally-cached rows so the rebuild is lossless.
    // (foreign_keys is never enabled in this app, so the DROP order is safe.)
    await txn.execAsync(`
      CREATE TABLE transactions_legacy AS SELECT * FROM transactions;
      DROP TABLE transactions;
      CREATE TABLE transactions (
        id TEXT PRIMARY KEY NOT NULL,
        user_id TEXT NOT NULL,
        account_id TEXT,
        category_id TEXT,
        amount_cents INTEGER NOT NULL,
        currency_code TEXT NOT NULL,
        note TEXT,
        client_id TEXT REFERENCES clients(id) ON DELETE SET NULL,
        date TEXT NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
      INSERT INTO transactions (id, user_id, account_id, category_id, amount_cents, currency_code, note, client_id, date, created_at, updated_at)
        SELECT id, user_id, account_id, category_id, amount_cents, currency_code, note, client_id, date, created_at, updated_at
        FROM transactions_legacy;
      DROP TABLE transactions_legacy;
    `);
  });
  // Recreate indexes that were dropped with the old table.
  await db.execAsync(`
    CREATE INDEX IF NOT EXISTS idx_transactions_user_id ON transactions(user_id);
    CREATE INDEX IF NOT EXISTS idx_transactions_account_id ON transactions(account_id);
    CREATE INDEX IF NOT EXISTS idx_transactions_date ON transactions(date);
    CREATE INDEX IF NOT EXISTS idx_transactions_client_id ON transactions(client_id);
  `);
}

export type { SQLiteDatabase } from 'expo-sqlite';

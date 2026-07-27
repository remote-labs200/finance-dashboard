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
}

export type { SQLiteDatabase } from 'expo-sqlite';

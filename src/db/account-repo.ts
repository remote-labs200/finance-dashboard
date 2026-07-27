import * as SQLite from 'expo-sqlite';
import { Account } from './schema';
import { generateId } from './user-repo';

export async function createAccount(
  db: SQLite.SQLiteDatabase,
  data: Omit<Account, 'id' | 'createdAt' | 'updatedAt'>
): Promise<Account> {
  const id = generateId();
  const now = new Date().toISOString();

  const account: Account = {
    id,
    ...data,
    createdAt: now,
    updatedAt: now,
  };

  await db.runAsync(
    `INSERT INTO accounts (id, user_id, name, type, balance_cents, currency_code, color, is_hidden, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    id,
    data.userId,
    data.name,
    data.type,
    data.balanceCents,
    data.currencyCode,
    data.color ?? null,
    data.isHidden ? 1 : 0,
    now,
    now
  );

  return account;
}

export async function findAccountsByUser(
  db: SQLite.SQLiteDatabase,
  userId: string
): Promise<Account[]> {
  const results = await db.getAllAsync<{
    id: string;
    user_id: string;
    name: string;
    type: string;
    balance_cents: number;
    currency_code: string;
    color: string | null;
    is_hidden: number;
    created_at: string;
    updated_at: string;
  }>(
    'SELECT * FROM accounts WHERE user_id = ? AND is_hidden = 0 ORDER BY created_at ASC',
    userId
  );

  return results.map((row) => ({
    id: row.id,
    userId: row.user_id,
    name: row.name,
    type: row.type as Account['type'],
    balanceCents: row.balance_cents,
    currencyCode: row.currency_code,
    color: row.color ?? undefined,
    isHidden: row.is_hidden === 1,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }));
}

export async function findAccountById(
  db: SQLite.SQLiteDatabase,
  id: string
): Promise<Account | null> {
  const row = await db.getFirstAsync<{
    id: string;
    user_id: string;
    name: string;
    type: string;
    balance_cents: number;
    currency_code: string;
    color: string | null;
    is_hidden: number;
    created_at: string;
    updated_at: string;
  }>('SELECT * FROM accounts WHERE id = ?', id);

  if (!row) return null;

  return {
    id: row.id,
    userId: row.user_id,
    name: row.name,
    type: row.type as Account['type'],
    balanceCents: row.balance_cents,
    currencyCode: row.currency_code,
    color: row.color ?? undefined,
    isHidden: row.is_hidden === 1,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function updateAccount(
  db: SQLite.SQLiteDatabase,
  id: string,
  data: Partial<Omit<Account, 'id' | 'createdAt' | 'updatedAt'>>
): Promise<void> {
  const now = new Date().toISOString();
  const fields: string[] = [];
  const values: any[] = [];

  if (data.name !== undefined) {
    fields.push('name = ?');
    values.push(data.name);
  }
  if (data.type !== undefined) {
    fields.push('type = ?');
    values.push(data.type);
  }
  if (data.balanceCents !== undefined) {
    fields.push('balance_cents = ?');
    values.push(data.balanceCents);
  }
  if (data.currencyCode !== undefined) {
    fields.push('currency_code = ?');
    values.push(data.currencyCode);
  }
  if (data.color !== undefined) {
    fields.push('color = ?');
    values.push(data.color ?? null);
  }
  if (data.isHidden !== undefined) {
    fields.push('is_hidden = ?');
    values.push(data.isHidden ? 1 : 0);
  }

  fields.push('updated_at = ?');
  values.push(now);
  values.push(id);

  await db.runAsync(`UPDATE accounts SET ${fields.join(', ')} WHERE id = ?`, ...values);
}

export async function deleteAccount(
  db: SQLite.SQLiteDatabase,
  id: string
): Promise<void> {
  await db.runAsync('DELETE FROM accounts WHERE id = ?', id);
}

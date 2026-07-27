import * as SQLite from 'expo-sqlite';
import { Transaction } from './schema';
import { generateId } from './user-repo';

export interface TransactionRow {
  id: string;
  user_id: string;
  account_id: string;
  category_id: string;
  amount_cents: number;
  currency_code: string;
  note: string | null;
  date: string;
  created_at: string;
  updated_at: string;
  account_name?: string;
  category_name?: string;
}

function rowToTransaction(row: TransactionRow): Transaction {
  return {
    id: row.id,
    userId: row.user_id,
    accountId: row.account_id,
    categoryId: row.category_id,
    amountCents: row.amount_cents,
    currencyCode: row.currency_code,
    note: row.note ?? undefined,
    date: row.date,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    accountName: row.account_name,
    categoryName: row.category_name,
  };
}

const TXN_WITH_NAMES = `
  SELECT t.*, a.name as account_name, c.name as category_name
  FROM transactions t
  LEFT JOIN accounts a ON t.account_id = a.id
  LEFT JOIN categories c ON t.category_id = c.id
`;

export async function createTransaction(
  db: SQLite.SQLiteDatabase,
  data: Omit<Transaction, 'id' | 'createdAt' | 'updatedAt' | 'accountName' | 'categoryName'>
): Promise<Transaction> {
  const id = generateId();
  const now = new Date().toISOString();

  const txn: Transaction = {
    id,
    ...data,
    createdAt: now,
    updatedAt: now,
  };

  await db.runAsync(
    `INSERT INTO transactions (id, user_id, account_id, category_id, amount_cents, currency_code, note, date, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    id,
    data.userId,
    data.accountId,
    data.categoryId,
    data.amountCents,
    data.currencyCode,
    data.note ?? null,
    data.date,
    now,
    now
  );

  return txn;
}

export async function findTransactionsByUser(
  db: SQLite.SQLiteDatabase,
  userId: string,
  options?: {
    limit?: number;
    offset?: number;
    accountId?: string;
    categoryId?: string;
    startDate?: string;
    endDate?: string;
    type?: 'income' | 'expense';
  }
): Promise<Transaction[]> {
  let query = `${TXN_WITH_NAMES} WHERE t.user_id = ?`;
  const params: any[] = [userId];

  if (options?.accountId) {
    query += ' AND t.account_id = ?';
    params.push(options.accountId);
  }
  if (options?.categoryId) {
    query += ' AND t.category_id = ?';
    params.push(options.categoryId);
  }
  if (options?.startDate) {
    query += ' AND t.date >= ?';
    params.push(options.startDate);
  }
  if (options?.endDate) {
    query += ' AND t.date <= ?';
    params.push(options.endDate);
  }
  if (options?.type === 'income') {
    query += ' AND t.amount_cents > 0';
  } else if (options?.type === 'expense') {
    query += ' AND t.amount_cents < 0';
  }

  query += ' ORDER BY t.date DESC, t.created_at DESC';

  if (options?.limit) {
    query += ` LIMIT ${options.limit}`;
  }
  if (options?.offset) {
    query += ` OFFSET ${options.offset}`;
  }

  const results = await db.getAllAsync<TransactionRow>(query, ...params);
  return results.map(rowToTransaction);
}

export async function findTransactionById(
  db: SQLite.SQLiteDatabase,
  id: string
): Promise<Transaction | null> {
  const row = await db.getFirstAsync<TransactionRow>(
    `${TXN_WITH_NAMES} WHERE t.id = ?`,
    id
  );
  if (!row) return null;
  return rowToTransaction(row);
}

export async function updateTransaction(
  db: SQLite.SQLiteDatabase,
  id: string,
  data: Partial<Omit<Transaction, 'id' | 'createdAt' | 'updatedAt' | 'accountName' | 'categoryName'>>
): Promise<void> {
  const now = new Date().toISOString();
  const fields: string[] = [];
  const values: any[] = [];

  if (data.accountId !== undefined) {
    fields.push('account_id = ?');
    values.push(data.accountId);
  }
  if (data.categoryId !== undefined) {
    fields.push('category_id = ?');
    values.push(data.categoryId);
  }
  if (data.amountCents !== undefined) {
    fields.push('amount_cents = ?');
    values.push(data.amountCents);
  }
  if (data.currencyCode !== undefined) {
    fields.push('currency_code = ?');
    values.push(data.currencyCode);
  }
  if (data.note !== undefined) {
    fields.push('note = ?');
    values.push(data.note ?? null);
  }
  if (data.date !== undefined) {
    fields.push('date = ?');
    values.push(data.date);
  }

  fields.push('updated_at = ?');
  values.push(now);
  values.push(id);

  await db.runAsync(`UPDATE transactions SET ${fields.join(', ')} WHERE id = ?`, ...values);
}

export async function deleteTransaction(
  db: SQLite.SQLiteDatabase,
  id: string
): Promise<void> {
  await db.runAsync('DELETE FROM transactions WHERE id = ?', id);
}

// Aggregation queries for dashboard
export async function getMonthlySummary(
  db: SQLite.SQLiteDatabase,
  userId: string,
  year: number,
  month: number
): Promise<{ totalIncome: number; totalExpenses: number; net: number }> {
  const monthStr = String(month).padStart(2, '0');
  const startDate = `${year}-${monthStr}-01`;
  const endDate = `${year}-${monthStr}-31`;

  const result = await db.getFirstAsync<{ totalIncome: number; totalExpenses: number }>(
    `SELECT
       COALESCE(SUM(CASE WHEN amount_cents > 0 THEN amount_cents ELSE 0 END), 0) as totalIncome,
       COALESCE(SUM(CASE WHEN amount_cents < 0 THEN ABS(amount_cents) ELSE 0 END), 0) as totalExpenses
     FROM transactions
     WHERE user_id = ? AND date >= ? AND date <= ?`,
    userId,
    startDate,
    endDate
  );

  return {
    totalIncome: result?.totalIncome ?? 0,
    totalExpenses: result?.totalExpenses ?? 0,
    net: (result?.totalIncome ?? 0) - (result?.totalExpenses ?? 0),
  };
}

export async function getYearToDateSummary(
  db: SQLite.SQLiteDatabase,
  userId: string,
  year: number
): Promise<{ totalIncome: number; totalExpenses: number; net: number }> {
  const result = await db.getFirstAsync<{ totalIncome: number; totalExpenses: number }>(
    `SELECT
       COALESCE(SUM(CASE WHEN amount_cents > 0 THEN amount_cents ELSE 0 END), 0) as totalIncome,
       COALESCE(SUM(CASE WHEN amount_cents < 0 THEN ABS(amount_cents) ELSE 0 END), 0) as totalExpenses
     FROM transactions
     WHERE user_id = ? AND date >= ? AND date <= ?`,
    userId,
    `${year}-01-01`,
    `${year}-12-31`
  );

  return {
    totalIncome: result?.totalIncome ?? 0,
    totalExpenses: result?.totalExpenses ?? 0,
    net: (result?.totalIncome ?? 0) - (result?.totalExpenses ?? 0),
  };
}

export async function getMonthlyTotals(
  db: SQLite.SQLiteDatabase,
  userId: string,
  year: number
): Promise<Array<{ month: number; income: number; expenses: number; net: number }>> {
  const results = await db.getAllAsync<{ month: number; income: number; expenses: number }>(
    `SELECT
       CAST(SUBSTR(date, 6, 2) AS INTEGER) as month,
       COALESCE(SUM(CASE WHEN amount_cents > 0 THEN amount_cents ELSE 0 END), 0) as income,
       COALESCE(SUM(CASE WHEN amount_cents < 0 THEN ABS(amount_cents) ELSE 0 END), 0) as expenses
     FROM transactions
     WHERE user_id = ? AND date >= ? AND date <= ?
     GROUP BY month
     ORDER BY month ASC`,
    userId,
    `${year}-01-01`,
    `${year}-12-31`
  );

  // Fill in missing months
  const allMonths = Array.from({ length: 12 }, (_, i) => i + 1);
  return allMonths.map((month) => {
    const found = results.find((r) => r.month === month);
    return {
      month,
      income: found?.income ?? 0,
      expenses: found?.expenses ?? 0,
      net: (found?.income ?? 0) - (found?.expenses ?? 0),
    };
  });
}

import * as SQLite from 'expo-sqlite';
import { TaxPayment } from './schema';
import { generateId } from './user-repo';
import { cloudUpsert, cloudDelete } from './cloud-writer';

function mapRow(row: {
  id: string;
  user_id: string;
  amount_cents: number;
  tax_year: number;
  quarter: number | null;
  payment_date: string;
  method: string | null;
  note: string | null;
  created_at: string;
  updated_at: string;
}): TaxPayment {
  return {
    id: row.id,
    userId: row.user_id,
    amountCents: row.amount_cents,
    taxYear: row.tax_year,
    quarter: row.quarter ?? undefined,
    paymentDate: row.payment_date,
    method: row.method ?? undefined,
    note: row.note ?? undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function createTaxPayment(
  db: SQLite.SQLiteDatabase,
  data: Omit<TaxPayment, 'id' | 'createdAt' | 'updatedAt'>,
): Promise<TaxPayment> {
  const id = generateId();
  const now = new Date().toISOString();

  const payment: TaxPayment = { id, ...data, createdAt: now, updatedAt: now };

  // Write to Supabase first (source of truth)
  await cloudUpsert(db, 'tax_payments', id, {
    user_id: data.userId,
    amount_cents: data.amountCents,
    tax_year: data.taxYear,
    quarter: data.quarter ?? null,
    payment_date: data.paymentDate,
    method: data.method ?? null,
    note: data.note ?? null,
    created_at: now,
    updated_at: now,
  });

  // Cache to local SQLite
  await db.runAsync(
    `INSERT INTO tax_payments (id, user_id, amount_cents, tax_year, quarter, payment_date, method, note, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    id,
    data.userId,
    data.amountCents,
    data.taxYear,
    data.quarter ?? null,
    data.paymentDate,
    data.method ?? null,
    data.note ?? null,
    now,
    now,
  );

  return payment;
}

export async function findTaxPaymentsByUser(
  db: SQLite.SQLiteDatabase,
  userId: string,
  taxYear?: number,
): Promise<TaxPayment[]> {
  let query = 'SELECT * FROM tax_payments WHERE user_id = ?';
  const params: any[] = [userId];

  if (taxYear !== undefined) {
    query += ' AND tax_year = ?';
    params.push(taxYear);
  }

  query += ' ORDER BY payment_date DESC, created_at DESC';

  const rows = await db.getAllAsync<{
    id: string;
    user_id: string;
    amount_cents: number;
    tax_year: number;
    quarter: number | null;
    payment_date: string;
    method: string | null;
    note: string | null;
    created_at: string;
    updated_at: string;
  }>(query, ...params);

  return rows.map(mapRow);
}

/** Total estimated-tax payments recorded for a given tax year, in cents. */
export async function getTaxYearPaidCents(
  db: SQLite.SQLiteDatabase,
  userId: string,
  taxYear: number,
): Promise<number> {
  const row = await db.getFirstAsync<{ total: number | null }>(
    `SELECT COALESCE(SUM(amount_cents), 0) as total
     FROM tax_payments
     WHERE user_id = ? AND tax_year = ?`,
    userId,
    taxYear,
  );
  return row?.total ?? 0;
}

export async function deleteTaxPayment(
  db: SQLite.SQLiteDatabase,
  id: string,
): Promise<void> {
  await cloudDelete(db, 'tax_payments', id);
  await db.runAsync('DELETE FROM tax_payments WHERE id = ?', id);
}

import * as SQLite from 'expo-sqlite';
import { Receipt } from './schema';
import { generateId } from './user-repo';
import { cloudUpsert, cloudDelete } from './cloud-writer';

function mapRow(row: {
  id: string;
  user_id: string;
  transaction_id: string | null;
  local_path: string | null;
  remote_url: string | null;
  merchant: string | null;
  amount_cents: number | null;
  date: string | null;
  ocr_raw: string | null;
  created_at: string;
  updated_at: string;
}): Receipt {
  return {
    id: row.id,
    userId: row.user_id,
    transactionId: row.transaction_id ?? undefined,
    localPath: row.local_path ?? undefined,
    remoteUrl: row.remote_url ?? undefined,
    merchant: row.merchant ?? undefined,
    amountCents: row.amount_cents ?? undefined,
    date: row.date ?? undefined,
    ocrRaw: row.ocr_raw ?? undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function createReceipt(
  db: SQLite.SQLiteDatabase,
  data: Omit<Receipt, 'id' | 'createdAt' | 'updatedAt'>,
): Promise<Receipt> {
  const id = generateId();
  const now = new Date().toISOString();

  const receipt: Receipt = { id, ...data, createdAt: now, updatedAt: now };

  // Write to Supabase first (source of truth)
  await cloudUpsert(db, 'receipts', id, {
    user_id: data.userId,
    transaction_id: data.transactionId ?? null,
    local_path: data.localPath ?? null,
    remote_url: data.remoteUrl ?? null,
    merchant: data.merchant ?? null,
    amount_cents: data.amountCents ?? null,
    date: data.date ?? null,
    ocr_raw: data.ocrRaw ?? null,
    created_at: now,
    updated_at: now,
  });

  // Cache to local SQLite
  await db.runAsync(
    `INSERT INTO receipts (id, user_id, transaction_id, local_path, remote_url, merchant, amount_cents, date, ocr_raw, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    id,
    data.userId,
    data.transactionId ?? null,
    data.localPath ?? null,
    data.remoteUrl ?? null,
    data.merchant ?? null,
    data.amountCents ?? null,
    data.date ?? null,
    data.ocrRaw ?? null,
    now,
    now,
  );

  return receipt;
}

export async function findReceiptByTransactionId(
  db: SQLite.SQLiteDatabase,
  transactionId: string,
): Promise<Receipt | null> {
  const row = await db.getFirstAsync<{
    id: string;
    user_id: string;
    transaction_id: string | null;
    local_path: string | null;
    remote_url: string | null;
    merchant: string | null;
    amount_cents: number | null;
    date: string | null;
    ocr_raw: string | null;
    created_at: string;
    updated_at: string;
  }>('SELECT * FROM receipts WHERE transaction_id = ? LIMIT 1', transactionId);

  if (!row) return null;
  return mapRow(row);
}

export async function findReceiptsByUser(
  db: SQLite.SQLiteDatabase,
  userId: string,
): Promise<Receipt[]> {
  const rows = await db.getAllAsync<{
    id: string;
    user_id: string;
    transaction_id: string | null;
    local_path: string | null;
    remote_url: string | null;
    merchant: string | null;
    amount_cents: number | null;
    date: string | null;
    ocr_raw: string | null;
    created_at: string;
    updated_at: string;
  }>('SELECT * FROM receipts WHERE user_id = ? ORDER BY created_at DESC', userId);

  return rows.map(mapRow);
}

export async function updateReceipt(
  db: SQLite.SQLiteDatabase,
  id: string,
  data: Partial<Omit<Receipt, 'id' | 'createdAt' | 'updatedAt'>>,
): Promise<void> {
  const now = new Date().toISOString();

  const cloudData: Record<string, unknown> = { updated_at: now };
  if (data.transactionId !== undefined)
    cloudData.transaction_id = data.transactionId ?? null;
  if (data.localPath !== undefined) cloudData.local_path = data.localPath ?? null;
  if (data.remoteUrl !== undefined) cloudData.remote_url = data.remoteUrl ?? null;
  if (data.merchant !== undefined) cloudData.merchant = data.merchant ?? null;
  if (data.amountCents !== undefined) cloudData.amount_cents = data.amountCents ?? null;
  if (data.date !== undefined) cloudData.date = data.date ?? null;
  if (data.ocrRaw !== undefined) cloudData.ocr_raw = data.ocrRaw ?? null;

  await cloudUpsert(db, 'receipts', id, cloudData);

  const fields: string[] = [];
  const values: any[] = [];

  if (data.transactionId !== undefined) {
    fields.push('transaction_id = ?');
    values.push(data.transactionId ?? null);
  }
  if (data.localPath !== undefined) {
    fields.push('local_path = ?');
    values.push(data.localPath ?? null);
  }
  if (data.remoteUrl !== undefined) {
    fields.push('remote_url = ?');
    values.push(data.remoteUrl ?? null);
  }
  if (data.merchant !== undefined) {
    fields.push('merchant = ?');
    values.push(data.merchant ?? null);
  }
  if (data.amountCents !== undefined) {
    fields.push('amount_cents = ?');
    values.push(data.amountCents ?? null);
  }
  if (data.date !== undefined) {
    fields.push('date = ?');
    values.push(data.date ?? null);
  }
  if (data.ocrRaw !== undefined) {
    fields.push('ocr_raw = ?');
    values.push(data.ocrRaw ?? null);
  }

  fields.push('updated_at = ?');
  values.push(now);
  values.push(id);

  await db.runAsync(
    `UPDATE receipts SET ${fields.join(', ')} WHERE id = ?`,
    ...values,
  );
}

export async function deleteReceipt(
  db: SQLite.SQLiteDatabase,
  id: string,
): Promise<void> {
  await cloudDelete(db, 'receipts', id);
  await db.runAsync('DELETE FROM receipts WHERE id = ?', id);
}

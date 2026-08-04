import * as SQLite from 'expo-sqlite';
import { Client } from './schema';
import { generateId } from './user-repo';
import { cloudUpsert, cloudDelete } from './cloud-writer';

export interface ClientRow {
  id: string;
  user_id: string;
  name: string;
  email: string | null;
  company: string | null;
  phone: string | null;
  notes: string | null;
  color: string | null;
  currency_code: string;
  created_at: string;
  updated_at: string;
}

function rowToClient(row: ClientRow): Client {
  return {
    id: row.id,
    userId: row.user_id,
    name: row.name,
    email: row.email ?? undefined,
    company: row.company ?? undefined,
    phone: row.phone ?? undefined,
    notes: row.notes ?? undefined,
    color: row.color ?? undefined,
    currencyCode: row.currency_code,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function createClient(
  db: SQLite.SQLiteDatabase,
  data: Omit<Client, 'id' | 'createdAt' | 'updatedAt'>
): Promise<Client> {
  const id = generateId();
  const now = new Date().toISOString();

  const client: Client = {
    id,
    ...data,
    createdAt: now,
    updatedAt: now,
  };

  // Write to Supabase first (source of truth)
  await cloudUpsert(db, 'clients', id, {
    user_id: data.userId,
    name: data.name,
    email: data.email ?? null,
    company: data.company ?? null,
    phone: data.phone ?? null,
    notes: data.notes ?? null,
    color: data.color ?? null,
    currency_code: data.currencyCode,
    created_at: now,
    updated_at: now,
  });

  // Cache to local SQLite
  await db.runAsync(
    `INSERT INTO clients (id, user_id, name, email, company, phone, notes, color, currency_code, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    id,
    data.userId,
    data.name,
    data.email ?? null,
    data.company ?? null,
    data.phone ?? null,
    data.notes ?? null,
    data.color ?? null,
    data.currencyCode,
    now,
    now
  );

  return client;
}

export async function findClientsByUser(
  db: SQLite.SQLiteDatabase,
  userId: string,
  options?: {
    search?: string;
    limit?: number;
    offset?: number;
  }
): Promise<Client[]> {
  let query = 'SELECT * FROM clients WHERE user_id = ?';
  const params: any[] = [userId];

  if (options?.search) {
    query += ' AND (name LIKE ? OR company LIKE ? OR email LIKE ?)';
    const like = `%${options.search}%`;
    params.push(like, like, like);
  }

  query += ' ORDER BY name COLLATE NOCASE ASC';

  if (options?.limit) {
    query += ` LIMIT ${options.limit}`;
  }
  if (options?.offset) {
    query += ` OFFSET ${options.offset}`;
  }

  const rows = await db.getAllAsync<ClientRow>(query, ...params);
  return rows.map(rowToClient);
}

export async function findClientById(
  db: SQLite.SQLiteDatabase,
  id: string
): Promise<Client | null> {
  const row = await db.getFirstAsync<ClientRow>(
    'SELECT * FROM clients WHERE id = ?',
    id
  );
  if (!row) return null;
  return rowToClient(row);
}

export async function updateClient(
  db: SQLite.SQLiteDatabase,
  id: string,
  data: Partial<Omit<Client, 'id' | 'createdAt' | 'updatedAt'>>
): Promise<void> {
  const now = new Date().toISOString();

  // Build payload for Supabase
  const cloudData: Record<string, unknown> = { updated_at: now };
  if (data.name !== undefined) cloudData.name = data.name;
  if (data.email !== undefined) cloudData.email = data.email ?? null;
  if (data.company !== undefined) cloudData.company = data.company ?? null;
  if (data.phone !== undefined) cloudData.phone = data.phone ?? null;
  if (data.notes !== undefined) cloudData.notes = data.notes ?? null;
  if (data.color !== undefined) cloudData.color = data.color ?? null;
  if (data.currencyCode !== undefined) cloudData.currency_code = data.currencyCode;

  // Write to Supabase first (source of truth)
  await cloudUpsert(db, 'clients', id, cloudData);

  // Cache to local SQLite
  const fields: string[] = [];
  const values: any[] = [];

  if (data.name !== undefined) {
    fields.push('name = ?');
    values.push(data.name);
  }
  if (data.email !== undefined) {
    fields.push('email = ?');
    values.push(data.email ?? null);
  }
  if (data.company !== undefined) {
    fields.push('company = ?');
    values.push(data.company ?? null);
  }
  if (data.phone !== undefined) {
    fields.push('phone = ?');
    values.push(data.phone ?? null);
  }
  if (data.notes !== undefined) {
    fields.push('notes = ?');
    values.push(data.notes ?? null);
  }
  if (data.color !== undefined) {
    fields.push('color = ?');
    values.push(data.color ?? null);
  }
  if (data.currencyCode !== undefined) {
    fields.push('currency_code = ?');
    values.push(data.currencyCode);
  }

  fields.push('updated_at = ?');
  values.push(now);
  values.push(id);

  await db.runAsync(`UPDATE clients SET ${fields.join(', ')} WHERE id = ?`, ...values);
}

export async function deleteClient(
  db: SQLite.SQLiteDatabase,
  id: string
): Promise<void> {
  // Unlink transactions first so they survive client deletion
  await db.runAsync('UPDATE transactions SET client_id = NULL WHERE client_id = ?', id);

  // Delete from Supabase first (source of truth)
  await cloudDelete(db, 'clients', id);

  // Remove from local SQLite cache
  await db.runAsync('DELETE FROM clients WHERE id = ?', id);
}

export interface ClientSummary {
  client: Client;
  totalIncomeCents: number;
  totalExpensesCents: number;
  netCents: number;
  transactionCount: number;
  lastTransactionDate: string | null;
  currencies: string[];
}

/**
 * Aggregate per-client financial summary from the local cache.
 */
export async function getClientSummaries(
  db: SQLite.SQLiteDatabase,
  userId: string,
  options?: { search?: string }
): Promise<ClientSummary[]> {
  const clients = await findClientsByUser(db, userId, options);

  const rows = await db.getAllAsync<{
    client_id: string;
    income: number;
    expenses: number;
    count: number;
    last_date: string | null;
    currencies: string;
  }>(
    `SELECT
       t.client_id,
       SUM(CASE WHEN t.amount_cents > 0 THEN t.amount_cents ELSE 0 END) as income,
       SUM(CASE WHEN t.amount_cents < 0 THEN ABS(t.amount_cents) ELSE 0 END) as expenses,
       COUNT(*) as count,
       MAX(t.date) as last_date,
       GROUP_CONCAT(DISTINCT t.currency_code) as currencies
     FROM transactions t
     WHERE t.user_id = ? AND t.client_id IS NOT NULL
     GROUP BY t.client_id`,
    userId
  );

  const byId = new Map(rows.map((r) => [r.client_id, r]));

  return clients.map((client) => {
    const agg = byId.get(client.id);
    return {
      client,
      totalIncomeCents: agg?.income ?? 0,
      totalExpensesCents: agg?.expenses ?? 0,
      netCents: (agg?.income ?? 0) - (agg?.expenses ?? 0),
      transactionCount: agg?.count ?? 0,
      lastTransactionDate: agg?.last_date ?? null,
      currencies: agg?.currencies?.split(',') ?? [client.currencyCode],
    };
  });
}

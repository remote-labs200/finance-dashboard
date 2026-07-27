import * as SQLite from 'expo-sqlite';
import { Category } from './schema';
import { generateId } from './user-repo';

export async function createCategory(
  db: SQLite.SQLiteDatabase,
  data: Omit<Category, 'id' | 'createdAt' | 'updatedAt'>
): Promise<Category> {
  const id = generateId();
  const now = new Date().toISOString();

  const category: Category = {
    id,
    ...data,
    createdAt: now,
    updatedAt: now,
  };

  await db.runAsync(
    `INSERT INTO categories (id, user_id, name, color, icon, is_income, is_hidden, sort_order, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    id,
    data.userId,
    data.name,
    data.color ?? null,
    data.icon ?? null,
    data.isIncome ? 1 : 0,
    data.isHidden ? 1 : 0,
    data.sortOrder,
    now,
    now
  );

  return category;
}

export async function findCategoriesByUser(
  db: SQLite.SQLiteDatabase,
  userId: string,
  kind?: 'income' | 'expense'
): Promise<Category[]> {
  let query = 'SELECT * FROM categories WHERE user_id = ? AND is_hidden = 0';
  const params: any[] = [userId];

  if (kind) {
    query += ' AND is_income = ?';
    params.push(kind === 'income' ? 1 : 0);
  }

  query += ' ORDER BY sort_order ASC, name ASC';

  const results = await db.getAllAsync<{
    id: string;
    user_id: string;
    name: string;
    color: string | null;
    icon: string | null;
    is_income: number;
    is_hidden: number;
    sort_order: number;
    created_at: string;
    updated_at: string;
  }>(query, ...params);

  return results.map((row) => ({
    id: row.id,
    userId: row.user_id,
    name: row.name,
    color: row.color ?? undefined,
    icon: row.icon ?? undefined,
    isIncome: row.is_income === 1,
    isHidden: row.is_hidden === 1,
    sortOrder: row.sort_order,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }));
}

export async function findCategoryById(
  db: SQLite.SQLiteDatabase,
  id: string
): Promise<Category | null> {
  const row = await db.getFirstAsync<{
    id: string;
    user_id: string;
    name: string;
    color: string | null;
    icon: string | null;
    is_income: number;
    is_hidden: number;
    sort_order: number;
    created_at: string;
    updated_at: string;
  }>('SELECT * FROM categories WHERE id = ?', id);

  if (!row) return null;

  return {
    id: row.id,
    userId: row.user_id,
    name: row.name,
    color: row.color ?? undefined,
    icon: row.icon ?? undefined,
    isIncome: row.is_income === 1,
    isHidden: row.is_hidden === 1,
    sortOrder: row.sort_order,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function updateCategory(
  db: SQLite.SQLiteDatabase,
  id: string,
  data: Partial<Omit<Category, 'id' | 'createdAt' | 'updatedAt'>>
): Promise<void> {
  const now = new Date().toISOString();
  const fields: string[] = [];
  const values: any[] = [];

  if (data.name !== undefined) {
    fields.push('name = ?');
    values.push(data.name);
  }
  if (data.color !== undefined) {
    fields.push('color = ?');
    values.push(data.color ?? null);
  }
  if (data.icon !== undefined) {
    fields.push('icon = ?');
    values.push(data.icon ?? null);
  }
  if (data.isIncome !== undefined) {
    fields.push('is_income = ?');
    values.push(data.isIncome ? 1 : 0);
  }
  if (data.isHidden !== undefined) {
    fields.push('is_hidden = ?');
    values.push(data.isHidden ? 1 : 0);
  }
  if (data.sortOrder !== undefined) {
    fields.push('sort_order = ?');
    values.push(data.sortOrder);
  }

  fields.push('updated_at = ?');
  values.push(now);
  values.push(id);

  await db.runAsync(`UPDATE categories SET ${fields.join(', ')} WHERE id = ?`, ...values);
}

export async function deleteCategory(
  db: SQLite.SQLiteDatabase,
  id: string
): Promise<void> {
  await db.runAsync('DELETE FROM categories WHERE id = ?', id);
}

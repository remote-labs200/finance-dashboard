import * as SQLite from 'expo-sqlite';
import { Category } from './schema';
import { generateId } from './user-repo';
import { cloudUpsert, cloudDelete } from './cloud-writer';

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

  // Write to Supabase first (source of truth)
  await cloudUpsert(db, 'categories', id, {
    user_id: data.userId,
    name: data.name,
    color: data.color ?? null,
    icon: data.icon ?? null,
    is_income: data.isIncome ? 1 : 0,
    is_deductible: data.isDeductible ? 1 : 0,
    is_hidden: data.isHidden ? 1 : 0,
    sort_order: data.sortOrder,
    created_at: now,
    updated_at: now,
  });

  // Cache to local SQLite
  await db.runAsync(
    `INSERT INTO categories (id, user_id, name, color, icon, is_income, is_deductible, is_hidden, sort_order, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    id,
    data.userId,
    data.name,
    data.color ?? null,
    data.icon ?? null,
    data.isIncome ? 1 : 0,
    data.isDeductible ? 1 : 0,
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
    is_deductible: number;
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
    isDeductible: row.is_deductible === 1,
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
    is_deductible: number;
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
    isDeductible: row.is_deductible === 1,
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

  // Build payload for Supabase
  const cloudData: Record<string, unknown> = { updated_at: now };
  if (data.name !== undefined) cloudData.name = data.name;
  if (data.color !== undefined) cloudData.color = data.color ?? null;
  if (data.icon !== undefined) cloudData.icon = data.icon ?? null;
  if (data.isIncome !== undefined) cloudData.is_income = data.isIncome ? 1 : 0;
  if (data.isDeductible !== undefined)
    cloudData.is_deductible = data.isDeductible ? 1 : 0;
  if (data.isHidden !== undefined) cloudData.is_hidden = data.isHidden ? 1 : 0;
  if (data.sortOrder !== undefined) cloudData.sort_order = data.sortOrder;

  // Write to Supabase first (source of truth)
  await cloudUpsert(db, 'categories', id, cloudData);

  // Cache to local SQLite
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
  if (data.isDeductible !== undefined) {
    fields.push('is_deductible = ?');
    values.push(data.isDeductible ? 1 : 0);
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
  // Delete from Supabase first (source of truth)
  await cloudDelete(db, 'categories', id);

  // Remove from local SQLite cache
  await db.runAsync('DELETE FROM categories WHERE id = ?', id);
}

// ──────────────────────────────────────────────
//  Default categories (seeded once per user)
// ──────────────────────────────────────────────

interface DefaultCategorySpec {
  name: string;
  isIncome: boolean;
  isDeductible: boolean;
  color: string;
}

const DEFAULT_CATEGORIES: DefaultCategorySpec[] = [
  // Expense categories (deductible by default)
  { name: 'Software & Subscriptions', isIncome: false, isDeductible: true, color: '#3c87f7' },
  { name: 'Rent & Utilities', isIncome: false, isDeductible: true, color: '#f59e0b' },
  { name: 'Office Supplies', isIncome: false, isDeductible: true, color: '#8b5cf6' },
  { name: 'Meals & Entertainment', isIncome: false, isDeductible: true, color: '#ec4899' },
  { name: 'Travel & Transport', isIncome: false, isDeductible: true, color: '#06b6d4' },
  { name: 'Equipment & Hardware', isIncome: false, isDeductible: true, color: '#f97316' },
  { name: 'Insurance', isIncome: false, isDeductible: true, color: '#22c55e' },
  { name: 'Marketing & Advertising', isIncome: false, isDeductible: true, color: '#ef4444' },
  { name: 'Contractors & Services', isIncome: false, isDeductible: true, color: '#6b7280' },
  { name: 'Business Fees & Licenses', isIncome: false, isDeductible: true, color: '#e11d48' },
  { name: 'Education & Training', isIncome: false, isDeductible: true, color: '#0ea5e9' },
  { name: 'Bank & Payment Fees', isIncome: false, isDeductible: true, color: '#64748b' },
  // Income categories
  { name: 'Client Payments', isIncome: true, isDeductible: false, color: '#22c55e' },
  { name: 'Consulting Income', isIncome: true, isDeductible: false, color: '#06b6d4' },
  { name: 'Product Sales', isIncome: true, isDeductible: false, color: '#8b5cf6' },
  { name: 'Other Income', isIncome: true, isDeductible: false, color: '#64748b' },
];

/**
 * Seed a sensible starter set of categories for a user who has none.
 * Cheap no-op when the user already has categories (checks a single count).
 * Cloud-first via createCategory, so offline installs still get seeded locally.
 */
export async function ensureDefaultCategories(
  db: SQLite.SQLiteDatabase,
  userId: string,
): Promise<void> {
  const row = await db.getFirstAsync<{ count: number }>(
    'SELECT COUNT(*) as count FROM categories WHERE user_id = ?',
    userId,
  );
  if (!row || row.count > 0) return;

  for (let i = 0; i < DEFAULT_CATEGORIES.length; i++) {
    const spec = DEFAULT_CATEGORIES[i];
    await createCategory(db, {
      userId,
      name: spec.name,
      color: spec.color,
      isIncome: spec.isIncome,
      isDeductible: spec.isDeductible,
      isHidden: false,
      sortOrder: i,
    });
  }
}

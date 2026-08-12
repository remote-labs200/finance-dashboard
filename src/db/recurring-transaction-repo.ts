import * as SQLite from "expo-sqlite";
import {
  RecurringTransaction,
  RecurringTransactionCreate,
} from "./schema";
import { generateId } from "./user-repo";
import { cloudUpsert, cloudDelete } from "./cloud-writer";
import { createTransaction } from "./transaction-repo";

function mapRow(row: {
  id: string;
  user_id: string;
  name: string;
  is_income: number;
  amount_cents: number;
  category_id: string | null;
  account_id: string | null;
  frequency: string;
  start_date: string;
  end_date: string | null;
  next_run_date: string;
  times_run: number;
  times_planned: number | null;
  created_at: string;
  updated_at: string;
}): RecurringTransaction {
  return {
    id: row.id,
    userId: row.user_id,
    name: row.name,
    isIncome: row.is_income === 1,
    amountCents: row.amount_cents,
    categoryId: row.category_id ?? undefined,
    accountId: row.account_id ?? undefined,
    frequency: row.frequency as RecurringTransaction["frequency"],
    startDate: row.start_date,
    endDate: row.end_date ?? undefined,
    nextRunDate: row.next_run_date,
    timesRun: row.times_run,
    timesPlanned: row.times_planned ?? undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function createRecurringTransaction(
  db: SQLite.SQLiteDatabase,
  data: Omit<RecurringTransaction, "id" | "createdAt" | "updatedAt" | "nextRunDate" | "timesRun">,
): Promise<RecurringTransaction> {
  const id = generateId();
  const now = new Date().toISOString();

  const recurring: RecurringTransaction = {
    id,
    ...data,
    nextRunDate: data.startDate,
    timesRun: 0,
    createdAt: now,
    updatedAt: now,
  };

  // Write to Supabase first (source of truth)
  await cloudUpsert(db, "recurring_transactions", id, {
    user_id: data.userId,
    name: data.name,
    is_income: data.isIncome ? 1 : 0,
    amount_cents: data.amountCents,
    category_id: data.categoryId ?? null,
    account_id: data.accountId ?? null,
    frequency: data.frequency,
    start_date: data.startDate,
    end_date: data.endDate ?? null,
    next_run_date: data.startDate,
    times_run: 0,
    times_planned: null,
    created_at: now,
    updated_at: now,
  });

  // Cache to local SQLite
  await db.runAsync(
    `INSERT INTO recurring_transactions (id, user_id, name, is_income, amount_cents, category_id, account_id, frequency, start_date, end_date, next_run_date, times_run, times_planned, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    id,
    data.userId,
    data.name,
    data.isIncome ? 1 : 0,
    data.amountCents,
    data.categoryId ?? null,
    data.accountId ?? null,
    data.frequency,
    data.startDate,
    data.endDate ?? null,
    data.startDate,
    0,
    null,
    now,
    now,
  );

  return recurring;
}

export async function findRecurringTransactions(
  db: SQLite.SQLiteDatabase,
  userId: string,
): Promise<RecurringTransaction[]> {
  const rows = await db.getAllAsync<{
    id: string;
    user_id: string;
    name: string;
    is_income: number;
    amount_cents: number;
    category_id: string | null;
    account_id: string | null;
    frequency: string;
    start_date: string;
    end_date: string | null;
    next_run_date: string;
    times_run: number;
    times_planned: number | null;
    created_at: string;
    updated_at: string;
  }>(
    "SELECT * FROM recurring_transactions WHERE user_id = ? ORDER BY start_date ASC",
    userId,
  );

  return rows.map(mapRow);
}

export async function updateRecurringTransaction(
  db: SQLite.SQLiteDatabase,
  id: string,
  data: Partial<
    Omit<RecurringTransaction, "id" | "createdAt" | "updatedAt">
  >,
): Promise<void> {
  const now = new Date().toISOString();

  const cloudData: Record<string, unknown> = { updated_at: now };
  if (data.name !== undefined) cloudData.name = data.name;
  if (data.isIncome !== undefined)
    cloudData.is_income = data.isIncome ? 1 : 0;
  if (data.amountCents !== undefined)
    cloudData.amount_cents = data.amountCents;
  if (data.categoryId !== undefined)
    cloudData.category_id = data.categoryId ?? null;
  if (data.accountId !== undefined)
    cloudData.account_id = data.accountId ?? null;
  if (data.frequency !== undefined) cloudData.frequency = data.frequency;
  if (data.startDate !== undefined) cloudData.start_date = data.startDate;
  if (data.endDate !== undefined) cloudData.end_date = data.endDate ?? null;
  if (data.nextRunDate !== undefined)
    cloudData.next_run_date = data.nextRunDate;
  if (data.timesRun !== undefined) cloudData.times_run = data.timesRun;
  if (data.timesPlanned !== undefined)
    cloudData.times_planned = data.timesPlanned;

  await cloudUpsert(db, "recurring_transactions", id, cloudData);

  const fields: string[] = [];
  const values: any[] = [];

  if (data.name !== undefined) {
    fields.push("name = ?");
    values.push(data.name);
  }
  if (data.isIncome !== undefined) {
    fields.push("is_income = ?");
    values.push(data.isIncome ? 1 : 0);
  }
  if (data.amountCents !== undefined) {
    fields.push("amount_cents = ?");
    values.push(data.amountCents);
  }
  if (data.categoryId !== undefined) {
    fields.push("category_id = ?");
    values.push(data.categoryId ?? null);
  }
  if (data.accountId !== undefined) {
    fields.push("account_id = ?");
    values.push(data.accountId ?? null);
  }
  if (data.frequency !== undefined) {
    fields.push("frequency = ?");
    values.push(data.frequency);
  }
  if (data.startDate !== undefined) {
    fields.push("start_date = ?");
    values.push(data.startDate);
  }
  if (data.endDate !== undefined) {
    fields.push("end_date = ?");
    values.push(data.endDate ?? null);
  }
  if (data.nextRunDate !== undefined) {
    fields.push("next_run_date = ?");
    values.push(data.nextRunDate);
  }
  if (data.timesRun !== undefined) {
    fields.push("times_run = ?");
    values.push(data.timesRun);
  }
  if (data.timesPlanned !== undefined) {
    fields.push("times_planned = ?");
    values.push(data.timesPlanned ?? null);
  }

  fields.push("updated_at = ?");
  values.push(now);
  values.push(id);

  await db.runAsync(
    `UPDATE recurring_transactions SET ${fields.join(", ")} WHERE id = ?`,
    ...values,
  );
}

export async function deleteRecurringTransaction(
  db: SQLite.SQLiteDatabase,
  id: string,
): Promise<void> {
  await cloudDelete(db, "recurring_transactions", id);
  await db.runAsync("DELETE FROM recurring_transactions WHERE id = ?", id);
}

/**
 * Compute the next occurrence date given a start date and frequency.
 * Returns an ISO date string (YYYY-MM-DD).
 */
function addInterval(
  start: Date,
  frequency: RecurringTransaction["frequency"],
): Date {
  const next = new Date(start);
  if (frequency === "weekly") {
    next.setDate(next.getDate() + 7);
  } else if (frequency === "monthly") {
    next.setMonth(next.getMonth() + 1);
  } else if (frequency === "quarterly") {
    next.setMonth(next.getMonth() + 3);
  } else if (frequency === "yearly") {
    next.setFullYear(next.getFullYear() + 1);
  }
  return next;
}

function toISODate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/**
 * Generate all due transactions for the user's recurring templates.
 *
 * Each template generates transactions for every occurrence that is due on
 * or before today (and not past the end date / times_planned limit).
 *
 * Returns the number of transactions created.
 */
export async function generateRecurringTransactions(
  db: SQLite.SQLiteDatabase,
  userId: string,
): Promise<number> {
  const templates = await findRecurringTransactions(db, userId);
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  let created = 0;

  for (const tpl of templates) {
    const end = tpl.endDate ? new Date(tpl.endDate) : null;
    const planned = tpl.timesPlanned ?? Infinity;
    let runs = tpl.timesRun;

    // Walk the schedule from the last known run until we catch up to today.
    let cursor = new Date(tpl.nextRunDate);
    cursor.setHours(0, 0, 0, 0);

    while (cursor.getTime() <= today.getTime() && runs < planned) {
      if (end && cursor.getTime() > end.getTime()) break;

      await createTransaction(db, {
        userId,
        amountCents: tpl.isIncome ? tpl.amountCents : -tpl.amountCents,
        currencyCode: "USD",
        accountId: tpl.accountId ?? undefined,
        categoryId: tpl.categoryId ?? undefined,
        note: `Recurring: ${tpl.name}`,
        date: toISODate(cursor),
      });

      runs += 1;
      created += 1;
      cursor = addInterval(cursor, tpl.frequency);
    }

    if (runs !== tpl.timesRun) {
      await updateRecurringTransaction(db, tpl.id, {
        timesRun: runs,
        nextRunDate: toISODate(cursor),
      });
    }
  }

  return created;
}

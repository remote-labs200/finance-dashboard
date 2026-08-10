import * as SQLite from 'expo-sqlite';
import type { SQLiteBindValue } from 'expo-sqlite';
import { MileageEntry } from './schema';
import { generateId } from './user-repo';
import { cloudUpsert, cloudDelete, CloudWriteResult } from './cloud-writer';

export interface MileageEntryRow {
  id: string;
  user_id: string;
  date: string;
  purpose: string;
  miles: number;
  start_lat?: number | null;
  start_lng?: number | null;
  start_location?: string | null;
  end_lat?: number | null;
  end_lng?: number | null;
  end_location?: string | null;
  created_at: string;
  updated_at: string;
}

function rowToEntry(row: MileageEntryRow): MileageEntry {
  return {
    id: row.id,
    userId: row.user_id,
    date: row.date,
    purpose: row.purpose,
    miles: row.miles,
    startLat: row.start_lat ?? undefined,
    startLng: row.start_lng ?? undefined,
    startLocation: row.start_location ?? undefined,
    endLat: row.end_lat ?? undefined,
    endLng: row.end_lng ?? undefined,
    endLocation: row.end_location ?? undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/** Mapping between app (camelCase) keys and DB (snake_case) columns */
const COLS = [
  'id', 'user_id', 'date', 'purpose', 'miles',
  'start_lat', 'start_lng', 'start_location',
  'end_lat', 'end_lng', 'end_location',
  'created_at', 'updated_at',
] as const;

/**
 * Create a mileage entry.
 *
 * Writes to Supabase first (source of truth), then caches to local SQLite.
 * If the network is down the write is queued and still cached locally
 * so the UI stays responsive.
 */
export async function createMileageEntry(
  db: SQLite.SQLiteDatabase,
  data: Omit<MileageEntry, 'id' | 'createdAt' | 'updatedAt'>
): Promise<MileageEntry> {
  const id = generateId();
  const now = new Date().toISOString();

  const entry: MileageEntry = {
    id,
    ...data,
    createdAt: now,
    updatedAt: now,
  };

  const cloudData: Record<string, unknown> = {
    id,
    user_id: data.userId,
    date: data.date,
    purpose: data.purpose,
    miles: data.miles,
    start_lat: data.startLat ?? null,
    start_lng: data.startLng ?? null,
    start_location: data.startLocation ?? null,
    end_lat: data.endLat ?? null,
    end_lng: data.endLng ?? null,
    end_location: data.endLocation ?? null,
    created_at: now,
    updated_at: now,
  };

  // Write to Supabase first (source of truth)
  const result: CloudWriteResult = await cloudUpsert(db, 'mileage_entries', id, cloudData);

  // Cache to local SQLite (use the same column order as COLS)
  await db.runAsync(
    `INSERT INTO mileage_entries (${COLS.join(', ')}) VALUES (${COLS.map(() => '?').join(', ')})`,
    ...COLS.map((c): SQLiteBindValue => {
      const camel = c.replace(/_([a-z])/g, (_, ch) => ch.toUpperCase());
      return entry[camel as keyof MileageEntry] ?? null;
    })
  );

  return entry;
}

/**
 * Find all mileage entries for a user, newest first.
 */
export async function findMileageEntriesByUser(
  db: SQLite.SQLiteDatabase,
  userId: string
): Promise<MileageEntry[]> {
  const rows = await db.getAllAsync<MileageEntryRow>(
    `SELECT * FROM mileage_entries WHERE user_id = ? ORDER BY date DESC, created_at DESC`,
    userId
  );
  return rows.map(rowToEntry);
}

/**
 * Find a single mileage entry by ID.
 */
export async function findMileageEntryById(
  db: SQLite.SQLiteDatabase,
  id: string
): Promise<MileageEntry | null> {
  const row = await db.getFirstAsync<MileageEntryRow>(
    `SELECT * FROM mileage_entries WHERE id = ?`,
    id
  );
  return row ? rowToEntry(row) : null;
}

/**
 * Update a mileage entry (cloud-first).
 */
export async function updateMileageEntry(
  db: SQLite.SQLiteDatabase,
  id: string,
  data: Partial<Omit<MileageEntry, 'id' | 'createdAt' | 'updatedAt'>>
): Promise<void> {
  const now = new Date().toISOString();

  const cloudData: Record<string, unknown> = { updated_at: now };
  const localFields: string[] = [];
  const localValues: SQLiteBindValue[] = [];

  for (const key of ['purpose', 'miles', 'startLat', 'startLng', 'startLocation', 'endLat', 'endLng', 'endLocation', 'date'] as const) {
    if (data[key] !== undefined) {
      const snake = key.replace(/[A-Z]/g, (m) => '_' + m.toLowerCase());
      cloudData[snake] = data[key];
      localFields.push(`${snake} = ?`);
      localValues.push(data[key]);
    }
  }

  // Write to Supabase first
  await cloudUpsert(db, 'mileage_entries', id, cloudData);

  // Cache to local SQLite
  if (localFields.length > 0) {
    localFields.push('updated_at = ?');
    localValues.push(now, id);
    await db.runAsync(
      `UPDATE mileage_entries SET ${localFields.join(', ')} WHERE id = ?`,
      ...localValues
    );
  }
}

/**
 * Delete a mileage entry (cloud-first).
 */
export async function deleteMileageEntry(
  db: SQLite.SQLiteDatabase,
  id: string
): Promise<void> {
  // Delete from Supabase first (source of truth)
  await cloudDelete(db, 'mileage_entries', id);

  // Remove from local SQLite cache
  await db.runAsync('DELETE FROM mileage_entries WHERE id = ?', id);
}

/**
 * Summary stats for the mileage dashboard header.
 */
export async function getMileageSummary(
  db: SQLite.SQLiteDatabase,
  userId: string
): Promise<{ totalMiles: number; totalDeductionCents: number }> {
  const row = await db.getFirstAsync<{ total: number }>(
    `SELECT COALESCE(SUM(miles), 0) as total FROM mileage_entries WHERE user_id = ?`,
    userId
  );
  const totalMiles = row?.total ?? 0;
  const deduction = totalMiles * 0.67 * 100; // IRS 2024 rate $0.67/mile → cents
  return { totalMiles, totalDeductionCents: Math.round(deduction) };
}

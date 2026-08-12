import * as SQLite from 'expo-sqlite';
import type { SQLiteBindValue } from 'expo-sqlite';
import { MileageVehicle } from './schema';
import { generateId } from './user-repo';
import { cloudUpsert, cloudDelete } from './cloud-writer';

export interface MileageVehicleRow {
  id: string;
  user_id: string;
  name: string;
  make: string;
  year: string;
  is_primary: number;
  created_at: string;
  updated_at: string;
}

function rowToVehicle(row: MileageVehicleRow): MileageVehicle {
  return {
    id: row.id,
    userId: row.user_id,
    name: row.name,
    make: row.make,
    year: row.year,
    isPrimary: row.is_primary === 1,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

const COLS = [
  'id', 'user_id', 'name', 'make', 'year', 'is_primary', 'created_at', 'updated_at',
] as const;

/**
 * Create a vehicle profile (cloud-first).
 */
export async function createMileageVehicle(
  db: SQLite.SQLiteDatabase,
  data: Omit<MileageVehicle, 'id' | 'createdAt' | 'updatedAt'>
): Promise<MileageVehicle> {
  const id = generateId();
  const now = new Date().toISOString();

  const vehicle: MileageVehicle = {
    id,
    ...data,
    createdAt: now,
    updatedAt: now,
  };

  const cloudData: Record<string, unknown> = {
    id,
    user_id: data.userId,
    name: data.name,
    make: data.make,
    year: data.year,
    is_primary: data.isPrimary ? 1 : 0,
    created_at: now,
    updated_at: now,
  };

  await cloudUpsert(db, 'mileage_vehicles', id, cloudData);

  await db.runAsync(
    `INSERT INTO mileage_vehicles (${COLS.join(', ')}) VALUES (${COLS.map(() => '?').join(', ')})`,
    ...COLS.map((c): SQLiteBindValue => {
      const camel = c.replace(/_([a-z])/g, (_, ch) => ch.toUpperCase());
      return vehicle[camel as keyof MileageVehicle] ?? null;
    })
  );

  return vehicle;
}

/**
 * Find all vehicles for a user.
 */
export async function findMileageVehiclesByUser(
  db: SQLite.SQLiteDatabase,
  userId: string
): Promise<MileageVehicle[]> {
  const rows = await db.getAllAsync<MileageVehicleRow>(
    `SELECT * FROM mileage_vehicles WHERE user_id = ? ORDER BY is_primary DESC, created_at ASC`,
    userId
  );
  return rows.map(rowToVehicle);
}

/**
 * Update a vehicle (cloud-first).
 */
export async function updateMileageVehicle(
  db: SQLite.SQLiteDatabase,
  id: string,
  data: Partial<Omit<MileageVehicle, 'id' | 'createdAt' | 'updatedAt'>>
): Promise<void> {
  const now = new Date().toISOString();

  const cloudData: Record<string, unknown> = { updated_at: now };
  const localFields: string[] = [];
  const localValues: SQLiteBindValue[] = [];

  for (const key of ['name', 'make', 'year', 'isPrimary'] as const) {
    if (data[key] !== undefined) {
      const snake = key === 'isPrimary' ? 'is_primary' : key;
      cloudData[snake] = key === 'isPrimary' ? (data.isPrimary ? 1 : 0) : data[key];
      localFields.push(`${snake} = ?`);
      localValues.push(key === 'isPrimary' ? (data.isPrimary ? 1 : 0) : data[key] as SQLiteBindValue);
    }
  }

  await cloudUpsert(db, 'mileage_vehicles', id, cloudData);

  if (localFields.length > 0) {
    localFields.push('updated_at = ?');
    localValues.push(now, id);
    await db.runAsync(
      `UPDATE mileage_vehicles SET ${localFields.join(', ')} WHERE id = ?`,
      ...localValues
    );
  }
}

/**
 * Delete a vehicle (cloud-first).
 */
export async function deleteMileageVehicle(
  db: SQLite.SQLiteDatabase,
  id: string
): Promise<void> {
  await cloudDelete(db, 'mileage_vehicles', id);
  await db.runAsync('DELETE FROM mileage_vehicles WHERE id = ?', id);
}

/**
 * Mark one vehicle as primary and demote the rest (cloud-first).
 */
export async function setPrimaryVehicle(
  db: SQLite.SQLiteDatabase,
  userId: string,
  primaryId: string
): Promise<void> {
  const vehicles = await findMileageVehiclesByUser(db, userId);
  await Promise.all(
    vehicles.map((v) =>
      updateMileageVehicle(db, v.id, { isPrimary: v.id === primaryId })
    )
  );
}

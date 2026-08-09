/**
 * SQLite schema types for the finance dashboard.
 * These types mirror the Supabase schema and are used for local database operations.
 */

export type AccountType = "checking" | "savings" | "credit" | "cash" | "other";

export interface LocalUser {
  id: string;
  email: string;
  passwordHash: string; // bcrypt/scrypt in production, plain for dev
  createdAt: string;
  updatedAt: string;
}

export interface Account {
  id: string; // UUID, matches Supabase
  userId: string;
  name: string;
  type: AccountType;
  balanceCents: number; // Integer cents to avoid float issues
  currencyCode: string; // e.g., USD, EUR, GBP
  color?: string;
  isHidden: boolean;
  createdAt: string; // ISO timestamp
  updatedAt: string; // ISO timestamp
}

export interface Category {
  id: string; // UUID
  userId: string;
  name: string;
  color?: string;
  icon?: string;
  isIncome: boolean;
  isHidden: boolean;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

export interface Transaction {
  id: string; // UUID
  userId: string;
  accountId: string;
  categoryId: string;
  amountCents: number; // Positive for income, negative for expense
  currencyCode: string;
  note?: string;
  clientId?: string; // Optional link to a client
  date: string; // ISO date (YYYY-MM-DD)
  createdAt: string; // ISO timestamp
  updatedAt: string; // ISO timestamp
  // Denormalized for queries
  accountName?: string;
  categoryName?: string;
  clientName?: string;
}

export interface Client {
  id: string; // UUID, matches Supabase
  userId: string;
  name: string;
  email?: string;
  company?: string;
  phone?: string;
  notes?: string;
  color?: string;
  currencyCode: string; // Default currency for this client
  createdAt: string; // ISO timestamp
  updatedAt: string; // ISO timestamp
}

export interface TaxSettings {
  id: string; // UUID (one per user, id = userId)
  userId: string;
  countryCode: string; // ISO 3166-1 alpha-2
  taxYear: number;
  quarter: 1 | 2 | 3 | 4;
  estimatedRatePercent: number; // e.g., 30 for 30%
  incomeThresholdCents?: number; // Optional threshold for smoothing
  createdAt: string;
  updatedAt: string;
}

// SQLite table creation statements
export const MIGRATIONS = [
  `CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY NOT NULL,
    email TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  )`,
  `CREATE INDEX IF NOT EXISTS idx_users_email ON users(email)`,
  `CREATE TABLE IF NOT EXISTS accounts (
    id TEXT PRIMARY KEY NOT NULL,
    user_id TEXT NOT NULL,
    name TEXT NOT NULL,
    type TEXT NOT NULL,
    balance_cents INTEGER NOT NULL DEFAULT 0,
    currency_code TEXT NOT NULL,
    color TEXT,
    is_hidden INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS categories (
    id TEXT PRIMARY KEY NOT NULL,
    user_id TEXT NOT NULL,
    name TEXT NOT NULL,
    color TEXT,
    icon TEXT,
    is_income INTEGER NOT NULL DEFAULT 0,
    is_hidden INTEGER NOT NULL DEFAULT 0,
    sort_order INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS transactions (
    id TEXT PRIMARY KEY NOT NULL,
    user_id TEXT NOT NULL,
    account_id TEXT NOT NULL,
    category_id TEXT NOT NULL,
    amount_cents INTEGER NOT NULL,
    currency_code TEXT NOT NULL,
    note TEXT,
    client_id TEXT REFERENCES clients(id) ON DELETE SET NULL,
    date TEXT NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS clients (
    id TEXT PRIMARY KEY NOT NULL,
    user_id TEXT NOT NULL,
    name TEXT NOT NULL,
    email TEXT,
    company TEXT,
    phone TEXT,
    notes TEXT,
    color TEXT,
    currency_code TEXT NOT NULL DEFAULT 'USD',
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS tax_settings (
    id TEXT PRIMARY KEY NOT NULL,
    user_id TEXT NOT NULL,
    country_code TEXT NOT NULL,
    tax_year INTEGER NOT NULL,
    quarter INTEGER NOT NULL,
    estimated_rate_percent REAL NOT NULL,
    income_threshold_cents INTEGER,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  )`,
  // Indexes for faster queries
  `CREATE INDEX IF NOT EXISTS idx_transactions_user_id ON transactions(user_id)`,
  `CREATE INDEX IF NOT EXISTS idx_transactions_account_id ON transactions(account_id)`,
  `CREATE INDEX IF NOT EXISTS idx_transactions_date ON transactions(date)`,
  `CREATE INDEX IF NOT EXISTS idx_transactions_client_id ON transactions(client_id)`,
  `CREATE INDEX IF NOT EXISTS idx_clients_user_id ON clients(user_id)`,
  `CREATE INDEX IF NOT EXISTS idx_accounts_user_id ON accounts(user_id)`,
  // User preferences (key-value store)
  `CREATE TABLE IF NOT EXISTS user_preferences (
    user_id TEXT NOT NULL,
    key TEXT NOT NULL,
    value TEXT,
    updated_at TEXT NOT NULL,
    PRIMARY KEY (user_id, key)
  )`,
  `CREATE INDEX IF NOT EXISTS idx_preferences_user_id ON user_preferences(user_id)`,
  // Cache metadata for cloud-first sync
  `CREATE TABLE IF NOT EXISTS cache_metadata (
    table_name TEXT PRIMARY KEY NOT NULL,
    last_synced_at TEXT NOT NULL
  )`,
  // Offline write queue (drained to Supabase when connectivity returns)
  `CREATE TABLE IF NOT EXISTS sync_log (
    id TEXT PRIMARY KEY NOT NULL,
    entity TEXT NOT NULL,
    entity_id TEXT NOT NULL,
    operation TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending',
    version INTEGER NOT NULL DEFAULT 1,
    data TEXT,
    error_message TEXT,
    created_at TEXT NOT NULL,
    synced_at TEXT
  )`,
  `CREATE INDEX IF NOT EXISTS idx_sync_log_status ON sync_log(status)`,
];

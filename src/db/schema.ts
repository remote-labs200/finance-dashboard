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
  isDeductible: boolean;
  isHidden: boolean;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

export interface Receipt {
  id: string; // UUID
  userId: string;
  transactionId?: string;
  localPath?: string;
  remoteUrl?: string;
  merchant?: string;
  amountCents?: number;
  date?: string; // YYYY-MM-DD
  ocrRaw?: string;
  createdAt: string;
  updatedAt: string;
}

export interface TaxPayment {
  id: string; // UUID
  userId: string;
  amountCents: number;
  taxYear: number;
  quarter?: number; // 1-4, or undefined for annual/other payments
  paymentDate: string; // YYYY-MM-DD
  method?: string;
  note?: string;
  createdAt: string;
  updatedAt: string;
}

export interface RecurringTransaction {
  id: string; // UUID
  userId: string;
  name: string;
  isIncome: boolean;
  amountCents: number;
  categoryId?: string;
  accountId?: string;
  frequency: "weekly" | "monthly" | "quarterly" | "yearly";
  startDate: string; // YYYY-MM-DD
  endDate?: string; // YYYY-MM-DD
  nextRunDate: string; // YYYY-MM-DD
  timesRun: number;
  timesPlanned?: number;
  createdAt: string;
  updatedAt: string;
}

export interface Transaction {
  id: string; // UUID
  userId: string;
  accountId?: string;
  categoryId?: string;
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
  categoryIsDeductible?: boolean;
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

export interface MileageEntry {
  id: string;
  userId: string;
  date: string; // YYYY-MM-DD
  purpose: string;
  miles: number;
  startLat?: number;
  startLng?: number;
  startLocation?: string;
  endLat?: number;
  endLng?: number;
  endLocation?: string;
  createdAt: string;
  updatedAt: string;
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
    is_deductible INTEGER NOT NULL DEFAULT 1,
    is_hidden INTEGER NOT NULL DEFAULT 0,
    sort_order INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS transactions (
    id TEXT PRIMARY KEY NOT NULL,
    user_id TEXT NOT NULL,
    account_id TEXT,
    category_id TEXT,
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
  // Mileage tracking (cloud-first: mirrors public.mileage_entries on Supabase)
  `CREATE TABLE IF NOT EXISTS mileage_entries (
    id TEXT PRIMARY KEY NOT NULL,
    user_id TEXT NOT NULL,
    date TEXT NOT NULL,
    purpose TEXT NOT NULL DEFAULT 'Business',
    miles REAL NOT NULL DEFAULT 0,
    start_lat REAL,
    start_lng REAL,
    start_location TEXT,
    end_lat REAL,
    end_lng REAL,
    end_location TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  )`,
  `CREATE INDEX IF NOT EXISTS idx_mileage_entries_user_id ON mileage_entries(user_id)`,
  `CREATE INDEX IF NOT EXISTS idx_mileage_entries_date ON mileage_entries(date)`,
  // App settings (key-value, user-scoped) — mirrors public.app_settings
  // Stores per-device/app settings like bank connection state.
  `CREATE TABLE IF NOT EXISTS app_settings (
    id TEXT PRIMARY KEY NOT NULL,
    user_id TEXT NOT NULL,
    key TEXT NOT NULL,
    value TEXT,
    updated_at TEXT NOT NULL
  )`,
  `CREATE INDEX IF NOT EXISTS idx_app_settings_user_id ON app_settings(user_id)`,
  // Integration settings (key-value, user-scoped) — mirrors public.integrations_settings
  // Stores payment gateway / accounting platform enable state.
  `CREATE TABLE IF NOT EXISTS integrations_settings (
    id TEXT PRIMARY KEY NOT NULL,
    user_id TEXT NOT NULL,
    key TEXT NOT NULL,
    value TEXT,
    updated_at TEXT NOT NULL
  )`,
  `CREATE INDEX IF NOT EXISTS idx_integrations_settings_user_id ON integrations_settings(user_id)`,
  // Receipts — mirrors public.receipts (cloud-first)
  // Stores OCR data + the storage URL for a scanned receipt, linked to a transaction.
  `CREATE TABLE IF NOT EXISTS receipts (
    id TEXT PRIMARY KEY NOT NULL,
    user_id TEXT NOT NULL,
    transaction_id TEXT,
    local_path TEXT,
    remote_url TEXT,
    merchant TEXT,
    amount_cents INTEGER,
    date TEXT,
    ocr_raw TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  )`,
  `CREATE INDEX IF NOT EXISTS idx_receipts_user_id ON receipts(user_id)`,
  `CREATE INDEX IF NOT EXISTS idx_receipts_transaction_id ON receipts(transaction_id)`,
  // Tax payments — mirrors public.tax_payments (cloud-first)
  // Records actual estimated-tax payments so "projected owe" can be net of what's been paid.
  `CREATE TABLE IF NOT EXISTS tax_payments (
    id TEXT PRIMARY KEY NOT NULL,
    user_id TEXT NOT NULL,
    amount_cents INTEGER NOT NULL,
    tax_year INTEGER NOT NULL,
    quarter INTEGER,
    payment_date TEXT NOT NULL,
    method TEXT,
    note TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  )`,
  `CREATE INDEX IF NOT EXISTS idx_tax_payments_user_id ON tax_payments(user_id)`,
  `CREATE INDEX IF NOT EXISTS idx_tax_payments_year ON tax_payments(tax_year)`,
  // Recurring transactions — templates for automatic income/expense creation
  `CREATE TABLE IF NOT EXISTS recurring_transactions (
    id TEXT PRIMARY KEY NOT NULL,
    user_id TEXT NOT NULL,
    name TEXT NOT NULL,
    is_income INTEGER NOT NULL DEFAULT 1,
    amount_cents INTEGER NOT NULL,
    category_id TEXT,
    account_id TEXT,
    frequency TEXT NOT NULL DEFAULT 'monthly',
    start_date TEXT NOT NULL,
    end_date TEXT,
    next_run_date TEXT NOT NULL DEFAULT (date('now')),
    times_run INTEGER NOT NULL DEFAULT 0,
    times_planned INTEGER,
    created_at TEXT NOT NULL DEFAULT (date('now')),
    updated_at TEXT NOT NULL DEFAULT (date('now'))
  )`,
  `CREATE INDEX IF NOT EXISTS idx_recurring_transactions_user_id ON recurring_transactions(user_id)`,
  `CREATE INDEX IF NOT EXISTS idx_recurring_transactions_next_date ON recurring_transactions(next_run_date)`,
];

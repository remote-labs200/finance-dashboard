-- ============================================================================
-- SmoothTax — Supabase Initial Schema
-- Mirrors the local SQLite schema for cloud sync.
-- Run this in the Supabase SQL Editor (https://supabase.com/dashboard/project/_/sql)
-- or via `supabase migration up` with the Supabase CLI.
-- ============================================================================

-- 1. Accounts
CREATE TABLE IF NOT EXISTS public.accounts (
  id            TEXT PRIMARY KEY,       -- UUID (generated locally by expo-crypto)
  user_id       TEXT NOT NULL,          -- Supabase Auth UID
  name          TEXT NOT NULL,
  type          TEXT NOT NULL CHECK (type IN ('checking','savings','credit','cash','other')),
  balance_cents INTEGER NOT NULL DEFAULT 0,
  currency_code TEXT NOT NULL DEFAULT 'USD',
  color         TEXT,
  is_hidden     INTEGER NOT NULL DEFAULT 0,
  created_at    TEXT NOT NULL,
  updated_at    TEXT NOT NULL
);

-- Enable Row-Level Security
ALTER TABLE public.accounts ENABLE ROW LEVEL SECURITY;

-- Users can only see their own accounts
CREATE POLICY "Users can manage their own accounts"
  ON public.accounts
  FOR ALL
  USING (auth.uid()::text = user_id)
  WITH CHECK (auth.uid()::text = user_id);

-- 2. Categories
CREATE TABLE IF NOT EXISTS public.categories (
  id          TEXT PRIMARY KEY,
  user_id     TEXT NOT NULL,
  name        TEXT NOT NULL,
  color       TEXT,
  icon        TEXT,
  is_income   INTEGER NOT NULL DEFAULT 0,
  is_hidden   INTEGER NOT NULL DEFAULT 0,
  sort_order  INTEGER NOT NULL DEFAULT 0,
  created_at  TEXT NOT NULL,
  updated_at  TEXT NOT NULL
);

ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own categories"
  ON public.categories
  FOR ALL
  USING (auth.uid()::text = user_id)
  WITH CHECK (auth.uid()::text = user_id);

-- 3. Transactions
CREATE TABLE IF NOT EXISTS public.transactions (
  id            TEXT PRIMARY KEY,
  user_id       TEXT NOT NULL,
  account_id    TEXT NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  category_id   TEXT NOT NULL REFERENCES public.categories(id) ON DELETE RESTRICT,
  amount_cents  INTEGER NOT NULL,
  currency_code TEXT NOT NULL,
  note          TEXT,
  date          TEXT NOT NULL,
  created_at    TEXT NOT NULL,
  updated_at    TEXT NOT NULL
);

ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own transactions"
  ON public.transactions
  FOR ALL
  USING (auth.uid()::text = user_id)
  WITH CHECK (auth.uid()::text = user_id);

-- 4. Tax Settings
CREATE TABLE IF NOT EXISTS public.tax_settings (
  id                     TEXT PRIMARY KEY,
  user_id                TEXT NOT NULL,
  country_code           TEXT NOT NULL DEFAULT 'US',
  tax_year               INTEGER NOT NULL,
  quarter                INTEGER NOT NULL CHECK (quarter BETWEEN 1 AND 4),
  estimated_rate_percent REAL NOT NULL,
  income_threshold_cents INTEGER,
  created_at             TEXT NOT NULL,
  updated_at             TEXT NOT NULL
);

ALTER TABLE public.tax_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own tax settings"
  ON public.tax_settings
  FOR ALL
  USING (auth.uid()::text = user_id)
  WITH CHECK (auth.uid()::text = user_id);

-- 5. User Preferences (synced key-value store)
CREATE TABLE IF NOT EXISTS public.user_preferences (
  user_id    TEXT NOT NULL,
  key        TEXT NOT NULL,
  value      TEXT,
  updated_at TEXT NOT NULL,
  PRIMARY KEY (user_id, key)
);

ALTER TABLE public.user_preferences ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own preferences"
  ON public.user_preferences
  FOR ALL
  USING (auth.uid()::text = user_id)
  WITH CHECK (auth.uid()::text = user_id);

-- ============================================================================
-- Indexes
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_accounts_user_id ON public.accounts(user_id);
CREATE INDEX IF NOT EXISTS idx_categories_user_id ON public.categories(user_id);
CREATE INDEX IF NOT EXISTS idx_transactions_user_id ON public.transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_transactions_date ON public.transactions(date);
CREATE INDEX IF NOT EXISTS idx_transactions_account_id ON public.transactions(account_id);

/**
 * Week 2 data-completeness migration:
 *  1. Add `is_deductible` to categories (drives the tax engine's deductions).
 *  2. Create `receipts` — OCR data + storage URL linked to a transaction.
 *  3. Create `tax_payments` — recorded estimated-tax payments for paid-vs-owe.
 *
 * Local SQLite schema mirrors these in `src/db/schema.ts`.
 * All tables follow the existing RLS pattern (owner-scoped to auth.uid()).
 */

-- ─────────────────────────────────────────────
-- 1. Categories: deductibility flag
-- ─────────────────────────────────────────────
alter table public.categories
  add column if not exists is_deductible integer not null default 1;

-- ─────────────────────────────────────────────
-- 2. Receipts
-- ─────────────────────────────────────────────
create table if not exists public.receipts (
  id             text primary key not null,
  user_id        text not null,
  transaction_id text,
  local_path     text,
  remote_url     text,
  merchant       text,
  amount_cents   integer,
  date           date,
  ocr_raw        text,
  created_at     timestamp with time zone not null default now(),
  updated_at     timestamp with time zone not null default now()
);

create index if not exists idx_receipts_user_id on public.receipts(user_id);
create index if not exists idx_receipts_transaction_id on public.receipts(transaction_id);

alter table public.receipts enable row level security;

create policy "Allow individual reads and writes for receipts"
  on public.receipts
  for all
  using (auth.uid()::text = user_id)
  with check (auth.uid()::text = user_id);

-- ─────────────────────────────────────────────
-- 3. Tax payments
-- ─────────────────────────────────────────────
create table if not exists public.tax_payments (
  id           text primary key not null,
  user_id      text not null,
  amount_cents integer not null,
  tax_year     integer not null,
  quarter      integer,
  payment_date date not null,
  method       text,
  note         text,
  created_at   timestamp with time zone not null default now(),
  updated_at   timestamp with time zone not null default now()
);

create index if not exists idx_tax_payments_user_id on public.tax_payments(user_id);
create index if not exists idx_tax_payments_year on public.tax_payments(tax_year);

alter table public.tax_payments enable row level security;

create policy "Allow individual reads and writes for tax payments"
  on public.tax_payments
  for all
  using (auth.uid()::text = user_id)
  with check (auth.uid()::text = user_id);

-- ─────────────────────────────────────────────
-- Grants (this project uses auto_expose_new_tables = false)
-- ─────────────────────────────────────────────
grant usage on schema public to anon, authenticated, service_role;
grant all on public.receipts to anon, authenticated, service_role;
grant all on public.tax_payments to anon, authenticated, service_role;
grant all on all sequences in schema public to anon, authenticated, service_role;

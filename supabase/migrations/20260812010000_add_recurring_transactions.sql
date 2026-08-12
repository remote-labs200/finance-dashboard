/**
 * Week 4 migration: recurring transactions
 */

-- ─────────────────────────────────────────────
-- Recurring transactions
-- ─────────────────────────────────────────────
create table if not exists public.recurring_transactions (
  id              text primary key not null,
  user_id         text not null,
  name            text not null,
  is_income       integer not null default 1,
  amount_cents    integer not null,
  category_id     text,
  account_id      text,
  frequency       text not null default 'monthly',
  start_date      date not null,
  end_date        date,
  next_run_date   date not null default now(),
  times_run       integer not null default 0,
  times_planned   integer,
  created_at      timestamp with time zone not null default now(),
  updated_at      timestamp with time zone not null default now()
);

create index if not exists idx_recurring_transactions_user_id on public.recurring_transactions(user_id);
create index if not exists idx_recurring_transactions_next_date on public.recurring_transactions(next_run_date);

alter table public.recurring_transactions enable row level security;

create policy "Allow individual reads and writes for recurring transactions"
  on public.recurring_transactions
  for all
  using (auth.uid()::text = user_id)
  with check (auth.uid()::text = user_id);

-- ─────────────────────────────────────────────
-- Grants (this project uses auto_expose_new_tables = false)
-- ─────────────────────────────────────────────
grant all on public.recurring_transactions to anon, authenticated, service_role;
grant all on all sequences in schema public to anon, authenticated, service_role;

/**
 * Create the `bank_connections` and `bank_accounts` tables for Plaid integration.
 */

create table if not exists public.bank_connections (
  id          text primary key not null,
  user_id     text not null,
  provider    text not null, -- 'plaid', etc.
  access_token text,
  item_id     text,
  status      text not null, -- 'active', 'disconnected'
  updated_at  timestamp with time zone not null default now()
);

create table if not exists public.bank_accounts (
  id          text primary key not null,
  connection_id text not null references public.bank_connections(id) on delete cascade,
  user_id     text not null,
  account_id  text not null, -- Plaid account ID
  name        text not null,
  mask        text,
  type        text,
  subtype     text,
  balance     numeric,
  currency    text,
  updated_at  timestamp with time zone not null default now()
);

-- Indexes
create index if not exists idx_bank_connections_user_id on public.bank_connections(user_id);
create index if not exists idx_bank_accounts_user_id on public.bank_accounts(user_id);
create index if not exists idx_bank_accounts_connection_id on public.bank_accounts(connection_id);

-- RLS
alter table public.bank_connections enable row level security;
alter table public.bank_accounts enable row level security;

create policy "Allow individual reads and writes for bank connections" on public.bank_connections for all using (auth.uid()::text = user_id) with check (auth.uid()::text = user_id);
create policy "Allow individual reads and writes for bank accounts" on public.bank_accounts for all using (auth.uid()::text = user_id) with check (auth.uid()::text = user_id);

-- Grants
grant all on public.bank_connections to anon, authenticated, service_role;
grant all on public.bank_accounts to anon, authenticated, service_role;


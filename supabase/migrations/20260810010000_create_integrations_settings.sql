/**
 * Create the `integrations_settings` table for payment gateway / accounting
 * platform enable state (Stripe, PayPal, Wise, QuickBooks, Xero, etc.).
 *
 * This table mirrors the local SQLite schema in `src/db/schema.ts` and is
 * owned by `auth.uid()`. Each row is a single key-value setting scoped to a
 * user (e.g. `stripe_connected`, `quickbooks_connected`).
 */

create table if not exists public.integrations_settings (
  id          text primary key not null,
  user_id     text not null,
  key         text not null,
  value       text,
  updated_at  timestamp with time zone not null default now()
);

-- Index for the common query: list a user's integration settings
create index if not exists idx_integrations_settings_user_id on public.integrations_settings(user_id);

-- Expose only to the row owner (matches the other tables' RLS pattern)
alter table public.integrations_settings enable row level security;

create policy "Allow individual reads and writes for integration settings"
  on public.integrations_settings
  for all
  using (auth.uid()::text = user_id)
  with check (auth.uid()::text = user_id);

-- Grant privileges to the PostgREST roles (this project has
-- auto_expose_new_tables = false, so grants are required)
grant usage on schema public to anon, authenticated, service_role;
grant all on public.integrations_settings to anon, authenticated, service_role;
grant all on all sequences in schema public to anon, authenticated, service_role;

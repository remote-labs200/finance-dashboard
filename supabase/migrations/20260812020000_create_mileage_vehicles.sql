/**
 * Create the `mileage_vehicles` table for the mileage tracker settings
 * screen (vehicle profiles).
 *
 * Mirrors the local SQLite schema in `src/db/schema.ts` and is owned by
 * `auth.uid()`.
 */

create table if not exists public.mileage_vehicles (
  id              text primary key not null,
  user_id         text not null,
  name            text not null,
  make            text not null default '',
  year            text not null default '',
  is_primary      boolean not null default false,
  created_at      timestamp with time zone not null default now(),
  updated_at      timestamp with time zone not null default now()
);

create index if not exists idx_mileage_vehicles_user_id on public.mileage_vehicles(user_id);

-- Expose only to the row owner (matches the other tables' RLS pattern)
alter table public.mileage_vehicles enable row level security;

create policy "Allow individual reads and writes for mileage vehicles"
  on public.mileage_vehicles
  for all
  using (auth.uid()::text = user_id)
  with check (auth.uid()::text = user_id);

-- Grant privileges to the PostgREST roles (this project has
-- auto_expose_new_tables = false, so grants are required)
grant usage on schema public to anon, authenticated, service_role;
grant all on public.mileage_vehicles to anon, authenticated, service_role;

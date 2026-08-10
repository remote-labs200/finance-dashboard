/**
 * Create the `mileage_entries` table for the mileage tracking feature.
 *
 * This table mirrors the local SQLite schema in `src/db/schema.ts` and is
 * owned by `auth.uid()`. Each row is a single business-trip record.
 */

create table if not exists public.mileage_entries (
  id              text primary key not null,
  user_id         text not null,
  date            date not null,
  purpose         text not null default 'Business',
  miles           real not null default 0,
  start_lng       real,
  start_location  text,
  end_lat         real,
  end_lng         real,
  end_location    text,
  created_at      timestamp with time zone not null default now(),
  updated_at      timestamp with time zone not null default now()
);

-- Index for the common query: list a user's trips ordered by date
create index if not exists idx_mileage_entries_user_id on public.mileage_entries(user_id);
create index if not exists idx_mileage_entries_date on public.mileage_entries(date);

-- Expose only to the row owner (matches the other tables' RLS pattern)
alter table public.mileage_entries enable row level security;

create policy "Allow individual reads and writes for mileage entries"
  on public.mileage_entries
  for all
  using (auth.uid()::text = user_id)
  with check (auth.uid()::text = user_id);

-- Grant privileges to the PostgREST roles (this project has
-- auto_expose_new_tables = false, so grants are required)
grant usage on schema public to anon, authenticated, service_role;
grant all on public.mileage_entries to anon, authenticated, service_role;
grant all on all sequences in schema public to anon, authenticated, service_role;

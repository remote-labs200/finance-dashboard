/**
 * Create the `app_settings` table for per-device app settings.
 *
 * This table mirrors the local SQLite schema in `src/db/schema.ts` and is
 * owned by `auth.uid()`. Each row is a single key-value setting scoped to a
 * user (e.g. bank connection state, notification settings, etc.).
 */

create table if not exists public.app_settings (
  id          text primary key not null,
  user_id     text not null,
  key         text not null,
  value       text,
  updated_at  timestamp with time zone not null default now()
);

-- Index for the common query: list a user's settings
create index if not exists idx_app_settings_user_id on public.app_settings(user_id);

-- Expose only to the row owner (matches the other tables' RLS pattern)
alter table public.app_settings enable row level security;

create policy "Allow individual reads and writes for app settings"
  on public.app_settings
  for all
  using (auth.uid()::text = user_id)
  with check (auth.uid()::text = user_id);

-- Grant privileges to the PostgREST roles (this project has
-- auto_expose_new_tables = false, so grants are required)
grant usage on schema public to anon, authenticated, service_role;
grant all on public.app_settings to anon, authenticated, service_role;
grant all on all sequences in schema public to anon, authenticated, service_role;

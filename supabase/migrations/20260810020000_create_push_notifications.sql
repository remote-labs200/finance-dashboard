/**
 * Create the `push_notifications` table.
 *
 * Every notification the server pushes (via the `notify-push` edge function)
 * is recorded here. The mobile app:
 *   - subscribes to INSERTs via Supabase Realtime (filtered by user_id) so a
 *     new notification appears instantly in the in-app feed, and
 *   - re-pulls this table on sign-in to restore the feed after a restart.
 *
 * Device push tokens are stored separately in `user_preferences`
 * (key = `push_token`), mirroring the local SQLite key-value store.
 */

create table if not exists public.push_notifications (
  id           text primary key not null,
  user_id      text not null,
  type         text not null default 'system',
  title        text not null,
  body         text not null,
  action_route text,
  data         jsonb,
  is_read      boolean not null default false,
  created_at   timestamp with time zone not null default now()
);

-- Common queries: a user's recent notifications, plus the Realtime
-- INSERT filter (user_id = auth.uid()).
create index if not exists idx_push_notifications_user_id on public.push_notifications(user_id);
create index if not exists idx_push_notifications_created_at on public.push_notifications(created_at desc);

-- Expose only to the row owner (matches the other tables' RLS pattern)
alter table public.push_notifications enable row level security;

create policy "Allow individual reads and writes for push notifications"
  on public.push_notifications
  for all
  using (auth.uid()::text = user_id)
  with check (auth.uid()::text = user_id);

-- Grant privileges to the PostgREST roles (this project has
-- auto_expose_new_tables = false, so grants are required)
grant usage on schema public to anon, authenticated, service_role;
grant all on public.push_notifications to anon, authenticated, service_role;
grant all on all sequences in schema public to anon, authenticated, service_role;

/**
 * Email audit log for transactional emails sent via the
 * `send-transactional-email` edge function (Brevo).
 *
 * Every programmatic email the app sends is recorded here so users and
 * admins can see what was delivered. `user_id` is nullable because some
 * system-level emails aren't tied to a signed-in user.
 */

create table if not exists public.email_log (
  id            text primary key not null,
  user_id       text,
  to_email      text not null,
  subject       text not null,
  provider      text not null default 'brevo',
  status        text not null default 'sent', -- sent | failed
  error_message text,
  created_at    timestamp with time zone not null default now()
);

create index if not exists idx_email_log_user_id on public.email_log(user_id);
create index if not exists idx_email_log_created_at on public.email_log(created_at desc);

-- Users can inspect the transactional emails sent to them.
alter table public.email_log enable row level security;

create policy "Users can view their own email log"
  on public.email_log
  for select
  to authenticated
  using ((select auth.uid())::text = user_id);

-- Grants for the PostgREST roles (auto_expose_new_tables = false). Writes are
-- performed by the edge function with the service role; RLS keeps rows scoped.
grant usage on schema public to anon, authenticated, service_role;
grant all on public.email_log to anon, authenticated, service_role;
grant all on all sequences in schema public to anon, authenticated, service_role;
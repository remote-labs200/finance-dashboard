/**
 * Delete the current user's auth account (and their cloud data via RLS
 * cascades).
 *
 * Called from the Settings screen ("Delete Account"). Must be executed by the
 * user while authenticated recently. The function runs with the privileges of
 * its owner (`postgres`) so it can remove the row from `auth.users`, which
 * cascades to owned data (RLS rows are deleted via the auth.users ON DELETE
 * cascade / cleanup).
 */

create or replace function public.delete_user_account()
returns void
language sql
security definer
set search_path = public
as $$
  delete from auth.users where id = auth.uid();
$$;

-- Allow only the authenticated user to invoke it; the service role can too.
-- Revoke the default PUBLIC execute so anonymous callers get denied.
revoke execute on function public.delete_user_account() from public, anon;
grant execute on function public.delete_user_account() to authenticated;
grant execute on function public.delete_user_account() to service_role;

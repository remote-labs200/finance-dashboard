/**
 * Tighten grants on `delete_user_account` — revoke the default PUBLIC
 * execute so anonymous callers are denied (the function would otherwise
 * return a harmless no-op for auth.uid() = NULL). It runs only against the
 * row the caller owns, but least-privilege is better.
 */

revoke execute on function public.delete_user_account() from public, anon;
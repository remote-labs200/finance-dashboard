-- ============================================================================
-- PaySmooth — Fix: Grant table access to PostgREST roles + create users table
--
-- Context:
--   The initial schema created the core tables but never GRANTed privileges to
--   the `anon` / `authenticated` / `service_role` roles. With Supabase's new
--   default (auto_expose_new_tables = false), tables without explicit grants
--   are invisible to the Data API — every REST call returns:
--       "42501 permission denied for schema public"
--
-- This migration:
--   1. Grants schema USAGE to the PostgREST roles
--   2. Grants ALL on each PaySmooth table ONLY (this `public` schema is
--      shared with another project — do NOT broaden to ALL TABLES)
--   3. Creates the missing `users` table (mirrors the local SQLite schema)
--   4. Enables RLS + row policy for `users`
--
-- Idempotent — safe to run multiple times.
-- ============================================================================

-- 1. Schema usage (required before any table access)
GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;

-- 2. Table privileges — PaySmooth tables only
GRANT ALL ON TABLE public.accounts         TO anon, authenticated, service_role;
GRANT ALL ON TABLE public.categories       TO anon, authenticated, service_role;
GRANT ALL ON TABLE public.clients          TO anon, authenticated, service_role;
GRANT ALL ON TABLE public.transactions     TO anon, authenticated, service_role;
GRANT ALL ON TABLE public.tax_settings     TO anon, authenticated, service_role;
GRANT ALL ON TABLE public.user_preferences TO anon, authenticated, service_role;

-- 3. Users table (local auth mirror — used by sync-service health check
--    `supabase.from('users').select('id').limit(1)`)
CREATE TABLE IF NOT EXISTS public.users (
  id            TEXT PRIMARY KEY NOT NULL,
  email         TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  created_at    TEXT NOT NULL,
  updated_at    TEXT NOT NULL
);

ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can manage their own record" ON public.users;
CREATE POLICY "Users can manage their own record"
  ON public.users
  FOR ALL
  USING (auth.uid()::text = id)
  WITH CHECK (auth.uid()::text = id);

GRANT ALL ON TABLE public.users TO anon, authenticated, service_role;

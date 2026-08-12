-- Mirror auth.users in public.users and sync on insert

-- 1. Ensure columns match auth.users (id, email, created_at, updated_at)
-- The table public.users exists and has these, but needs to be robust.
-- The existing `password_hash` column is likely only needed for local auth flow, 
-- we can keep it as nullable if we want to align completely with auth.users.
ALTER TABLE public.users ALTER COLUMN password_hash DROP NOT NULL;

-- 2. Create function to sync new auth.users to public.users
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.users (id, email, created_at, updated_at)
  VALUES (new.id, new.email, new.created_at, new.created_at);
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Trigger
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();

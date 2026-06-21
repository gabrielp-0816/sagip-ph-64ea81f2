-- Enable pgcrypto for password hash comparison
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Alter profiles to support street, postal_code, and country
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS street TEXT,
ADD COLUMN IF NOT EXISTS postal_code TEXT,
ADD COLUMN IF NOT EXISTS country TEXT;

-- Create password history table
CREATE TABLE IF NOT EXISTS public.password_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  password_hash TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS on password history
ALTER TABLE public.password_history ENABLE ROW LEVEL SECURITY;

-- Track password changes trigger function
CREATE OR REPLACE FUNCTION public.track_password_history()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, auth, pg_catalog AS $$
BEGIN
  IF (TG_OP = 'INSERT') THEN
    IF NEW.encrypted_password IS NOT NULL THEN
      INSERT INTO public.password_history (user_id, password_hash)
      VALUES (NEW.id, NEW.encrypted_password);
    END IF;
  ELSIF (TG_OP = 'UPDATE') THEN
    IF NEW.encrypted_password IS DISTINCT FROM OLD.encrypted_password THEN
      INSERT INTO public.password_history (user_id, password_hash)
      VALUES (NEW.id, NEW.encrypted_password);
    END IF;
  END IF;
  RETURN NEW;
END; $$;

-- Bind trigger to auth.users
DROP TRIGGER IF EXISTS trg_track_password_history ON auth.users;
CREATE TRIGGER trg_track_password_history
AFTER INSERT OR UPDATE ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.track_password_history();

-- Populate initial password hashes for existing users
INSERT INTO public.password_history (user_id, password_hash)
SELECT id, encrypted_password FROM auth.users
ON CONFLICT DO NOTHING;

-- RPC function to verify if a new password matches the current one or the last 5 passwords
CREATE OR REPLACE FUNCTION public.check_password_reuse(_user_id uuid, _password text)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, auth, pg_catalog AS $$
DECLARE
  history_record RECORD;
  current_hash text;
  is_reused boolean := false;
BEGIN
  -- 1. Check current password in auth.users
  SELECT encrypted_password INTO current_hash FROM auth.users WHERE id = _user_id;
  IF current_hash IS NOT NULL AND current_hash = crypt(_password, current_hash) THEN
    RETURN TRUE;
  END IF;

  -- 2. Check last 5 passwords in password_history
  FOR history_record IN 
    SELECT password_hash FROM public.password_history 
    WHERE user_id = _user_id 
    ORDER BY created_at DESC 
    LIMIT 5
  LOOP
    IF history_record.password_hash = crypt(_password, history_record.password_hash) THEN
      is_reused := true;
      EXIT;
    END IF;
  END LOOP;

  RETURN is_reused;
END; $$;

-- Grant permissions for authenticated users to execute the RPC
GRANT EXECUTE ON FUNCTION public.check_password_reuse(uuid, text) TO authenticated;

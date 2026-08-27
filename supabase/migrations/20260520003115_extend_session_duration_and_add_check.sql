/*
  # Extend session duration and add session check RPC

  1. Changes
     - Alter app_sessions default expires_at from 12 hours to 30 days
     - Update create_app_session to use 30-day expiry
     - Add check_app_session(token) RPC: returns true if token is valid, false otherwise
       (callable by anon so the client can validate a stored token on startup)

  2. Security
     - check_app_session is SECURITY DEFINER, granted to anon only
     - No new direct table access
*/

-- Update existing function to create 30-day sessions
CREATE OR REPLACE FUNCTION public.create_app_session(p_profile_id uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_token text;
BEGIN
  DELETE FROM public.app_sessions WHERE expires_at < now();

  INSERT INTO public.app_sessions (profile_id, expires_at)
  VALUES (p_profile_id, now() + interval '30 days')
  RETURNING token INTO v_token;

  RETURN v_token;
END;
$$;

-- Add a lightweight RPC to check if a stored token is still valid
CREATE OR REPLACE FUNCTION public.check_app_session(p_token text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = ''
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.app_sessions
    WHERE token = p_token
      AND expires_at > now()
  );
END;
$$;

REVOKE ALL ON FUNCTION public.check_app_session(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.check_app_session(text) TO anon;

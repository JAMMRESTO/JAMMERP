/*
  # Add set_app_session RPC

  Provides a callable RPC that sets app.authenticated = 'true' for the
  current transaction/session, enabling RLS policies that check
  is_app_authenticated(). The client calls this once per Supabase client
  session after successful PIN login.

  Note: current_setting is transaction-scoped when using set_config with
  is_local=false in PostgREST (each HTTP request is its own transaction),
  so we use a signed token approach instead.

  Revised approach: store active session tokens in a table, and policies
  check for a valid token passed via request header (app.session_token).
*/

-- Create sessions table to track active PIN-authenticated sessions
CREATE TABLE IF NOT EXISTS public.app_sessions (
  token text PRIMARY KEY DEFAULT gen_random_uuid()::text,
  profile_id uuid NOT NULL,
  created_at timestamptz DEFAULT now(),
  expires_at timestamptz DEFAULT now() + interval '12 hours'
);

ALTER TABLE public.app_sessions ENABLE ROW LEVEL SECURITY;

-- Sessions are managed only via SECURITY DEFINER functions
-- No direct RLS access needed

-- Function to create a session after PIN auth (called right after authenticate_by_pin)
CREATE OR REPLACE FUNCTION public.create_app_session(p_profile_id uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_token text;
BEGIN
  -- Clean up expired sessions
  DELETE FROM public.app_sessions WHERE expires_at < now();

  INSERT INTO public.app_sessions (profile_id)
  VALUES (p_profile_id)
  RETURNING token INTO v_token;

  RETURN v_token;
END;
$$;
REVOKE ALL ON FUNCTION public.create_app_session(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_app_session(uuid) TO anon;

-- Function to validate a session token (used by RLS policies)
CREATE OR REPLACE FUNCTION public.is_valid_session(p_token text)
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
REVOKE ALL ON FUNCTION public.is_valid_session(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_valid_session(text) TO anon;
GRANT EXECUTE ON FUNCTION public.is_valid_session(text) TO authenticated;

-- Function to destroy a session (logout)
CREATE OR REPLACE FUNCTION public.destroy_app_session(p_token text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  DELETE FROM public.app_sessions WHERE token = p_token;
END;
$$;
REVOKE ALL ON FUNCTION public.destroy_app_session(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.destroy_app_session(text) TO anon;

-- Update is_app_authenticated to check the session token from request header
-- PostgREST passes custom headers as GUC settings: request.headers
CREATE OR REPLACE FUNCTION public.is_app_authenticated()
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = ''
AS $$
DECLARE
  v_token text;
BEGIN
  BEGIN
    v_token := current_setting('request.headers', true)::json->>'x-app-session';
  EXCEPTION WHEN OTHERS THEN
    RETURN false;
  END;

  IF v_token IS NULL OR v_token = '' THEN
    RETURN false;
  END IF;

  RETURN EXISTS (
    SELECT 1 FROM public.app_sessions
    WHERE token = v_token
      AND expires_at > now()
  );
END;
$$;
REVOKE ALL ON FUNCTION public.is_app_authenticated() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_app_authenticated() TO anon;
GRANT EXECUTE ON FUNCTION public.is_app_authenticated() TO authenticated;

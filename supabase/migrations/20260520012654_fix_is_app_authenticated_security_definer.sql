/*
  # Fix is_app_authenticated: use SECURITY DEFINER

  The function reads from app_sessions, but the RLS policy on app_sessions
  blocks anon from reading rows (USING false). As a result, the SELECT inside
  the function always returns 0 rows even for a valid token, so every RLS
  policy that calls is_app_authenticated() evaluates to false.

  Fix: mark the function SECURITY DEFINER so it runs with the privileges of
  its owner (postgres), bypassing the anon RLS restriction on app_sessions.
  The function itself is still safe because it only checks token existence.
*/

CREATE OR REPLACE FUNCTION public.is_app_authenticated()
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
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

-- Also fix is_valid_session for consistency
CREATE OR REPLACE FUNCTION public.is_valid_session(p_token text)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.app_sessions
    WHERE token = p_token
    AND expires_at > now()
  );
END;
$$;

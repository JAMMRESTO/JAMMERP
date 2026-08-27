/*
  # Fix remaining security issues

  1. Functions - Revoke execute from PUBLIC/authenticated where not needed
     - authenticate_by_pin: anon only (needed for login), revoke authenticated
     - create_app_session: anon only (called right after PIN login), revoke authenticated
     - destroy_app_session: anon only (logout with anon key), revoke authenticated
     - generate_numero_facture: anon only, already done
     - generate_numero_piece: anon only, already done
     - is_app_authenticated: internal RLS helper — revoke all direct API access
     - is_valid_session: internal helper — revoke all direct API access

  2. app_sessions table - Add RLS policies (currently RLS enabled but no policies)
     - No direct table access allowed; all access via SECURITY DEFINER functions only
*/

-- is_app_authenticated and is_valid_session are internal helpers used only by RLS policies
-- They must not be callable directly via /rest/v1/rpc
REVOKE ALL ON FUNCTION public.is_app_authenticated() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.is_app_authenticated() FROM anon;
REVOKE EXECUTE ON FUNCTION public.is_app_authenticated() FROM authenticated;

REVOKE ALL ON FUNCTION public.is_valid_session(text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.is_valid_session(text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.is_valid_session(text) FROM authenticated;

-- Grant execute only to postgres role so RLS policies can call them internally
GRANT EXECUTE ON FUNCTION public.is_app_authenticated() TO postgres;
GRANT EXECUTE ON FUNCTION public.is_valid_session(text) TO postgres;

-- authenticate_by_pin: anon only (login flow uses anon key)
REVOKE EXECUTE ON FUNCTION public.authenticate_by_pin(text) FROM authenticated;

-- create_app_session: anon only
REVOKE EXECUTE ON FUNCTION public.create_app_session(uuid) FROM authenticated;

-- destroy_app_session: anon only
REVOKE EXECUTE ON FUNCTION public.destroy_app_session(text) FROM authenticated;

-- generate_numero_facture / generate_numero_piece: anon only (already granted, ensure authenticated revoked)
REVOKE EXECUTE ON FUNCTION public.generate_numero_facture() FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.generate_numero_piece() FROM authenticated;

-- app_sessions: block all direct access; managed only via SECURITY DEFINER functions
-- A deny-all policy satisfies "RLS enabled no policy" while blocking everything
CREATE POLICY "No direct access to app_sessions"
  ON public.app_sessions FOR SELECT TO anon
  USING (false);

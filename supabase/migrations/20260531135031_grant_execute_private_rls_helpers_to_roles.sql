/*
  # Grant EXECUTE on private RLS helpers to anon and authenticated

  The functions exist in the private schema (not exposed by PostgREST via /rpc/)
  but RLS policies that call them still require the querying role to have
  EXECUTE permission. Without it, every policy that calls a private.* function
  silently fails, blocking all data access.

  Granting EXECUTE here does NOT re-expose them as REST endpoints — PostgREST
  only surfaces functions in the public schema.
*/

GRANT EXECUTE ON FUNCTION private.user_owns_site(uuid)    TO authenticated, anon;
GRANT EXECUTE ON FUNCTION private.auth_owns_tenant(uuid)  TO authenticated, anon;
GRANT EXECUTE ON FUNCTION private.is_tenant_owner(uuid)   TO authenticated, anon;
GRANT EXECUTE ON FUNCTION private.is_super_admin()        TO authenticated, anon;

/*
  # Fix user_owns_site() and is_super_admin() — SECURITY INVOKER

  ## Problem
  Both helper functions used in RLS policies were created with SECURITY DEFINER,
  causing them to run with the postgres owner's privileges instead of the calling
  user's context. This makes auth.uid() return NULL, so all owner/site isolation
  policies silently fail and return no data.

  ## Fix
  Recreate both functions as SECURITY INVOKER so auth.uid() correctly returns
  the authenticated user's ID when called from RLS policies.
*/

CREATE OR REPLACE FUNCTION is_super_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY INVOKER
AS $$
  SELECT EXISTS (
    SELECT 1 FROM super_admins WHERE id = auth.uid()
  )
$$;

CREATE OR REPLACE FUNCTION user_owns_site(p_site_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY INVOKER
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM sites s
    JOIN tenants t ON t.id = s.tenant_id
    WHERE s.id = p_site_id
    AND t.owner_id = auth.uid()
  )
$$;

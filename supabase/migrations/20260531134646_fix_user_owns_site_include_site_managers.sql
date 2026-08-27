/*
  # Fix user_owns_site to also grant access to site managers

  ## Problem
  private.user_owns_site() only checks if auth.uid() is the tenant owner.
  Site managers (who have their own Supabase Auth account) always got false
  because they are not the tenant owner — making all data tables invisible to them.

  ## Fix
  Extend user_owns_site() to return true if auth.uid() matches either:
  1. The tenant owner of the site (existing check), OR
  2. An active site manager assigned to that specific site
*/

CREATE OR REPLACE FUNCTION private.user_owns_site(p_site_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM sites s
    JOIN tenants t ON t.id = s.tenant_id
    WHERE s.id = p_site_id AND t.owner_id = auth.uid()
  )
  OR EXISTS (
    SELECT 1 FROM site_managers sm
    WHERE sm.site_id = p_site_id
      AND sm.id = auth.uid()
      AND sm.is_active = true
  )
$$;

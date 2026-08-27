/*
  # Fix user_owns_site to include cashier shared auth account

  ## Problem
  The shared cashier auth account (stored in sites.cashier_auth_user_id) is not
  recognized by user_owns_site(). This means authenticated cashier sessions cannot
  read products, categories, or any other site-scoped data protected by this helper.

  ## Fix
  Add a 4th check: if auth.uid() matches sites.cashier_auth_user_id for the given site.
*/

CREATE OR REPLACE FUNCTION user_owns_site(p_site_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, private
AS $$
  SELECT EXISTS (
    SELECT 1 FROM sites s JOIN tenants t ON t.id = s.tenant_id
    WHERE s.id = p_site_id AND t.owner_id = auth.uid()
  )
  OR EXISTS (
    SELECT 1 FROM site_managers sm
    WHERE sm.site_id = p_site_id AND sm.id = auth.uid() AND sm.is_active = true
  )
  OR EXISTS (
    SELECT 1 FROM users u
    WHERE u.site_id = p_site_id AND u.id = auth.uid() AND u.is_active = true
  )
  OR EXISTS (
    SELECT 1 FROM sites s
    WHERE s.id = p_site_id AND s.cashier_auth_user_id = auth.uid() AND s.is_active = true
  )
$$;

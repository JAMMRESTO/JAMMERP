/*
  # Fix sites RLS — bypass tenants RLS in sub-query

  The sites INSERT policy sub-queries the tenants table, which itself
  has RLS. When the tenants RLS policies call is_super_admin(), which
  queries super_admins, there is a chain of RLS evaluations that can
  fail silently for authenticated (non-super-admin) users.

  Fix: use a SECURITY DEFINER function to check tenant ownership
  that bypasses all RLS on the tenants table entirely.
*/

-- Recreate with SECURITY DEFINER to bypass tenants RLS
CREATE OR REPLACE FUNCTION auth_owns_tenant(p_tenant_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM tenants
    WHERE id = p_tenant_id
      AND owner_id = auth.uid()
  )
$$;

-- Rebuild sites policies using the bypass function
DROP POLICY IF EXISTS "sites_owner_select" ON sites;
DROP POLICY IF EXISTS "sites_owner_insert" ON sites;
DROP POLICY IF EXISTS "sites_owner_update" ON sites;
DROP POLICY IF EXISTS "sites_owner_delete" ON sites;

CREATE POLICY "sites_owner_select"
  ON sites FOR SELECT
  TO authenticated
  USING (auth_owns_tenant(tenant_id));

CREATE POLICY "sites_owner_insert"
  ON sites FOR INSERT
  TO authenticated
  WITH CHECK (auth_owns_tenant(tenant_id));

CREATE POLICY "sites_owner_update"
  ON sites FOR UPDATE
  TO authenticated
  USING  (auth_owns_tenant(tenant_id))
  WITH CHECK (auth_owns_tenant(tenant_id));

CREATE POLICY "sites_owner_delete"
  ON sites FOR DELETE
  TO authenticated
  USING (auth_owns_tenant(tenant_id));

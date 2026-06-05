/*
  # Fix sites INSERT RLS policy — use SECURITY DEFINER helper

  ## Problem
  The sites_owner_insert policy uses a sub-query on the tenants table.
  That sub-query itself goes through RLS on tenants, which calls is_super_admin(),
  which queries super_admins — causing potential indirect recursion or evaluation
  failures that silently block legitimate tenant owner inserts.

  ## Fix
  1. Make is_super_admin() SECURITY DEFINER so it bypasses RLS when called from
     within other RLS policies (safe because it only reads a simple lookup table).
  2. Drop and recreate sites_owner_insert with a cleaner check that avoids
     the nested RLS evaluation issue by using a SECURITY DEFINER helper function.
*/

-- Make is_super_admin SECURITY DEFINER to avoid RLS recursion when called from policies
CREATE OR REPLACE FUNCTION is_super_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM super_admins WHERE id = auth.uid()
  )
$$;

-- Helper: check tenant ownership without going through tenant RLS
CREATE OR REPLACE FUNCTION is_tenant_owner(p_tenant_id uuid)
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

-- Recreate sites INSERT policy using the SECURITY DEFINER helper
DROP POLICY IF EXISTS "sites_owner_insert" ON sites;

CREATE POLICY "sites_owner_insert"
  ON sites FOR INSERT
  TO authenticated
  WITH CHECK (is_tenant_owner(tenant_id));

-- Also fix sites UPDATE policy for the same reason
DROP POLICY IF EXISTS "sites_owner_update" ON sites;

CREATE POLICY "sites_owner_update"
  ON sites FOR UPDATE
  TO authenticated
  USING (is_tenant_owner(tenant_id))
  WITH CHECK (is_tenant_owner(tenant_id));

-- Also fix sites SELECT policy
DROP POLICY IF EXISTS "sites_owner_select" ON sites;

CREATE POLICY "sites_owner_select"
  ON sites FOR SELECT
  TO authenticated
  USING (is_tenant_owner(tenant_id));

-- Also fix sites DELETE policy
DROP POLICY IF EXISTS "sites_owner_delete" ON sites;

CREATE POLICY "sites_owner_delete"
  ON sites FOR DELETE
  TO authenticated
  USING (is_tenant_owner(tenant_id));

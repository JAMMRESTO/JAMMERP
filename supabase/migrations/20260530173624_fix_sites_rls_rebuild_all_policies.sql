/*
  # Fix sites RLS — drop all and recreate cleanly

  The is_tenant_owner() SECURITY DEFINER function is correct but Postgres
  may still fail if auth.uid() returns null (unauthenticated call) or if
  the function result is cached incorrectly across policy evaluations.

  This migration rebuilds all sites policies from scratch using inline
  SQL expressions (no function calls) to eliminate any indirection.
*/

-- Drop all existing sites policies
DROP POLICY IF EXISTS "sites_owner_insert"   ON sites;
DROP POLICY IF EXISTS "sites_owner_select"   ON sites;
DROP POLICY IF EXISTS "sites_owner_update"   ON sites;
DROP POLICY IF EXISTS "sites_owner_delete"   ON sites;
DROP POLICY IF EXISTS "sites_super_admin_insert" ON sites;
DROP POLICY IF EXISTS "sites_super_admin_select" ON sites;
DROP POLICY IF EXISTS "sites_super_admin_update" ON sites;
DROP POLICY IF EXISTS "sites_super_admin_delete" ON sites;
DROP POLICY IF EXISTS "sites_anon_select"    ON sites;

-- Re-enable RLS (in case it was toggled)
ALTER TABLE sites ENABLE ROW LEVEL SECURITY;

-- Anon: read active sites only
CREATE POLICY "sites_anon_select"
  ON sites FOR SELECT
  TO anon
  USING (is_active = true);

-- Authenticated owner: select own tenant's sites
CREATE POLICY "sites_owner_select"
  ON sites FOR SELECT
  TO authenticated
  USING (
    tenant_id IN (
      SELECT id FROM tenants WHERE owner_id = auth.uid()
    )
  );

-- Authenticated owner: insert site for own tenant
CREATE POLICY "sites_owner_insert"
  ON sites FOR INSERT
  TO authenticated
  WITH CHECK (
    tenant_id IN (
      SELECT id FROM tenants WHERE owner_id = auth.uid()
    )
  );

-- Authenticated owner: update own sites
CREATE POLICY "sites_owner_update"
  ON sites FOR UPDATE
  TO authenticated
  USING (
    tenant_id IN (
      SELECT id FROM tenants WHERE owner_id = auth.uid()
    )
  )
  WITH CHECK (
    tenant_id IN (
      SELECT id FROM tenants WHERE owner_id = auth.uid()
    )
  );

-- Authenticated owner: delete own sites
CREATE POLICY "sites_owner_delete"
  ON sites FOR DELETE
  TO authenticated
  USING (
    tenant_id IN (
      SELECT id FROM tenants WHERE owner_id = auth.uid()
    )
  );

-- Super admin: full access
CREATE POLICY "sites_super_admin_select"
  ON sites FOR SELECT
  TO authenticated
  USING (is_super_admin());

CREATE POLICY "sites_super_admin_insert"
  ON sites FOR INSERT
  TO authenticated
  WITH CHECK (is_super_admin());

CREATE POLICY "sites_super_admin_update"
  ON sites FOR UPDATE
  TO authenticated
  USING (is_super_admin())
  WITH CHECK (is_super_admin());

CREATE POLICY "sites_super_admin_delete"
  ON sites FOR DELETE
  TO authenticated
  USING (is_super_admin());

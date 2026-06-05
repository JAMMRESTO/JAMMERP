/*
  # Fix RLS circular recursion — rebuild all helper functions as SECURITY DEFINER

  ## Root cause
  user_owns_site() does a JOIN on sites+tenants. The sites table has its own
  RLS policies that call auth_owns_tenant(), which reads tenants (also with RLS),
  which calls is_super_admin(), which reads super_admins. This creates a chain
  of nested RLS evaluations that Postgres aborts, causing the misleading
  "violates row-level security policy for table sites" error.

  ## Fix
  All three helper functions must be SECURITY DEFINER and bypass RLS entirely.
  They already check auth.uid() so they are safe.
*/

-- Rebuild user_owns_site as SECURITY DEFINER (bypasses RLS on sites+tenants)
CREATE OR REPLACE FUNCTION public.user_owns_site(p_site_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM sites s
    JOIN tenants t ON t.id = s.tenant_id
    WHERE s.id = p_site_id
      AND t.owner_id = auth.uid()
  )
$$;

-- Rebuild auth_owns_tenant as SECURITY DEFINER (already was, keep consistent)
CREATE OR REPLACE FUNCTION public.auth_owns_tenant(p_tenant_id uuid)
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

-- Rebuild is_tenant_owner as SECURITY DEFINER
CREATE OR REPLACE FUNCTION public.is_tenant_owner(p_tenant_id uuid)
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

-- Rebuild is_super_admin as SECURITY DEFINER (already was)
CREATE OR REPLACE FUNCTION public.is_super_admin()
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

-- Also fix users and roles policies that use inline sub-queries on tenants
-- (same recursion risk). Replace with auth_owns_tenant() SECURITY DEFINER.

DROP POLICY IF EXISTS "users_owner_select"  ON users;
DROP POLICY IF EXISTS "users_owner_insert"  ON users;
DROP POLICY IF EXISTS "users_owner_update"  ON users;
DROP POLICY IF EXISTS "users_owner_delete"  ON users;

CREATE POLICY "users_owner_select" ON users FOR SELECT TO authenticated
  USING (tenant_id IS NULL OR auth_owns_tenant(tenant_id));

CREATE POLICY "users_owner_insert" ON users FOR INSERT TO authenticated
  WITH CHECK (tenant_id IS NULL OR auth_owns_tenant(tenant_id));

CREATE POLICY "users_owner_update" ON users FOR UPDATE TO authenticated
  USING  (tenant_id IS NULL OR auth_owns_tenant(tenant_id))
  WITH CHECK (tenant_id IS NULL OR auth_owns_tenant(tenant_id));

CREATE POLICY "users_owner_delete" ON users FOR DELETE TO authenticated
  USING (tenant_id IS NULL OR auth_owns_tenant(tenant_id));

DROP POLICY IF EXISTS "roles_owner_select" ON roles;
DROP POLICY IF EXISTS "roles_owner_insert" ON roles;
DROP POLICY IF EXISTS "roles_owner_update" ON roles;

CREATE POLICY "roles_owner_select" ON roles FOR SELECT TO authenticated
  USING (tenant_id IS NULL OR auth_owns_tenant(tenant_id));

CREATE POLICY "roles_owner_insert" ON roles FOR INSERT TO authenticated
  WITH CHECK (tenant_id IS NULL OR auth_owns_tenant(tenant_id));

CREATE POLICY "roles_owner_update" ON roles FOR UPDATE TO authenticated
  USING  (tenant_id IS NULL OR auth_owns_tenant(tenant_id))
  WITH CHECK (tenant_id IS NULL OR auth_owns_tenant(tenant_id));

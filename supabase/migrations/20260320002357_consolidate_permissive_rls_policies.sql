/*
  # Consolidate multiple permissive RLS policies

  ## Summary
  Multiple permissive policies for the same role+action combination cause Postgres
  to evaluate all of them and grant access if ANY passes. This is functionally
  correct but triggers a security advisory. We consolidate each set into a single
  policy using OR logic so the intent is explicit and the warning is resolved.

  ## Tables affected
  - companies: SELECT (2 → 1), UPDATE (2 → 1)
  - profiles: SELECT (2 → 1), UPDATE (2 → 1)
  - roles: SELECT (2 → 1), INSERT (3 → 1), UPDATE (3 → 1), DELETE (3 → 1)
*/

-- ============================================================
-- companies
-- ============================================================

DROP POLICY IF EXISTS "Company members can view company" ON public.companies;
DROP POLICY IF EXISTS "Superadmin can view all companies" ON public.companies;

CREATE POLICY "View company"
  ON public.companies
  FOR SELECT
  TO authenticated
  USING (
    id = get_my_company_id()
    OR get_my_role() = 'superadmin'
  );

DROP POLICY IF EXISTS "Company admins and managers can manage company" ON public.companies;
DROP POLICY IF EXISTS "Superadmin can update all companies" ON public.companies;

CREATE POLICY "Update company"
  ON public.companies
  FOR UPDATE
  TO authenticated
  USING (
    (id = get_my_company_id() AND get_my_role() = ANY (ARRAY['admin','manager']))
    OR get_my_role() = 'superadmin'
  )
  WITH CHECK (
    (id = get_my_company_id() AND get_my_role() = ANY (ARRAY['admin','manager']))
    OR get_my_role() = 'superadmin'
  );

-- ============================================================
-- profiles
-- ============================================================

DROP POLICY IF EXISTS "Users can read own profile" ON public.profiles;
DROP POLICY IF EXISTS "Superadmin can view all profiles" ON public.profiles;

CREATE POLICY "View profile"
  ON public.profiles
  FOR SELECT
  TO authenticated
  USING (
    id = (SELECT auth.uid())
    OR is_superadmin()
  );

DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
DROP POLICY IF EXISTS "Superadmin can update all profiles" ON public.profiles;

CREATE POLICY "Update profile"
  ON public.profiles
  FOR UPDATE
  TO authenticated
  USING (
    id = (SELECT auth.uid())
    OR is_superadmin()
  )
  WITH CHECK (
    id = (SELECT auth.uid())
    OR is_superadmin()
  );

-- ============================================================
-- roles
-- ============================================================

DROP POLICY IF EXISTS "Company members can select roles" ON public.roles;
DROP POLICY IF EXISTS "Superadmin can select all roles" ON public.roles;

CREATE POLICY "View roles"
  ON public.roles
  FOR SELECT
  TO authenticated
  USING (
    company_id = get_my_company_id()
    OR is_superadmin()
  );

DROP POLICY IF EXISTS "Company admins can insert roles" ON public.roles;
DROP POLICY IF EXISTS "Company members can insert roles" ON public.roles;
DROP POLICY IF EXISTS "Superadmin can insert roles" ON public.roles;

CREATE POLICY "Insert roles"
  ON public.roles
  FOR INSERT
  TO authenticated
  WITH CHECK (
    (company_id = get_my_company_id() AND get_my_role() = ANY (ARRAY['admin','manager']))
    OR is_superadmin()
  );

DROP POLICY IF EXISTS "Company admins can update roles" ON public.roles;
DROP POLICY IF EXISTS "Company members can update roles" ON public.roles;
DROP POLICY IF EXISTS "Superadmin can update roles" ON public.roles;

CREATE POLICY "Update roles"
  ON public.roles
  FOR UPDATE
  TO authenticated
  USING (
    (company_id = get_my_company_id() AND get_my_role() = ANY (ARRAY['admin','manager']))
    OR is_superadmin()
  )
  WITH CHECK (
    (company_id = get_my_company_id() AND get_my_role() = ANY (ARRAY['admin','manager']))
    OR is_superadmin()
  );

DROP POLICY IF EXISTS "Company admins can delete roles" ON public.roles;
DROP POLICY IF EXISTS "Company members can delete roles" ON public.roles;
DROP POLICY IF EXISTS "Superadmin can delete roles" ON public.roles;

CREATE POLICY "Delete roles"
  ON public.roles
  FOR DELETE
  TO authenticated
  USING (
    (company_id = get_my_company_id() AND get_my_role() = ANY (ARRAY['admin','manager']))
    OR is_superadmin()
  );

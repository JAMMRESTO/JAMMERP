/*
  # Fix super_admins RLS circular reference

  ## Problem
  The SELECT policy on super_admins uses EXISTS (SELECT 1 FROM super_admins ...)
  which creates a circular dependency: to read super_admins you need to already
  be able to read super_admins. This causes is_super_admin() to always return
  false for authenticated users, breaking all super admin RLS policies.

  ## Fix
  Replace the circular policy with a direct auth.uid() = id check so a user
  can only read their own row without any recursive lookup.
*/

DROP POLICY IF EXISTS "super_admins_select" ON super_admins;

CREATE POLICY "super_admins_select"
  ON super_admins FOR SELECT
  TO authenticated
  USING (auth.uid() = id);

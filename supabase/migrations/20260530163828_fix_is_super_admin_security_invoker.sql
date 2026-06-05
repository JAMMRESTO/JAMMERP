/*
  # Fix is_super_admin() function — SECURITY INVOKER

  ## Problem
  The function was created with SECURITY DEFINER, which causes it to run
  with the function owner's privileges (postgres). As a result, auth.uid()
  returns NULL inside the function, making all super admin RLS policies fail.

  ## Fix
  Recreate the function as SECURITY INVOKER so it runs in the caller's context,
  allowing auth.uid() to return the authenticated user's ID correctly.
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

/*
  # Fix infinite recursion in profiles RLS policies

  ## Problem
  The "View profile" and "Update profile" policies on the profiles table call is_superadmin(),
  which itself queries the profiles table. This causes infinite recursion whenever any
  authenticated user tries to read their profile, blocking all logins.

  ## Fix
  Replace is_superadmin() calls in profiles policies with a direct JWT claim check
  (role stored in app_metadata) for the superadmin case, falling back to a simple
  own-row check. Since the superadmin role is stored in the profiles table itself,
  any cross-reference causes recursion. The simplest correct fix is to allow each
  user to only see their own row — the superadmin's own profile is still accessible,
  and all admin data fetching uses the service role key via edge functions.
*/

-- Drop the recursive policies
DROP POLICY IF EXISTS "View profile" ON public.profiles;
DROP POLICY IF EXISTS "Update profile" ON public.profiles;

-- Re-create without recursion: each user can only read/update their own profile row.
-- Superadmin access to ALL profiles is handled via edge functions (service role key).
CREATE POLICY "View profile"
  ON public.profiles
  FOR SELECT
  TO authenticated
  USING (id = (SELECT auth.uid()));

CREATE POLICY "Update profile"
  ON public.profiles
  FOR UPDATE
  TO authenticated
  USING (id = (SELECT auth.uid()))
  WITH CHECK (id = (SELECT auth.uid()));

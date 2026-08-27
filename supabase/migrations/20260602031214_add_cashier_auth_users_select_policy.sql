/*
  # Allow cashier auth account to read users of their site

  ## Problem
  AuthContext.loadUsers queries public.users filtered by site_id.
  The shared cashier auth account (cashier_auth_user_id) has no existing
  policy that lets it read staff users for its site.

  ## Solution
  Add SELECT policy on users for authenticated users whose auth.uid()
  matches their site's cashier_auth_user_id.
*/

CREATE POLICY "Cashier auth account can read own site users"
  ON public.users
  FOR SELECT
  TO authenticated
  USING (
    site_id IS NOT NULL
    AND site_id = private.get_cashier_site_id()
  );

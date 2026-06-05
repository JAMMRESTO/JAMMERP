/*
  # Allow cashier shared auth account to read their site

  ## Problem
  When a cashier logs in using the shared auth account (cashier_auth_user_id),
  initUser needs to query sites by cashier_auth_user_id. No existing RLS policy
  covers this for authenticated users.

  ## Solution
  Add a SELECT policy on sites for authenticated users whose auth.uid()
  matches the site's cashier_auth_user_id.
*/

CREATE POLICY "Cashier auth account can read own site"
  ON public.sites
  FOR SELECT
  TO authenticated
  USING (cashier_auth_user_id = auth.uid());

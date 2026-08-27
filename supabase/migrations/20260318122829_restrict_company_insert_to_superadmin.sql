/*
  # Restrict company creation to superadmin only

  1. Security Changes
    - Remove the old "Users can insert company on signup" policy (WITH CHECK true) 
      which allowed any authenticated user to create companies
    - Add new INSERT policy restricted to superadmin role only
    - This ensures only the superadmin can create new companies

  2. Notes
    - The admin-create-company edge function uses service_role_key so it bypasses RLS,
      but this locks down direct DB access too
    - Self-registration is no longer allowed
*/

DROP POLICY IF EXISTS "Users can insert company on signup" ON companies;

CREATE POLICY "Superadmin can insert companies"
  ON companies
  FOR INSERT
  TO authenticated
  WITH CHECK (get_my_role() = 'superadmin');

/*
  # Allow admin users to view and manage all companies

  1. Security Changes
    - Add SELECT policy on `companies` for admin-role users to view all companies
    - Add UPDATE policy on `companies` for admin-role users to manage all companies (toggle active, update plans)
  
  2. Notes
    - Only authenticated users with role 'admin' in their profile can access all companies
    - Regular users still only see their own company via the existing policy
*/

CREATE POLICY "Admins can view all companies"
  ON companies
  FOR SELECT
  TO authenticated
  USING (get_my_role() = 'admin');

CREATE POLICY "Admins can update all companies"
  ON companies
  FOR UPDATE
  TO authenticated
  USING (get_my_role() = 'admin')
  WITH CHECK (get_my_role() = 'admin');

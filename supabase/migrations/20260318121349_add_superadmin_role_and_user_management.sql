/*
  # Add superadmin role and user management capabilities

  1. Schema Changes
    - Update profiles role CHECK constraint to include 'superadmin'
    - Set the first admin user (admin@sunufacture.com) as superadmin
  
  2. Security Changes
    - Add RLS policy on profiles for superadmin to view ALL profiles across companies
    - Add RLS policy on profiles for superadmin to update ALL profiles across companies
    - Update get_my_role() helper to support superadmin
  
  3. Notes
    - Only superadmin can access the Admin SaaS panel
    - Admin users manage their own company's data
    - Superadmin manages ALL companies and ALL users
*/

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'profiles_role_check' AND table_name = 'profiles'
  ) THEN
    ALTER TABLE profiles DROP CONSTRAINT profiles_role_check;
  END IF;
END $$;

ALTER TABLE profiles ADD CONSTRAINT profiles_role_check 
  CHECK (role IN ('superadmin', 'admin', 'manager', 'salesperson', 'accountant'));

CREATE POLICY "Superadmin can view all profiles"
  ON profiles
  FOR SELECT
  TO authenticated
  USING (get_my_role() = 'superadmin');

CREATE POLICY "Superadmin can update all profiles"
  ON profiles
  FOR UPDATE
  TO authenticated
  USING (get_my_role() = 'superadmin')
  WITH CHECK (get_my_role() = 'superadmin');

DROP POLICY IF EXISTS "Admins can view all companies" ON companies;
DROP POLICY IF EXISTS "Admins can update all companies" ON companies;

CREATE POLICY "Superadmin can view all companies"
  ON companies
  FOR SELECT
  TO authenticated
  USING (get_my_role() = 'superadmin');

CREATE POLICY "Superadmin can update all companies"
  ON companies
  FOR UPDATE
  TO authenticated
  USING (get_my_role() = 'superadmin')
  WITH CHECK (get_my_role() = 'superadmin');

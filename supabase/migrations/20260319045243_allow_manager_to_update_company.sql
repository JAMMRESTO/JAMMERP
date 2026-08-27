/*
  # Allow managers to update their own company settings

  1. Changes
    - Update the "Company admins can manage company" RLS policy on the companies table
    - Now allows both admin AND manager roles to update company settings (logo, info, TVA, modules)
    - Superadmin policy remains unchanged (can update all companies)

  2. Security
    - Users can only update their own company (id = get_my_company_id())
    - Only admin and manager system roles are allowed
    - Other roles (salesperson, accountant) remain read-only

  3. Notes
    - This enables managers with "parametres" permission to upload logos and save company settings
*/

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'companies' AND policyname = 'Company admins can manage company'
  ) THEN
    DROP POLICY "Company admins can manage company" ON companies;
  END IF;
END $$;

CREATE POLICY "Company admins and managers can manage company"
  ON companies
  FOR UPDATE
  TO authenticated
  USING (
    id = get_my_company_id()
    AND get_my_role() IN ('admin', 'manager')
  )
  WITH CHECK (
    id = get_my_company_id()
    AND get_my_role() IN ('admin', 'manager')
  );

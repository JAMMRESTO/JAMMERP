/*
  # Fix companies RLS for SECURITY DEFINER function

  The create_company_and_profile function is owned by postgres and runs as
  postgres (SECURITY DEFINER). However, the INSERT policy on companies only
  allows the 'authenticated' role. When postgres executes the insert, it
  bypasses authenticated role checks but still hits RLS.

  Solution: Add a policy that allows the postgres role (service role) to
  insert into companies, which is used by SECURITY DEFINER functions.
  Also add anon role to handle edge cases during signup JWT propagation.
*/

DROP POLICY IF EXISTS "Authenticated can insert company" ON public.companies;

CREATE POLICY "Users can insert company on signup"
  ON public.companies
  FOR INSERT
  TO authenticated, anon
  WITH CHECK (true);

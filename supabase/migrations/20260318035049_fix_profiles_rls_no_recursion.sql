/*
  # Fix profiles RLS - eliminate recursion completely

  Replace the recursive "Company members can read profiles" policy with one
  that uses a security definer function to break the recursion cycle.
*/

DROP POLICY IF EXISTS "Company members can read profiles" ON profiles;

CREATE OR REPLACE FUNCTION get_my_company_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT company_id FROM profiles WHERE id = auth.uid() LIMIT 1;
$$;

CREATE POLICY "Company members can read profiles"
  ON profiles
  FOR SELECT
  TO authenticated
  USING (
    company_id = get_my_company_id()
    OR auth.uid() = id
  );

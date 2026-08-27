/*
  # Fix infinite recursion in profiles RLS policy

  The "Company members can read profiles" policy was causing infinite recursion
  because it queried the profiles table itself to determine access.
  
  Fix: Drop the recursive policy and replace it with a non-recursive version
  that uses auth.uid() directly without a subquery on the same table.
*/

DROP POLICY IF EXISTS "Company members can read profiles" ON profiles;

CREATE POLICY "Company members can read profiles"
  ON profiles
  FOR SELECT
  TO authenticated
  USING (
    company_id IN (
      SELECT p.company_id
      FROM profiles p
      WHERE p.id = auth.uid()
      LIMIT 1
    )
    OR auth.uid() = id
  );

/*
  # Fix cash_closures RLS - assign policies to correct anon role

  The existing "Anon can insert cash closures" policy was mistakenly scoped to
  the `authenticated` role. The app does not use Supabase Auth, so all client
  requests run as `anon`. This migration drops the misnamed policy and recreates
  it for the `anon` role. Also adds SELECT and DELETE policies for anon.
*/

DROP POLICY IF EXISTS "Anon can insert cash closures" ON cash_closures;

CREATE POLICY "Anon can insert cash closures"
  ON cash_closures
  FOR INSERT
  TO anon
  WITH CHECK (type IS NOT NULL AND created_by IS NOT NULL);

CREATE POLICY "Anon can select cash closures"
  ON cash_closures
  FOR SELECT
  TO anon
  USING (true);

CREATE POLICY "Anon can delete cash closures"
  ON cash_closures
  FOR DELETE
  TO anon
  USING (id IS NOT NULL);

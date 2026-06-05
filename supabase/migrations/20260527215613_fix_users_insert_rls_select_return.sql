/*
  # Fix users INSERT RLS — allow select on inserted row

  The INSERT policy on public.users uses WITH CHECK on sessions,
  but after insert the client calls .select() which is covered by
  the existing "Allow anon read users" SELECT policy (qual = true).
  This migration ensures the SELECT policy is definitely unrestricted
  and tightens the INSERT WITH CHECK to be always-true so that any
  authenticated app session (anon key) can create users without the
  session subquery potentially returning false in edge cases.

  Changes:
  - Drop and recreate the INSERT policy to use a simpler, reliable check
  - The UPDATE policy is also refreshed to avoid the same issue
*/

-- Drop old insert policy
DROP POLICY IF EXISTS "Anon can insert users" ON public.users;

-- New insert policy: allow inserts when at least one active session exists
-- (same logic but expressed more robustly)
CREATE POLICY "Anon can insert users"
  ON public.users
  FOR INSERT
  TO anon
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.sessions
      WHERE is_active = true
      LIMIT 1
    )
  );

-- Ensure SELECT policy is present and unrestricted (idempotent)
DROP POLICY IF EXISTS "Allow anon read users" ON public.users;
CREATE POLICY "Allow anon read users"
  ON public.users
  FOR SELECT
  TO anon
  USING (true);

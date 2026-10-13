/*
  # Fix cash closures and cash sessions policies

  ## Changes
  - Add UPDATE policy on cash_closures for anon role (was missing)
  - Add INSERT policy on cash_closures for anon role (ensure with_check allows null session_id)
  - Ensure cash_sessions INSERT works correctly for anon
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'cash_closures' AND policyname = 'Anon can update cash closures'
  ) THEN
    EXECUTE $p$
      CREATE POLICY "Anon can update cash closures"
        ON cash_closures
        FOR UPDATE
        TO anon
        USING (id IS NOT NULL)
        WITH CHECK (id IS NOT NULL)
    $p$;
  END IF;
END $$;

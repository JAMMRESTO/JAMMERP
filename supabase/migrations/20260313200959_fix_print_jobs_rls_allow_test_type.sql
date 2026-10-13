/*
  # Fix print_jobs RLS to allow TEST type

  1. Changes
    - Updates the INSERT and UPDATE policies on print_jobs to also allow the 'TEST' type
    - Previously only INITIAL, ADDONS, BILL were allowed, which blocked test print jobs

  2. Security
    - Still restricted to known print job types only
*/

DROP POLICY IF EXISTS "Anon can insert print_jobs" ON print_jobs;
CREATE POLICY "Anon can insert print_jobs"
  ON print_jobs FOR INSERT
  TO anon
  WITH CHECK (type = ANY (ARRAY['INITIAL', 'ADDONS', 'BILL', 'TEST']));

DROP POLICY IF EXISTS "Anon can update print_jobs" ON print_jobs;
CREATE POLICY "Anon can update print_jobs"
  ON print_jobs FOR UPDATE
  TO anon
  USING (id IS NOT NULL)
  WITH CHECK (type = ANY (ARRAY['INITIAL', 'ADDONS', 'BILL', 'TEST']));

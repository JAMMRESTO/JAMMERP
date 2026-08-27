/*
  # Add REPORT_X and REPORT_Z print job types

  1. Changes
    - Extend print_jobs INSERT and UPDATE policies to accept REPORT_X and REPORT_Z types
    - These new types are used for cash closure reports to distinguish from TEST prints

  2. Why
    - The previous policy only allowed: INITIAL, ADDONS, BILL, TEST
    - X-report (Rapport X) and Z-closure (Clôture Z) jobs now use dedicated types
    - This allows filtering/auditing of financial report print jobs separately
*/

DROP POLICY IF EXISTS "Anon can insert print_jobs" ON print_jobs;
DROP POLICY IF EXISTS "Anon can update print_jobs" ON print_jobs;

CREATE POLICY "Anon can insert print_jobs"
  ON print_jobs FOR INSERT
  TO anon
  WITH CHECK (type = ANY (ARRAY['INITIAL', 'ADDONS', 'BILL', 'TEST', 'REPORT_X', 'REPORT_Z']));

CREATE POLICY "Anon can update print_jobs"
  ON print_jobs FOR UPDATE
  TO anon
  USING (id IS NOT NULL)
  WITH CHECK (type = ANY (ARRAY['INITIAL', 'ADDONS', 'BILL', 'TEST', 'REPORT_X', 'REPORT_Z']));

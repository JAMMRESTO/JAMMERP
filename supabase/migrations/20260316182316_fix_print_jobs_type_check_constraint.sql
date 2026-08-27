/*
  # Fix print_jobs type CHECK constraint to allow REPORT_X and REPORT_Z

  ## Problem
  The CHECK constraint on print_jobs.type only allows:
    INITIAL, ADDONS, BILL, TEST

  The previous migration (20260313230543) updated RLS policies but forgot
  to update the CHECK constraint itself, causing REPORT_X and REPORT_Z
  inserts to fail at the database level.

  ## Changes
  - Drop the existing type CHECK constraint
  - Add a new constraint that includes REPORT_X and REPORT_Z
*/

ALTER TABLE print_jobs
  DROP CONSTRAINT IF EXISTS print_jobs_type_check;

ALTER TABLE print_jobs
  ADD CONSTRAINT print_jobs_type_check
  CHECK (type = ANY (ARRAY['INITIAL'::text, 'ADDONS'::text, 'BILL'::text, 'TEST'::text, 'REPORT_X'::text, 'REPORT_Z'::text]));

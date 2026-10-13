/*
# Add RECEIPT print job type

1. Purpose
   - Distinguish the cash receipt ("TICKET DE CAISSE") printed after payment
     from the addition ("ADDITION") printed before payment.
   - Adds a new `RECEIPT` value to the `print_jobs.type` CHECK constraint.

2. Schema changes
   - `print_jobs.type`: CHECK constraint now allows 7 values:
     INITIAL, ADDONS, BILL, RECEIPT, TEST, REPORT_X, REPORT_Z.

3. Security changes
   - Update the INSERT and UPDATE RLS policies on `print_jobs` to allow the
     new `RECEIPT` type alongside the existing 6 types. SELECT and DELETE
     policies are unchanged (they are not type-scoped).

4. Notes
   - No data is modified or deleted; existing rows remain valid.
   - Idempotent: drops and recreates the constraint and the two policies.
*/

ALTER TABLE public.print_jobs DROP CONSTRAINT IF EXISTS print_jobs_type_check;

ALTER TABLE public.print_jobs
  ADD CONSTRAINT print_jobs_type_check
  CHECK (type = ANY (ARRAY[
    'INITIAL'::text,
    'ADDONS'::text,
    'BILL'::text,
    'RECEIPT'::text,
    'TEST'::text,
    'REPORT_X'::text,
    'REPORT_Z'::text
  ]));

DROP POLICY IF EXISTS "Anon can insert print_jobs" ON public.print_jobs;
CREATE POLICY "Anon can insert print_jobs" ON public.print_jobs
  FOR INSERT TO anon, authenticated
  WITH CHECK (type = ANY (ARRAY['INITIAL', 'ADDONS', 'BILL', 'RECEIPT', 'TEST', 'REPORT_X', 'REPORT_Z']));

DROP POLICY IF EXISTS "Anon can update print_jobs" ON public.print_jobs;
CREATE POLICY "Anon can update print_jobs" ON public.print_jobs
  FOR UPDATE TO anon, authenticated
  USING (id IS NOT NULL)
  WITH CHECK (type = ANY (ARRAY['INITIAL', 'ADDONS', 'BILL', 'RECEIPT', 'TEST', 'REPORT_X', 'REPORT_Z']));

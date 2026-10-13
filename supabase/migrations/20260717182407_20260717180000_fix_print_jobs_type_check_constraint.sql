-- Fix print_jobs type CHECK constraint to include REPORT_X and REPORT_Z
-- The TypeScript type PrintJobType includes 6 values but the DB constraint only allowed 4,
-- silently blocking any REPORT_X or REPORT_Z job inserts.

ALTER TABLE public.print_jobs DROP CONSTRAINT IF EXISTS print_jobs_type_check;

ALTER TABLE public.print_jobs
  ADD CONSTRAINT print_jobs_type_check
  CHECK (type = ANY (ARRAY[
    'INITIAL'::text,
    'ADDONS'::text,
    'BILL'::text,
    'TEST'::text,
    'REPORT_X'::text,
    'REPORT_Z'::text
  ]));

-- Also update the RLS INSERT/UPDATE policies to allow all 6 types
DROP POLICY IF EXISTS "Anon can insert print_jobs" ON public.print_jobs;
CREATE POLICY "Anon can insert print_jobs" ON public.print_jobs
  FOR INSERT TO anon, authenticated
  WITH CHECK (type = ANY (ARRAY['INITIAL', 'ADDONS', 'BILL', 'TEST', 'REPORT_X', 'REPORT_Z']));

DROP POLICY IF EXISTS "Anon can update print_jobs" ON public.print_jobs;
CREATE POLICY "Anon can update print_jobs" ON public.print_jobs
  FOR UPDATE TO anon, authenticated
  USING (id IS NOT NULL)
  WITH CHECK (type = ANY (ARRAY['INITIAL', 'ADDONS', 'BILL', 'TEST', 'REPORT_X', 'REPORT_Z']));

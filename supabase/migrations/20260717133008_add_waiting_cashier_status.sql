ALTER TABLE print_jobs DROP CONSTRAINT IF EXISTS print_jobs_status_check;

ALTER TABLE print_jobs
  ADD CONSTRAINT print_jobs_status_check
  CHECK (status = ANY (ARRAY[
    'PENDING'::text,
    'PRINTING'::text,
    'SUCCESS'::text,
    'DONE'::text,
    'FAILED'::text,
    'WAITING_CASHIER'::text
  ]));
/*
# Harden print relay claims and retries

1. Purpose
- Make the local print relay the reliable owner of network print jobs.
- Clear stale errors when a pending job is claimed.
- Increment the existing retry counter atomically whenever a relay claims a job.

2. Modified objects
- `public.claim_print_job(uuid)` updates `print_jobs.retries` and clears `last_error` while changing a pending job to `PRINTING`.
- No tables, columns, or stored print data are removed or renamed.

3. Security
- The function remains `SECURITY DEFINER` with `search_path = public` so the relay can atomically claim a job despite row-level policies.
- The update only affects the exact job supplied when its current status is `PENDING`.
- Competing relay processes receive no row for an already claimed job, preventing duplicate claims.

4. Important notes
- Existing retry values are preserved and incremented from their current value.
- The local relay decides when a failed job should return to `PENDING` and when it should become `FAILED`.
*/

CREATE OR REPLACE FUNCTION public.claim_print_job(p_job_id uuid)
RETURNS SETOF public.print_jobs
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE public.print_jobs
  SET status = 'PRINTING',
      retries = COALESCE(retries, 0) + 1,
      last_error = NULL
  WHERE id = p_job_id
    AND status = 'PENDING'
  RETURNING *;
$$;
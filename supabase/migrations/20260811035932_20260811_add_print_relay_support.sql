/*
# Add Print Relay Support

## Summary
Adds infrastructure so a Windows PC on the local restaurant network can act
as an automatic relay: it claims PENDING print jobs atomically, sends them
via TCP to local printers, and reports a heartbeat so the app can show whether
the relay is online.

## Changes

### printers table
- `relay_last_seen` (timestamptz, nullable) — updated by the relay every poll cycle.
  If it was updated in the last 90 seconds the relay is considered online.

### New function: claim_print_job(job_id uuid)
SECURITY DEFINER function that atomically flips a PENDING job to PRINTING and
returns the job row (including payload). Racing callers get a null return if
the job was already claimed, preventing duplicate prints.

### Cleanup
Jobs stuck in PRINTING status for more than 5 minutes are reset to PENDING so
they can be retried by the relay.
*/

-- 1. Add relay heartbeat column to printers
ALTER TABLE printers
  ADD COLUMN IF NOT EXISTS relay_last_seen timestamptz;

-- 2. Atomic claim function — prevents two relay instances printing the same job
CREATE OR REPLACE FUNCTION public.claim_print_job(p_job_id uuid)
RETURNS SETOF print_jobs
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE print_jobs
  SET status = 'PRINTING'
  WHERE id = p_job_id
    AND status = 'PENDING'
  RETURNING *;
$$;

-- 3. Reset jobs that have been stuck in PRINTING for more than 5 minutes
UPDATE print_jobs
SET status = 'PENDING', last_error = 'Reset after relay restart'
WHERE status = 'PRINTING'
  AND created_at < now() - interval '5 minutes';

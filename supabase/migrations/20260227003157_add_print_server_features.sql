/*
  # Print Server Features

  ## Summary
  Adds infrastructure for a dedicated print server (PC caisse) that polls and processes print jobs.

  ## Changes

  ### print_jobs table
  - `client_request_id` (text, unique, nullable) — idempotency key to prevent duplicate jobs
    A caller generates a UUID before inserting; the DB UNIQUE constraint prevents doubles.
  - `server_id` (text, nullable) — identifier of the print server instance that claimed this job
    Allows multiple print servers without conflict (first to claim wins).

  ### printers table
  - `backup_printer_id` (uuid, nullable, FK → printers.id) — fallback printer when primary fails
    If the main printer is unreachable after max retries, the job is cloned to the backup.

  ## Security
  Existing RLS policies on print_jobs and printers remain unchanged.
  No new tables, no data loss.
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'print_jobs' AND column_name = 'client_request_id'
  ) THEN
    ALTER TABLE print_jobs ADD COLUMN client_request_id text DEFAULT NULL;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE tablename = 'print_jobs' AND indexname = 'print_jobs_client_request_id_unique'
  ) THEN
    CREATE UNIQUE INDEX print_jobs_client_request_id_unique
      ON print_jobs (client_request_id)
      WHERE client_request_id IS NOT NULL;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'print_jobs' AND column_name = 'server_id'
  ) THEN
    ALTER TABLE print_jobs ADD COLUMN server_id text DEFAULT NULL;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'printers' AND column_name = 'backup_printer_id'
  ) THEN
    ALTER TABLE printers ADD COLUMN backup_printer_id uuid DEFAULT NULL
      REFERENCES printers(id) ON DELETE SET NULL;
  END IF;
END $$;

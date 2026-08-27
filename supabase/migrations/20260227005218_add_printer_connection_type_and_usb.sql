/*
  # Printers v2 — connection_type, usb_name, station column + PrintJobs fixes

  ## Summary
  Completes the printer and print job schema to fully match the spec:

  1. **printers table**
     - `connection_type` (text, NETWORK | USB, default NETWORK) — how to reach the printer
     - `usb_name` (text, nullable) — USB device name/path for USB printers (e.g. "/dev/usb/lp0")
     - `station` (text, KITCHEN | BAR | CASHIER | OTHER) — logical station, derived from existing type column
     Both `type` (functional role: CUISINE/BAR/CAISSE) and `connection_type` (physical: NETWORK/USB) are kept separate.

  2. **print_jobs table**
     - `error_message` (text, nullable) — human-readable error description (supplements existing `last_error`)
     - Fix status default from 'SUCCESS' to 'PENDING' so new jobs start in the queue
     - Ensure status CHECK includes all valid values

  ## Notes
  - No data is destroyed. Existing rows are preserved and backfilled.
  - `station` on printers is backfilled from the `type` column (CUISINE→KITCHEN, BAR→BAR, CAISSE→CASHIER).
*/

-- =====================
-- printers: add connection_type
-- =====================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'printers' AND column_name = 'connection_type'
  ) THEN
    ALTER TABLE printers ADD COLUMN connection_type text NOT NULL DEFAULT 'NETWORK'
      CHECK (connection_type IN ('NETWORK', 'USB'));
  END IF;
END $$;

-- =====================
-- printers: add usb_name
-- =====================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'printers' AND column_name = 'usb_name'
  ) THEN
    ALTER TABLE printers ADD COLUMN usb_name text DEFAULT NULL;
  END IF;
END $$;

-- =====================
-- printers: add station column (KITCHEN | BAR | CASHIER | OTHER)
-- =====================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'printers' AND column_name = 'station'
  ) THEN
    ALTER TABLE printers ADD COLUMN station text NOT NULL DEFAULT 'KITCHEN'
      CHECK (station IN ('KITCHEN', 'BAR', 'CASHIER', 'OTHER'));
  END IF;
END $$;

-- Backfill station from existing type values
UPDATE printers SET station = CASE
  WHEN type = 'CUISINE' THEN 'KITCHEN'
  WHEN type = 'BAR'     THEN 'BAR'
  WHEN type = 'CAISSE'  THEN 'CASHIER'
  ELSE 'OTHER'
END
WHERE station = 'KITCHEN' OR station IS NULL;

-- =====================
-- print_jobs: add error_message
-- =====================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'print_jobs' AND column_name = 'error_message'
  ) THEN
    ALTER TABLE print_jobs ADD COLUMN error_message text DEFAULT NULL;
  END IF;
END $$;

-- =====================
-- print_jobs: fix status default to PENDING
-- =====================
ALTER TABLE print_jobs ALTER COLUMN status SET DEFAULT 'PENDING';

-- Ensure the status constraint allows all needed values
ALTER TABLE print_jobs DROP CONSTRAINT IF EXISTS print_jobs_status_check;
ALTER TABLE print_jobs ADD CONSTRAINT print_jobs_status_check
  CHECK (status IN ('PENDING', 'PRINTING', 'SUCCESS', 'DONE', 'FAILED'));

/*
  # Add QZ Tray Printing Mode Support

  ## Summary
  Extends the printing system to support QZ Tray as a printing backend alongside
  the existing browser-based approach.

  ## Changes

  ### 1. app_settings — new settings keys
  - `printingMode`: "OFF" | "QZ_TRAY" — selects the active printing backend
  - `autoRetryPrinting`: already exists, ensuring it's present

  ### 2. print_jobs table — extended statuses and types
  - `status` column: add "PENDING" alongside existing SUCCESS/FAILED
  - `type` column: add "TEST" alongside existing INITIAL/ADDONS/BILL
  - `payload_text`: long text column for raw ESC/POS or formatted ticket payload
  - `last_error`: nullable text for failure messages
  - `printer_id`: FK to printers (already exists via printer_id in print_jobs)

  ### 3. order_items — ensure printed_qty exists
  - `printed_qty`: integer default 0 (tracks how many of each line item have been sent to printer)

  ## Security
  - RLS already enabled on all tables — no new policies needed
  - Existing permissive policies cover these new columns
*/

-- Upsert printingMode setting
INSERT INTO app_settings (key, value)
VALUES ('printingMode', '"OFF"')
ON CONFLICT (key) DO NOTHING;

-- Upsert autoRetryPrinting setting (ensure it exists)
INSERT INTO app_settings (key, value)
VALUES ('autoRetryPrinting', 'true')
ON CONFLICT (key) DO NOTHING;

-- Add payload_text column to print_jobs if not exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'print_jobs' AND column_name = 'payload_text'
  ) THEN
    ALTER TABLE print_jobs ADD COLUMN payload_text text DEFAULT '';
  END IF;
END $$;

-- Add last_error column to print_jobs if not exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'print_jobs' AND column_name = 'last_error'
  ) THEN
    ALTER TABLE print_jobs ADD COLUMN last_error text;
  END IF;
END $$;

-- Extend print_jobs.status to include PENDING
-- Drop the old check constraint and recreate with PENDING
DO $$
BEGIN
  -- Remove old constraint if it exists
  IF EXISTS (
    SELECT 1 FROM information_schema.check_constraints
    WHERE constraint_name = 'print_jobs_status_check'
  ) THEN
    ALTER TABLE print_jobs DROP CONSTRAINT print_jobs_status_check;
  END IF;
END $$;

ALTER TABLE print_jobs
  ADD CONSTRAINT print_jobs_status_check
  CHECK (status IN ('PENDING', 'SUCCESS', 'FAILED'));

-- Extend print_jobs.type to include TEST
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.check_constraints
    WHERE constraint_name = 'print_jobs_type_check'
  ) THEN
    ALTER TABLE print_jobs DROP CONSTRAINT print_jobs_type_check;
  END IF;
END $$;

ALTER TABLE print_jobs
  ADD CONSTRAINT print_jobs_type_check
  CHECK (type IN ('INITIAL', 'ADDONS', 'BILL', 'TEST'));

-- Ensure order_items has printed_qty column
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'order_items' AND column_name = 'printed_qty'
  ) THEN
    ALTER TABLE order_items ADD COLUMN printed_qty integer DEFAULT 0;
  END IF;
END $$;

-- Add index on print_jobs status for efficient queue polling
CREATE INDEX IF NOT EXISTS idx_print_jobs_status ON print_jobs (status);
CREATE INDEX IF NOT EXISTS idx_print_jobs_printer_id ON print_jobs (printer_id);

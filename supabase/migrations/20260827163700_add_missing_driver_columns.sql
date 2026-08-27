/*
# Add missing columns to drivers table

## Summary
The frontend DeliveryPage creates and updates drivers with fields
(photo_url, status, commission_rate, total_earnings, notes, updated_at)
that do not exist in the current drivers table, causing every insert
and most updates to fail silently. This migration adds those columns
with safe defaults so the application works as intended.

## New Columns (all added with IF NOT EXISTS, no data loss)
- photo_url (text, default '') — driver profile photo URL
- status (text, default 'offline', CHECK in available/busy/offline) — driver availability status
- commission_rate (numeric(5,2), default 10.00) — commission percentage
- total_earnings (numeric(10,2), default 0) — cumulative earnings
- notes (text, default '') — free-form notes
- updated_at (timestamptz, default now()) — last modification timestamp

## Existing columns preserved
- vehicle_type, is_available are left untouched (no data loss)

## Security
- No RLS policy changes. Existing policies reference site_id and
  sessions only, so they remain valid after adding columns.
*/

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'drivers' AND column_name = 'photo_url') THEN
    ALTER TABLE public.drivers ADD COLUMN photo_url text NOT NULL DEFAULT '';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'drivers' AND column_name = 'status') THEN
    ALTER TABLE public.drivers ADD COLUMN status text NOT NULL DEFAULT 'offline';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'drivers' AND column_name = 'commission_rate') THEN
    ALTER TABLE public.drivers ADD COLUMN commission_rate numeric(5,2) NOT NULL DEFAULT 10.00;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'drivers' AND column_name = 'total_earnings') THEN
    ALTER TABLE public.drivers ADD COLUMN total_earnings numeric(10,2) NOT NULL DEFAULT 0;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'drivers' AND column_name = 'notes') THEN
    ALTER TABLE public.drivers ADD COLUMN notes text NOT NULL DEFAULT '';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'drivers' AND column_name = 'updated_at') THEN
    ALTER TABLE public.drivers ADD COLUMN updated_at timestamptz NOT NULL DEFAULT now();
  END IF;
END $$;

-- Add CHECK constraint on status (drop first for idempotency)
ALTER TABLE public.drivers DROP CONSTRAINT IF EXISTS drivers_status_check;
ALTER TABLE public.drivers ADD CONSTRAINT drivers_status_check
  CHECK (status IN ('available', 'busy', 'offline'));

-- Backfill status from is_available for existing rows where status is still the default 'offline'
UPDATE public.drivers
  SET status = 'available'
  WHERE is_available = true AND status = 'offline';

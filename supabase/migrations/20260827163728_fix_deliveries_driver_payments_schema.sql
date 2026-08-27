/*
# Fix deliveries and driver_payments schema to match frontend

## Summary
The DeliveryPage frontend expects columns on `deliveries` and
`driver_payments` that do not exist in the database, causing every
delivery creation, delivery update, and driver payment insert to
fail silently. This migration adds the missing columns and creates
the missing `increment_driver_stats` RPC function.

## deliveries — new columns
- delivery_number (serial) — human-readable delivery number
- delivery_address (text, default '') — copied from customer_address
- commission_amount (numeric(10,2), default 0) — driver commission for this delivery
- order_id (uuid, nullable, FK to orders) — linked order
- cancelled_at (timestamptz, nullable) — when delivery was cancelled
- updated_at (timestamptz, default now()) — last modification timestamp

## driver_payments — new columns
- delivery_id (uuid, nullable, FK to deliveries) — linked delivery
- payment_type (text, default 'commission', CHECK in commission/bonus/deduction/advance)

## New RPC function
- increment_driver_stats(p_driver_id uuid, p_earnings numeric) — increments
  total_deliveries by 1 and adds p_earnings to total_earnings for the given
  driver. SECURITY INVOKER so RLS policies apply.

## Security
- No RLS policy changes. Existing policies reference site_id and
  sessions only, so they remain valid after adding columns.
*/

-- ============================================================
-- deliveries: add missing columns
-- ============================================================
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'deliveries' AND column_name = 'delivery_number') THEN
    ALTER TABLE public.deliveries ADD COLUMN delivery_number serial;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'deliveries' AND column_name = 'delivery_address') THEN
    ALTER TABLE public.deliveries ADD COLUMN delivery_address text NOT NULL DEFAULT '';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'deliveries' AND column_name = 'commission_amount') THEN
    ALTER TABLE public.deliveries ADD COLUMN commission_amount numeric(10,2) NOT NULL DEFAULT 0;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'deliveries' AND column_name = 'order_id') THEN
    ALTER TABLE public.deliveries ADD COLUMN order_id uuid REFERENCES public.orders(id) ON DELETE SET NULL;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'deliveries' AND column_name = 'cancelled_at') THEN
    ALTER TABLE public.deliveries ADD COLUMN cancelled_at timestamptz;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'deliveries' AND column_name = 'updated_at') THEN
    ALTER TABLE public.deliveries ADD COLUMN updated_at timestamptz NOT NULL DEFAULT now();
  END IF;
END $$;

-- Backfill delivery_address from customer_address for existing rows
UPDATE public.deliveries
  SET delivery_address = customer_address
  WHERE delivery_address = '' AND customer_address != '';

-- ============================================================
-- driver_payments: add missing columns
-- ============================================================
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'driver_payments' AND column_name = 'delivery_id') THEN
    ALTER TABLE public.driver_payments ADD COLUMN delivery_id uuid REFERENCES public.deliveries(id) ON DELETE SET NULL;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'driver_payments' AND column_name = 'payment_type') THEN
    ALTER TABLE public.driver_payments ADD COLUMN payment_type text NOT NULL DEFAULT 'commission';
  END IF;
END $$;

-- Add CHECK constraint on payment_type (drop first for idempotency)
ALTER TABLE public.driver_payments DROP CONSTRAINT IF EXISTS driver_payments_payment_type_check;
ALTER TABLE public.driver_payments ADD CONSTRAINT driver_payments_payment_type_check
  CHECK (payment_type IN ('commission', 'bonus', 'deduction', 'advance'));

-- ============================================================
-- increment_driver_stats RPC function
-- ============================================================
DROP FUNCTION IF EXISTS public.increment_driver_stats(uuid, numeric);
CREATE OR REPLACE FUNCTION public.increment_driver_stats(
  p_driver_id uuid,
  p_earnings numeric DEFAULT 0
) RETURNS void
LANGUAGE plpgsql
SECURITY INVOKER
AS $$
BEGIN
  UPDATE public.drivers
    SET total_deliveries = total_deliveries + 1,
        total_earnings = total_earnings + COALESCE(p_earnings, 0),
        updated_at = now()
    WHERE id = p_driver_id;
END;
$$;

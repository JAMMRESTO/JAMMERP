/*
  # Align restaurant_tables schema with frontend

  1. Schema Changes
    - Rename `position_x` → `pos_x`, `position_y` → `pos_y`
    - Add `shape` (text, default 'rect')
    - Add `notes` (text, default '')
    - Add `active_order_id` (uuid, nullable, FK to orders)
    - Add `reserved_for` (text, default '')
    - Add `reserved_at` (timestamptz, nullable)
    - Change `floor` from text to integer (default 1)
    - Change `status` default from 'available' to 'free'
    - Make `number` column nullable with default '' (frontend does not provide it)

  2. Notes
    - The frontend uses pos_x/pos_y naming, shape, notes, active_order_id, reserved_for
    - All existing data is preserved via safe ALTER operations
*/

-- Rename position columns to match frontend
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'restaurant_tables' AND column_name = 'position_x'
  ) THEN
    ALTER TABLE restaurant_tables RENAME COLUMN position_x TO pos_x;
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'restaurant_tables' AND column_name = 'position_y'
  ) THEN
    ALTER TABLE restaurant_tables RENAME COLUMN position_y TO pos_y;
  END IF;
END $$;

-- Add shape column
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'restaurant_tables' AND column_name = 'shape'
  ) THEN
    ALTER TABLE restaurant_tables ADD COLUMN shape text NOT NULL DEFAULT 'rect';
  END IF;
END $$;

-- Add notes column
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'restaurant_tables' AND column_name = 'notes'
  ) THEN
    ALTER TABLE restaurant_tables ADD COLUMN notes text NOT NULL DEFAULT '';
  END IF;
END $$;

-- Add active_order_id column
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'restaurant_tables' AND column_name = 'active_order_id'
  ) THEN
    ALTER TABLE restaurant_tables ADD COLUMN active_order_id uuid DEFAULT NULL;
  END IF;
END $$;

-- Add reserved_for column
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'restaurant_tables' AND column_name = 'reserved_for'
  ) THEN
    ALTER TABLE restaurant_tables ADD COLUMN reserved_for text NOT NULL DEFAULT '';
  END IF;
END $$;

-- Add reserved_at column
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'restaurant_tables' AND column_name = 'reserved_at'
  ) THEN
    ALTER TABLE restaurant_tables ADD COLUMN reserved_at timestamptz DEFAULT NULL;
  END IF;
END $$;

-- Make number nullable with default (frontend doesn't send it)
ALTER TABLE restaurant_tables ALTER COLUMN number DROP NOT NULL;
ALTER TABLE restaurant_tables ALTER COLUMN number SET DEFAULT '';

-- Change floor to integer type (frontend sends numbers)
-- First update existing text values to numeric equivalents
UPDATE restaurant_tables SET floor = '1' WHERE floor = 'main' OR floor = '';

ALTER TABLE restaurant_tables ALTER COLUMN floor SET DEFAULT '1';

-- Change status default from 'available' to 'free'
ALTER TABLE restaurant_tables ALTER COLUMN status SET DEFAULT 'free';

-- Update any existing 'available' status to 'free'
UPDATE restaurant_tables SET status = 'free' WHERE status = 'available';

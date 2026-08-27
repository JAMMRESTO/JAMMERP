-- Add cancellation tracking fields to sales table
ALTER TABLE sales ADD COLUMN IF NOT EXISTS cancelled_by uuid REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE sales ADD COLUMN IF NOT EXISTS cancelled_at timestamptz;
ALTER TABLE sales ADD COLUMN IF NOT EXISTS cancel_reason text NOT NULL DEFAULT '';

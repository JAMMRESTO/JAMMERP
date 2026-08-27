-- Drop FK on cancelled_by so it can hold both staff user IDs and Supabase Auth user IDs (site managers)
ALTER TABLE sales DROP CONSTRAINT IF EXISTS sales_cancelled_by_fkey;

-- Add a cancelled_by_name column to store the name of whoever validated the cancellation
ALTER TABLE sales ADD COLUMN IF NOT EXISTS cancelled_by_name text NOT NULL DEFAULT '';

/*
  # Add table locking mechanism

  ## Summary
  Adds the locked_by column to the tables table to prevent multiple servers from working on the same table simultaneously.

  ## Changes
  1. New Columns
    - `tables.locked_by` (uuid, nullable, foreign key to users)
      - NULL = table is free to be selected
      - Non-null = the user ID currently working on this table (a server has it open)
      - ON DELETE SET NULL to handle user deletion gracefully

  2. Indexes
    - Add partial index on locked_by for fast lookup of locked tables

  ## Important Notes
    - This enables table locking to prevent conflicts
    - The column is added with IF NOT EXISTS to prevent errors if already present
    - Partial index only indexes non-null values for efficiency
*/

-- Add locked_by column to tables table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'tables' AND column_name = 'locked_by'
  ) THEN
    ALTER TABLE tables ADD COLUMN locked_by uuid REFERENCES users(id) ON DELETE SET NULL DEFAULT NULL;
  END IF;
END $$;

-- Add partial index for performance (only indexes non-null values)
CREATE INDEX IF NOT EXISTS idx_tables_locked_by ON tables(locked_by) WHERE locked_by IS NOT NULL;

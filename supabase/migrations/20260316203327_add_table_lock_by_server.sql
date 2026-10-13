/*
  # Add table locking mechanism

  ## Purpose
  Prevent two servers from working on the same table simultaneously.

  ## Changes
  - `tables` table: add `locked_by` column (uuid, nullable, FK to users)
    - NULL = table is free to be selected
    - Non-null = the user ID currently working on this table (a server has it open)
  - Add index on locked_by for fast lookup
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'tables' AND column_name = 'locked_by'
  ) THEN
    ALTER TABLE tables ADD COLUMN locked_by uuid REFERENCES users(id) ON DELETE SET NULL DEFAULT NULL;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_tables_locked_by ON tables(locked_by) WHERE locked_by IS NOT NULL;

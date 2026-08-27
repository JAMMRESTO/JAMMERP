/*
  # Fix cash closure and app_settings

  1. Changes
    - Add unique constraint on app_settings.key column (was missing, causing ON CONFLICT errors)
    - Make cash_closures.session_id nullable (closures can be created without a session)

  2. Why
    - The app_settings upsert uses ON CONFLICT (key) but no unique constraint existed
    - Cash closures are created with session_id = null when no session is open, but the column was NOT NULL

  3. Safety
    - Deduplicate any existing duplicate keys before adding constraint
    - Uses IF NOT EXISTS patterns where possible
*/

-- Deduplicate app_settings: keep only the latest row per key
DELETE FROM app_settings
WHERE id NOT IN (
  SELECT DISTINCT ON (key) id
  FROM app_settings
  ORDER BY key, updated_at DESC NULLS LAST
);

-- Add unique constraint on key if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint c
    JOIN pg_class t ON c.conrelid = t.oid
    WHERE t.relname = 'app_settings' AND c.contype = 'u'
    AND pg_get_constraintdef(c.oid) LIKE '%key%'
  ) THEN
    ALTER TABLE app_settings ADD CONSTRAINT app_settings_key_unique UNIQUE (key);
  END IF;
END $$;

-- Make cash_closures.session_id nullable
ALTER TABLE cash_closures ALTER COLUMN session_id DROP NOT NULL;

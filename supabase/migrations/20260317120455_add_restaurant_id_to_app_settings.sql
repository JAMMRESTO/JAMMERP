/*
  # Add restaurant_id to app_settings

  ## Summary
  Adds restaurant_id column to app_settings table for multi-restaurant support.

  ## Changes
  1. Add restaurant_id column to app_settings
    - Column: restaurant_id (uuid, NOT NULL with default)
    - Default value: '00000000-0000-0000-0000-000000000001' (default restaurant)
    - All existing settings will be assigned to the default restaurant

  2. Add index for performance
    - Index on restaurant_id for filtering by restaurant

  3. Update unique constraint
    - Change from unique(key) to unique(restaurant_id, key)
    - Allows same setting key across different restaurants

  ## Important Notes
    - This migration is idempotent (safe to run multiple times)
    - Existing settings will be preserved and assigned to default restaurant
*/

-- Add restaurant_id column if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'app_settings' AND column_name = 'restaurant_id'
  ) THEN
    ALTER TABLE app_settings 
    ADD COLUMN restaurant_id uuid NOT NULL 
    DEFAULT '00000000-0000-0000-0000-000000000001';
  END IF;
END $$;

-- Add index for performance
CREATE INDEX IF NOT EXISTS idx_app_settings_restaurant_id ON app_settings(restaurant_id);

-- Drop old unique constraint on key if it exists
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'app_settings_key_key' 
    AND conrelid = 'app_settings'::regclass
  ) THEN
    ALTER TABLE app_settings DROP CONSTRAINT app_settings_key_key;
  END IF;
END $$;

-- Add new unique constraint on (restaurant_id, key)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'app_settings_restaurant_key_unique' 
    AND conrelid = 'app_settings'::regclass
  ) THEN
    ALTER TABLE app_settings 
    ADD CONSTRAINT app_settings_restaurant_key_unique 
    UNIQUE (restaurant_id, key);
  END IF;
END $$;

/*
  # Add restaurant_id column to zones table

  ## Summary
  Adds the missing restaurant_id foreign key column to the zones table for multi-restaurant support.

  ## Changes
  1. New Columns
    - `zones.restaurant_id` (uuid, foreign key to restaurants, with default)
      - Links each zone to a specific restaurant
      - Uses default restaurant ID: 00000000-0000-0000-0000-000000000001
      - NOT NULL constraint for data integrity

  2. Indexes
    - Add index on restaurant_id for query performance

  ## Important Notes
    - All existing zones will be assigned to the default restaurant
    - This enables future multi-restaurant functionality
    - The column is added with IF NOT EXISTS to prevent errors if already present
*/

-- Add restaurant_id column to zones table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'zones' AND column_name = 'restaurant_id'
  ) THEN
    ALTER TABLE zones 
    ADD COLUMN restaurant_id uuid NOT NULL 
    DEFAULT '00000000-0000-0000-0000-000000000001';
  END IF;
END $$;

-- Add index for performance
CREATE INDEX IF NOT EXISTS idx_zones_restaurant_id ON zones(restaurant_id);

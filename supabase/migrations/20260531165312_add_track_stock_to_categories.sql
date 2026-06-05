/*
  # Add track_stock to categories

  1. Modified Tables
    - `categories`
      - Added `track_stock` (boolean, default true)
        When false, all products in this category ignore stock tracking
        and are always available for sale regardless of stock level.

  2. Important Notes
    - Existing categories default to true (current behavior preserved)
    - Products in a non-tracked category can still override individually
      but the category setting serves as the default for new products
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'categories' AND column_name = 'track_stock'
  ) THEN
    ALTER TABLE categories ADD COLUMN track_stock boolean NOT NULL DEFAULT true;
  END IF;
END $$;

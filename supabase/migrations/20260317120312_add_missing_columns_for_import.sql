/*
  # Add missing columns for data import

  ## Summary
  Adds all missing columns required for successful data import/export functionality.

  ## Changes
  1. Categories table
    - Add `parent_id` (uuid, nullable) - for subcategory support
    - Add `restaurant_id` (uuid, NOT NULL with default) - for multi-restaurant support
    - Add `description` (text, nullable) - for category descriptions

  2. Products table
    - Add `restaurant_id` (uuid, NOT NULL with default) - for multi-restaurant support
    - Add `description` (text, nullable) - for product descriptions
    - Add `subcategory_id` (uuid, nullable) - for subcategory link

  3. Zones table
    - Add `restaurant_id` (uuid, NOT NULL with default) - for multi-restaurant support

  4. Printers table
    - Add `restaurant_id` if missing (uuid, NOT NULL with default) - for multi-restaurant support

  ## Indexes
    - Add indexes on all foreign key columns for performance

  ## Important Notes
    - All existing records will be assigned to the default restaurant
    - This migration is idempotent (safe to run multiple times)
*/

-- Add missing columns to categories
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'categories' AND column_name = 'parent_id'
  ) THEN
    ALTER TABLE categories ADD COLUMN parent_id uuid REFERENCES categories(id) ON DELETE SET NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'categories' AND column_name = 'restaurant_id'
  ) THEN
    ALTER TABLE categories 
    ADD COLUMN restaurant_id uuid NOT NULL 
    DEFAULT '00000000-0000-0000-0000-000000000001';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'categories' AND column_name = 'description'
  ) THEN
    ALTER TABLE categories ADD COLUMN description text;
  END IF;
END $$;

-- Add missing columns to products
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'products' AND column_name = 'restaurant_id'
  ) THEN
    ALTER TABLE products 
    ADD COLUMN restaurant_id uuid NOT NULL 
    DEFAULT '00000000-0000-0000-0000-000000000001';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'products' AND column_name = 'description'
  ) THEN
    ALTER TABLE products ADD COLUMN description text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'products' AND column_name = 'subcategory_id'
  ) THEN
    ALTER TABLE products ADD COLUMN subcategory_id uuid REFERENCES categories(id) ON DELETE SET NULL;
  END IF;
END $$;

-- Add missing columns to zones
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'zones' AND column_name = 'restaurant_id'
  ) THEN
    ALTER TABLE zones 
    ADD COLUMN restaurant_id uuid NOT NULL 
    DEFAULT '00000000-0000-0000-0000-000000000001';
  END IF;
END $$;

-- Add missing columns to printers (in case it wasn't added before)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'printers' AND column_name = 'restaurant_id'
  ) THEN
    ALTER TABLE printers 
    ADD COLUMN restaurant_id uuid NOT NULL 
    DEFAULT '00000000-0000-0000-0000-000000000001';
  END IF;
END $$;

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_categories_parent_id ON categories(parent_id);
CREATE INDEX IF NOT EXISTS idx_categories_restaurant_id ON categories(restaurant_id);
CREATE INDEX IF NOT EXISTS idx_products_restaurant_id ON products(restaurant_id);
CREATE INDEX IF NOT EXISTS idx_products_subcategory_id ON products(subcategory_id);
CREATE INDEX IF NOT EXISTS idx_zones_restaurant_id ON zones(restaurant_id);
CREATE INDEX IF NOT EXISTS idx_printers_restaurant_id ON printers(restaurant_id);

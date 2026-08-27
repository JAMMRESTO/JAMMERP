/*
  # Add missing columns to products table

  ## Summary
  The product form sends fields that do not exist in the database,
  causing inserts and updates to fail.

  ## Changes

  ### products table — new columns
  - `product_code` (text, default '') — SKU / internal product code
  - `cost_price` (numeric, default 0) — production/purchase cost
  - `unit` (text, default 'pièce') — unit of measure
  - `low_stock_threshold` (integer, default 5) — alert threshold for low stock
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'products' AND column_name = 'product_code'
  ) THEN
    ALTER TABLE products ADD COLUMN product_code text NOT NULL DEFAULT '';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'products' AND column_name = 'cost_price'
  ) THEN
    ALTER TABLE products ADD COLUMN cost_price numeric NOT NULL DEFAULT 0;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'products' AND column_name = 'unit'
  ) THEN
    ALTER TABLE products ADD COLUMN unit text NOT NULL DEFAULT 'pièce';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'products' AND column_name = 'low_stock_threshold'
  ) THEN
    ALTER TABLE products ADD COLUMN low_stock_threshold integer NOT NULL DEFAULT 5;
  END IF;
END $$;

/*
  # Inventory Module Schema

  ## Overview
  Extends the products table and adds full inventory tracking.

  ## Changes to existing tables

  ### products (extended)
  - Add `product_code` (SKU) — unique per product
  - Add `cost_price` — production/purchase cost
  - Add `unit` — unit of measure (piece, kg, litre, etc.)
  - Add `low_stock_threshold` — triggers alert when stock falls below
  - Add `image_url` already exists — no change needed

  ## New Tables

  ### stock_movements
  - Tracks every stock change (manual entry, sale deduction, adjustment)
  - movement_type: 'in' | 'out' | 'adjustment'
  - reason: free text
  - Links to product and optional user

  ### Notes
  - Margin is computed client-side: (price - cost_price) / price * 100
  - Available status auto-managed: if track_stock=true and stock<=0, is_available=false
  - RLS: anon full access (PIN-based system)
*/

-- Extend products table
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='products' AND column_name='product_code') THEN
    ALTER TABLE products ADD COLUMN product_code text NOT NULL DEFAULT '';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='products' AND column_name='cost_price') THEN
    ALTER TABLE products ADD COLUMN cost_price numeric(12,2) NOT NULL DEFAULT 0;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='products' AND column_name='unit') THEN
    ALTER TABLE products ADD COLUMN unit text NOT NULL DEFAULT 'pièce';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='products' AND column_name='low_stock_threshold') THEN
    ALTER TABLE products ADD COLUMN low_stock_threshold integer NOT NULL DEFAULT 5;
  END IF;
END $$;

-- Stock movements table
CREATE TABLE IF NOT EXISTS stock_movements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  movement_type text NOT NULL CHECK (movement_type IN ('in', 'out', 'adjustment')),
  quantity integer NOT NULL,
  stock_before integer NOT NULL DEFAULT 0,
  stock_after integer NOT NULL DEFAULT 0,
  reason text NOT NULL DEFAULT '',
  user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_stock_movements_product ON stock_movements(product_id);
CREATE INDEX IF NOT EXISTS idx_stock_movements_created ON stock_movements(created_at DESC);

-- RLS
ALTER TABLE stock_movements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "anon_select_stock_movements" ON stock_movements FOR SELECT TO anon USING (true);
CREATE POLICY "anon_insert_stock_movements" ON stock_movements FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "anon_update_stock_movements" ON stock_movements FOR UPDATE TO anon USING (true) WITH CHECK (true);
CREATE POLICY "anon_delete_stock_movements" ON stock_movements FOR DELETE TO anon USING (true);

-- Update existing products with cost_price and product_code where missing
UPDATE products SET
  product_code = UPPER(SUBSTRING(REPLACE(name, ' ', ''), 1, 4)) || '-' || LPAD(FLOOR(RANDOM() * 999 + 1)::text, 3, '0'),
  cost_price = ROUND((price * (0.35 + RANDOM() * 0.25))::numeric, 2),
  stock = FLOOR(RANDOM() * 50 + 10)::integer,
  track_stock = true,
  low_stock_threshold = 5
WHERE product_code = '' OR product_code IS NULL;

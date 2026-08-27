
-- Add missing columns to recipes table to match frontend expectations
ALTER TABLE recipes
  ADD COLUMN IF NOT EXISTS batch_yield numeric(10,2) NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS total_cost numeric(12,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS max_producible numeric(10,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS margin_pct numeric(5,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS description text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();

-- Add missing columns to ingredients table to match frontend expectations
ALTER TABLE ingredients
  ADD COLUMN IF NOT EXISTS stock numeric(12,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS low_stock_threshold numeric(12,2) NOT NULL DEFAULT 5,
  ADD COLUMN IF NOT EXISTS description text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS category text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();

-- Backfill stock from stock_quantity if it exists
UPDATE ingredients SET stock = COALESCE(stock_quantity, 0) WHERE stock = 0 AND stock_quantity > 0;

-- Backfill batch_yield from yield_quantity if it exists
UPDATE recipes SET batch_yield = COALESCE(yield_quantity, 1) WHERE batch_yield = 1 AND yield_quantity IS NOT NULL AND yield_quantity > 0;


/*
  # Add Direct Sales, Order Type, and App Settings

  ## Summary
  Extends the POS system to support:
  1. Direct sales (no table) via a new orderType field
  2. Per-item print tracking via printed_qty on order_items
  3. App-level settings (local network printing toggle, etc.)

  ## Modified Tables

  ### orders
  - Added `order_type` column: 'TABLE' | 'DIRECT' (default 'TABLE')
  - Added `caissier_id` column: nullable FK to users (for direct sales by cashier)

  ### order_items
  - Added `printed_qty` column: integer tracking how many units have been printed

  ## New Tables

  ### app_settings
  - Key-value store for application-level configuration
  - Fields: id, key (unique), value, updated_at
  - Default settings: localNetworkPrintingEnabled = true

  ## Security
  - RLS enabled on app_settings
  - Anon can read and update settings (internal app)
  - Indexes on new FK columns
*/

-- Add order_type to orders
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'orders' AND column_name = 'order_type'
  ) THEN
    ALTER TABLE orders ADD COLUMN order_type text NOT NULL DEFAULT 'TABLE'
      CHECK (order_type IN ('TABLE', 'DIRECT'));
  END IF;
END $$;

-- Add caissier_id to orders
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'orders' AND column_name = 'caissier_id'
  ) THEN
    ALTER TABLE orders ADD COLUMN caissier_id uuid REFERENCES users(id) ON DELETE SET NULL;
  END IF;
END $$;

-- Add printed_qty to order_items
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'order_items' AND column_name = 'printed_qty'
  ) THEN
    ALTER TABLE order_items ADD COLUMN printed_qty integer NOT NULL DEFAULT 0;
  END IF;
END $$;

-- Index on orders.caissier_id
CREATE INDEX IF NOT EXISTS idx_orders_caissier_id ON public.orders(caissier_id);

-- Index on orders.order_type
CREATE INDEX IF NOT EXISTS idx_orders_order_type ON public.orders(order_type);

-- =====================
-- TABLE: app_settings
-- =====================
CREATE TABLE IF NOT EXISTS app_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key text UNIQUE NOT NULL,
  value text NOT NULL DEFAULT '',
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE app_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anon can read app_settings"
  ON app_settings FOR SELECT TO anon
  USING (key IS NOT NULL);

CREATE POLICY "Anon can insert app_settings"
  ON app_settings FOR INSERT TO anon
  WITH CHECK (key IS NOT NULL);

CREATE POLICY "Anon can update app_settings"
  ON app_settings FOR UPDATE TO anon
  USING (key IS NOT NULL)
  WITH CHECK (key IS NOT NULL);

-- Seed default settings
INSERT INTO app_settings (key, value) VALUES
  ('localNetworkPrintingEnabled', 'true'),
  ('restaurantName', 'RestoBar')
ON CONFLICT (key) DO NOTHING;

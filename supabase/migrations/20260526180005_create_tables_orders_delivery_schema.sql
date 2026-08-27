/*
  # Tables, Orders, Delivery & Drivers Schema

  ## Overview
  Four new modules: restaurant floor tables, kitchen orders, delivery management,
  driver profiles and commission payments.

  ## New Tables
  - restaurant_tables: Physical floor tables with status/shape/position
  - orders: Kitchen orders with preparation status
  - order_items: Line items per order with per-item kitchen status
  - drivers: Delivery driver profiles with commission rate
  - deliveries: Delivery assignments linking order to driver
  - driver_payments: Commission and bonus payment records

  ## Security
  - RLS enabled on all tables
  - Anon role has full CRUD access (PIN-based POS, no Supabase Auth)
*/

-- ============================================================
-- ORDERS (created first for FK references)
-- ============================================================
CREATE TABLE IF NOT EXISTS orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_number serial,
  table_id uuid,
  sale_id uuid REFERENCES sales(id) ON DELETE SET NULL,
  delivery_id uuid,
  order_type text NOT NULL DEFAULT 'dine_in' CHECK (order_type IN ('dine_in', 'takeaway', 'delivery')),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'preparing', 'ready', 'served', 'cancelled')),
  customer_name text DEFAULT '',
  notes text DEFAULT '',
  total_amount numeric(10,2) NOT NULL DEFAULT 0,
  cashier_id uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  served_at timestamptz,
  cancelled_at timestamptz
);

-- ============================================================
-- RESTAURANT TABLES
-- ============================================================
CREATE TABLE IF NOT EXISTS restaurant_tables (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  capacity int NOT NULL DEFAULT 4,
  status text NOT NULL DEFAULT 'free' CHECK (status IN ('free', 'occupied', 'reserved')),
  shape text NOT NULL DEFAULT 'rect' CHECK (shape IN ('rect', 'round')),
  pos_x int NOT NULL DEFAULT 0,
  pos_y int NOT NULL DEFAULT 0,
  active_order_id uuid REFERENCES orders(id) ON DELETE SET NULL,
  reserved_for text DEFAULT '',
  reserved_at timestamptz,
  notes text DEFAULT '',
  floor int NOT NULL DEFAULT 1,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz DEFAULT now()
);

-- Add FK from orders to restaurant_tables
ALTER TABLE orders ADD COLUMN IF NOT EXISTS _table_ref uuid;
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'orders_table_id_fkey' AND table_name = 'orders'
  ) THEN
    ALTER TABLE orders ADD CONSTRAINT orders_table_id_fkey
      FOREIGN KEY (table_id) REFERENCES restaurant_tables(id) ON DELETE SET NULL;
  END IF;
END $$;
ALTER TABLE orders DROP COLUMN IF EXISTS _table_ref;

-- ============================================================
-- ORDER ITEMS
-- ============================================================
CREATE TABLE IF NOT EXISTS order_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  product_id uuid REFERENCES products(id) ON DELETE SET NULL,
  product_name text NOT NULL,
  quantity int NOT NULL DEFAULT 1,
  unit_price numeric(10,2) NOT NULL DEFAULT 0,
  variant_label text DEFAULT '',
  kitchen_note text DEFAULT '',
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'preparing', 'ready', 'served')),
  created_at timestamptz DEFAULT now()
);

-- ============================================================
-- DRIVERS
-- ============================================================
CREATE TABLE IF NOT EXISTS drivers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  phone text NOT NULL DEFAULT '',
  photo_url text DEFAULT '',
  status text NOT NULL DEFAULT 'offline' CHECK (status IN ('available', 'busy', 'offline')),
  commission_rate numeric(5,2) NOT NULL DEFAULT 10.00,
  total_deliveries int NOT NULL DEFAULT 0,
  total_earnings numeric(10,2) NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  notes text DEFAULT '',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- ============================================================
-- DELIVERIES
-- ============================================================
CREATE TABLE IF NOT EXISTS deliveries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  delivery_number serial,
  order_id uuid REFERENCES orders(id) ON DELETE SET NULL,
  sale_id uuid REFERENCES sales(id) ON DELETE SET NULL,
  driver_id uuid REFERENCES drivers(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'assigned', 'picked_up', 'delivered', 'cancelled')),
  customer_name text NOT NULL DEFAULT '',
  customer_phone text DEFAULT '',
  delivery_address text NOT NULL DEFAULT '',
  delivery_fee numeric(10,2) NOT NULL DEFAULT 0,
  commission_amount numeric(10,2) NOT NULL DEFAULT 0,
  notes text DEFAULT '',
  assigned_at timestamptz,
  picked_up_at timestamptz,
  delivered_at timestamptz,
  cancelled_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Add FK on orders for delivery_id
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'orders_delivery_id_fkey' AND table_name = 'orders'
  ) THEN
    ALTER TABLE orders ADD CONSTRAINT orders_delivery_id_fkey
      FOREIGN KEY (delivery_id) REFERENCES deliveries(id) ON DELETE SET NULL;
  END IF;
END $$;

-- ============================================================
-- DRIVER PAYMENTS
-- ============================================================
CREATE TABLE IF NOT EXISTS driver_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  driver_id uuid NOT NULL REFERENCES drivers(id) ON DELETE CASCADE,
  delivery_id uuid REFERENCES deliveries(id) ON DELETE SET NULL,
  payment_type text NOT NULL DEFAULT 'commission' CHECK (payment_type IN ('commission', 'bonus', 'deduction', 'advance')),
  amount numeric(10,2) NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'paid')),
  notes text DEFAULT '',
  paid_at timestamptz,
  created_at timestamptz DEFAULT now()
);

-- ============================================================
-- INDEXES
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_orders_table_id ON orders(table_id);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_created_at ON orders(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_order_items_order_id ON order_items(order_id);
CREATE INDEX IF NOT EXISTS idx_deliveries_driver_id ON deliveries(driver_id);
CREATE INDEX IF NOT EXISTS idx_deliveries_status ON deliveries(status);
CREATE INDEX IF NOT EXISTS idx_deliveries_created_at ON deliveries(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_driver_payments_driver_id ON driver_payments(driver_id);
CREATE INDEX IF NOT EXISTS idx_restaurant_tables_status ON restaurant_tables(status);

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================
ALTER TABLE restaurant_tables ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE drivers ENABLE ROW LEVEL SECURITY;
ALTER TABLE deliveries ENABLE ROW LEVEL SECURITY;
ALTER TABLE driver_payments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "anon select restaurant_tables" ON restaurant_tables FOR SELECT TO anon USING (true);
CREATE POLICY "anon insert restaurant_tables" ON restaurant_tables FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "anon update restaurant_tables" ON restaurant_tables FOR UPDATE TO anon USING (true) WITH CHECK (true);
CREATE POLICY "anon delete restaurant_tables" ON restaurant_tables FOR DELETE TO anon USING (true);

CREATE POLICY "anon select orders" ON orders FOR SELECT TO anon USING (true);
CREATE POLICY "anon insert orders" ON orders FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "anon update orders" ON orders FOR UPDATE TO anon USING (true) WITH CHECK (true);
CREATE POLICY "anon delete orders" ON orders FOR DELETE TO anon USING (true);

CREATE POLICY "anon select order_items" ON order_items FOR SELECT TO anon USING (true);
CREATE POLICY "anon insert order_items" ON order_items FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "anon update order_items" ON order_items FOR UPDATE TO anon USING (true) WITH CHECK (true);
CREATE POLICY "anon delete order_items" ON order_items FOR DELETE TO anon USING (true);

CREATE POLICY "anon select drivers" ON drivers FOR SELECT TO anon USING (true);
CREATE POLICY "anon insert drivers" ON drivers FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "anon update drivers" ON drivers FOR UPDATE TO anon USING (true) WITH CHECK (true);
CREATE POLICY "anon delete drivers" ON drivers FOR DELETE TO anon USING (true);

CREATE POLICY "anon select deliveries" ON deliveries FOR SELECT TO anon USING (true);
CREATE POLICY "anon insert deliveries" ON deliveries FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "anon update deliveries" ON deliveries FOR UPDATE TO anon USING (true) WITH CHECK (true);
CREATE POLICY "anon delete deliveries" ON deliveries FOR DELETE TO anon USING (true);

CREATE POLICY "anon select driver_payments" ON driver_payments FOR SELECT TO anon USING (true);
CREATE POLICY "anon insert driver_payments" ON driver_payments FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "anon update driver_payments" ON driver_payments FOR UPDATE TO anon USING (true) WITH CHECK (true);
CREATE POLICY "anon delete driver_payments" ON driver_payments FOR DELETE TO anon USING (true);

-- ============================================================
-- SEED: Default tables layout
-- ============================================================
INSERT INTO restaurant_tables (name, capacity, status, shape, pos_x, pos_y, floor) VALUES
  ('T1', 2, 'free', 'round', 80, 80, 1),
  ('T2', 2, 'free', 'round', 200, 80, 1),
  ('T3', 4, 'free', 'rect', 340, 80, 1),
  ('T4', 4, 'free', 'rect', 480, 80, 1),
  ('T5', 6, 'free', 'rect', 80, 220, 1),
  ('T6', 6, 'free', 'rect', 280, 220, 1),
  ('T7', 8, 'free', 'rect', 480, 220, 1),
  ('T8', 4, 'free', 'round', 80, 360, 1),
  ('T9', 4, 'free', 'round', 220, 360, 1),
  ('T10', 2, 'free', 'round', 360, 360, 1),
  ('Bar 1', 2, 'free', 'round', 500, 360, 1),
  ('Bar 2', 2, 'free', 'round', 600, 360, 1),
  ('S1', 4, 'free', 'rect', 80, 80, 2),
  ('S2', 4, 'free', 'rect', 240, 80, 2),
  ('S3', 6, 'free', 'rect', 400, 80, 2),
  ('Terrasse 1', 4, 'free', 'round', 80, 200, 2),
  ('Terrasse 2', 4, 'free', 'round', 240, 200, 2)
ON CONFLICT DO NOTHING;

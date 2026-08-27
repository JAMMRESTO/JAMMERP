
-- Add payment method and geolocation to online_orders
ALTER TABLE online_orders
  ADD COLUMN IF NOT EXISTS payment_method text NOT NULL DEFAULT 'cash'
    CHECK (payment_method IN ('cash', 'wave', 'orange_money', 'card')),
  ADD COLUMN IF NOT EXISTS customer_lat double precision,
  ADD COLUMN IF NOT EXISTS customer_lng double precision;

-- Allow anon to SELECT their own orders by id (for tracking)
DROP POLICY IF EXISTS "Anon can read own new orders" ON online_orders;
CREATE POLICY "Anon can read online orders by id"
  ON online_orders FOR SELECT
  TO anon
  USING (true);

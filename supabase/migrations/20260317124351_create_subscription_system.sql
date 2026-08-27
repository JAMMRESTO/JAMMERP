/*
  # Subscription System

  1. New Tables
    - `restaurants`
      - `id` (uuid, primary key)
      - `name` (text) - restaurant name
      - `address`, `phone`, `email` (text, nullable) - contact info
      - `country` (text, default 'SN')
      - `currency` (text, default 'FCFA')
      - `created_at`, `updated_at` (timestamptz)

    - `subscription_plans`
      - `id` (uuid, primary key)
      - `name` (text, unique) - internal name (FREE, STARTER, PRO, ENTERPRISE)
      - `display_name` (text) - shown to users
      - `price_monthly` (integer) - monthly price in FCFA
      - `price_annual` (integer) - annual price in FCFA (discounted)
      - `max_users`, `max_orders_per_month`, `max_tables` (integer, nullable for unlimited)
      - `features` (jsonb) - feature flags
      - `active` (boolean) - whether plan is available
      - `sort_order` (integer) - display ordering
      - `created_at` (timestamptz)

    - `subscriptions`
      - `id` (uuid, primary key)
      - `restaurant_id` (uuid, FK to restaurants)
      - `plan_id` (uuid, FK to subscription_plans)
      - `billing_cycle` (text) - 'monthly' or 'annual'
      - `status` (text) - 'active', 'expired', 'cancelled'
      - `started_at` (timestamptz) - subscription start
      - `expires_at` (timestamptz) - expiration date
      - `auto_renew` (boolean, default true)
      - `amount` (integer) - amount paid
      - `created_at`, `updated_at` (timestamptz)

  2. Security
    - RLS enabled on all tables
    - anon role can read restaurants, plans, and subscriptions for the hardcoded restaurant
    - Only authenticated or anon with matching restaurant_id can update

  3. Seeded Data
    - Default restaurant row (id: 00000000-0000-0000-0000-000000000001)
    - 4 subscription plans: Gratuit, Starter, Pro, Enterprise
    - Default FREE subscription for the restaurant

  4. Functions
    - `check_expired_subscriptions()` - marks expired subscriptions and downgrades to FREE
*/

-- 1. Restaurants table
CREATE TABLE IF NOT EXISTS restaurants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL DEFAULT '',
  address text,
  phone text,
  email text,
  country text NOT NULL DEFAULT 'SN',
  currency text NOT NULL DEFAULT 'FCFA',
  notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE restaurants ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anon can read restaurants"
  ON restaurants FOR SELECT
  TO anon
  USING (id = '00000000-0000-0000-0000-000000000001'::uuid);

CREATE POLICY "Anon can update own restaurant"
  ON restaurants FOR UPDATE
  TO anon
  USING (id = '00000000-0000-0000-0000-000000000001'::uuid)
  WITH CHECK (id = '00000000-0000-0000-0000-000000000001'::uuid);

-- Seed default restaurant
INSERT INTO restaurants (id, name)
VALUES ('00000000-0000-0000-0000-000000000001', 'LA FIESTA')
ON CONFLICT (id) DO NOTHING;

-- 2. Subscription Plans table
CREATE TABLE IF NOT EXISTS subscription_plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  display_name text NOT NULL,
  price_monthly integer NOT NULL DEFAULT 0,
  price_annual integer NOT NULL DEFAULT 0,
  max_users integer,
  max_orders_per_month integer,
  max_tables integer,
  features jsonb NOT NULL DEFAULT '{}',
  active boolean DEFAULT true,
  sort_order integer DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE subscription_plans ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read active plans"
  ON subscription_plans FOR SELECT
  TO anon
  USING (active = true);

-- Seed plans (annual = 10 months price = ~17% discount)
INSERT INTO subscription_plans (name, display_name, price_monthly, price_annual, max_users, max_orders_per_month, max_tables, features, sort_order) VALUES
  ('FREE', 'Gratuit', 0, 0, 2, 200, 5,
   '{"printers":false,"kitchen_display":false,"cash_closure":false,"data_export":false,"activity_logs":false,"multi_location":false}'::jsonb, 0),
  ('STARTER', 'Starter', 9900, 99000, 5, 1000, 20,
   '{"printers":true,"kitchen_display":false,"cash_closure":true,"data_export":true,"activity_logs":false,"multi_location":false}'::jsonb, 1),
  ('PRO', 'Pro', 29900, 299000, null, null, null,
   '{"printers":true,"kitchen_display":true,"cash_closure":true,"data_export":true,"activity_logs":true,"multi_location":false}'::jsonb, 2),
  ('ENTERPRISE', 'Enterprise', 99900, 999000, null, null, null,
   '{"printers":true,"kitchen_display":true,"cash_closure":true,"data_export":true,"activity_logs":true,"multi_location":true}'::jsonb, 3)
ON CONFLICT (name) DO UPDATE SET
  display_name = EXCLUDED.display_name,
  price_monthly = EXCLUDED.price_monthly,
  price_annual = EXCLUDED.price_annual,
  max_users = EXCLUDED.max_users,
  max_orders_per_month = EXCLUDED.max_orders_per_month,
  max_tables = EXCLUDED.max_tables,
  features = EXCLUDED.features,
  sort_order = EXCLUDED.sort_order;

-- 3. Subscriptions table
CREATE TABLE IF NOT EXISTS subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id uuid NOT NULL REFERENCES restaurants(id),
  plan_id uuid NOT NULL REFERENCES subscription_plans(id),
  billing_cycle text NOT NULL DEFAULT 'monthly' CHECK (billing_cycle IN ('monthly', 'annual')),
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'expired', 'cancelled')),
  started_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz,
  auto_renew boolean DEFAULT true,
  amount integer NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anon can read own subscriptions"
  ON subscriptions FOR SELECT
  TO anon
  USING (restaurant_id = '00000000-0000-0000-0000-000000000001'::uuid);

CREATE POLICY "Anon can insert subscriptions for own restaurant"
  ON subscriptions FOR INSERT
  TO anon
  WITH CHECK (restaurant_id = '00000000-0000-0000-0000-000000000001'::uuid);

CREATE POLICY "Anon can update own subscriptions"
  ON subscriptions FOR UPDATE
  TO anon
  USING (restaurant_id = '00000000-0000-0000-0000-000000000001'::uuid)
  WITH CHECK (restaurant_id = '00000000-0000-0000-0000-000000000001'::uuid);

-- Index for fast lookups
CREATE INDEX IF NOT EXISTS idx_subscriptions_restaurant_status
  ON subscriptions (restaurant_id, status);

CREATE INDEX IF NOT EXISTS idx_subscriptions_expires_at
  ON subscriptions (expires_at)
  WHERE status = 'active';

-- Seed default FREE subscription (never expires)
INSERT INTO subscriptions (restaurant_id, plan_id, billing_cycle, status, amount, expires_at)
SELECT
  '00000000-0000-0000-0000-000000000001'::uuid,
  sp.id,
  'monthly',
  'active',
  0,
  null
FROM subscription_plans sp
WHERE sp.name = 'FREE'
ON CONFLICT DO NOTHING;

-- 4. Function to check and expire subscriptions
CREATE OR REPLACE FUNCTION check_expired_subscriptions()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  expired_count integer;
  free_plan_id uuid;
BEGIN
  SELECT id INTO free_plan_id FROM subscription_plans WHERE name = 'FREE' LIMIT 1;

  WITH expired AS (
    UPDATE subscriptions
    SET status = 'expired', updated_at = now()
    WHERE status = 'active'
      AND expires_at IS NOT NULL
      AND expires_at < now()
    RETURNING restaurant_id
  )
  SELECT count(*) INTO expired_count FROM expired;

  IF expired_count > 0 AND free_plan_id IS NOT NULL THEN
    INSERT INTO subscriptions (restaurant_id, plan_id, billing_cycle, status, amount, expires_at)
    SELECT DISTINCT e.restaurant_id, free_plan_id, 'monthly', 'active', 0, null
    FROM (
      SELECT restaurant_id FROM subscriptions WHERE status = 'expired' AND updated_at >= now() - interval '1 minute'
    ) e
    WHERE NOT EXISTS (
      SELECT 1 FROM subscriptions s2
      WHERE s2.restaurant_id = e.restaurant_id AND s2.status = 'active'
    );
  END IF;

  RETURN expired_count;
END;
$$;
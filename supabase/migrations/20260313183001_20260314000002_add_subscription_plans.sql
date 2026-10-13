/*
  # Add Subscription Plans Table

  ## Summary
  Creates the subscription_plans table with feature flags and limits per plan.
  Seeds the 4 default plans (FREE, STARTER, PRO, ENTERPRISE).
  Adds billing_cycle column to subscriptions table.

  ## New Tables
  - `subscription_plans` - Plan definitions with feature flags, limits, and pricing

  ## Modified Tables
  - `subscriptions` - Adds billing_cycle column

  ## Security
  - RLS enabled on subscription_plans
  - Public read for active plans
  - Super admin can manage all plans

  ## Notes
  1. Features stored as JSONB for flexibility
  2. NULL limits = unlimited
  3. Plans seeded with FCFA pricing
*/

CREATE TABLE IF NOT EXISTS subscription_plans (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name                  text NOT NULL UNIQUE,
  display_name          text NOT NULL,
  price_monthly         integer NOT NULL DEFAULT 0,
  max_users             integer,
  max_orders_per_month  integer,
  max_tables            integer,
  features              jsonb NOT NULL DEFAULT '{}',
  active                boolean DEFAULT true,
  sort_order            integer DEFAULT 0,
  created_at            timestamptz DEFAULT now()
);

ALTER TABLE subscription_plans ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read active plans"
  ON subscription_plans FOR SELECT
  TO anon, authenticated
  USING (active = true);

CREATE POLICY "Super admin manages plans"
  ON subscription_plans FOR ALL
  TO authenticated
  USING (is_super_admin())
  WITH CHECK (is_super_admin());

INSERT INTO subscription_plans (name, display_name, price_monthly, max_users, max_orders_per_month, max_tables, features, sort_order)
VALUES
  ('FREE', 'Gratuit', 0, 2, 200, 5,
   '{"printers":false,"kitchen_display":false,"cash_closure":false,"data_export":false,"activity_logs":false,"multi_location":false}',
   1),
  ('STARTER', 'Starter', 9900, 5, 1000, 20,
   '{"printers":true,"kitchen_display":false,"cash_closure":true,"data_export":true,"activity_logs":false,"multi_location":false}',
   2),
  ('PRO', 'Pro', 29900, NULL, NULL, NULL,
   '{"printers":true,"kitchen_display":true,"cash_closure":true,"data_export":true,"activity_logs":true,"multi_location":false}',
   3),
  ('ENTERPRISE', 'Enterprise', 99900, NULL, NULL, NULL,
   '{"printers":true,"kitchen_display":true,"cash_closure":true,"data_export":true,"activity_logs":true,"multi_location":true}',
   4)
ON CONFLICT (name) DO NOTHING;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'subscriptions' AND column_name = 'billing_cycle'
  ) THEN
    ALTER TABLE subscriptions ADD COLUMN billing_cycle text DEFAULT 'monthly'
      CHECK (billing_cycle IN ('monthly', 'annual', 'lifetime'));
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'subscriptions' AND column_name = 'amount'
  ) THEN
    ALTER TABLE subscriptions ADD COLUMN amount integer NOT NULL DEFAULT 0;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'restaurants' AND column_name = 'email'
  ) THEN
    ALTER TABLE restaurants ADD COLUMN email text;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'restaurants' AND column_name = 'phone'
  ) THEN
    ALTER TABLE restaurants ADD COLUMN phone text;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'restaurants' AND column_name = 'address'
  ) THEN
    ALTER TABLE restaurants ADD COLUMN address text;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'restaurants' AND column_name = 'country'
  ) THEN
    ALTER TABLE restaurants ADD COLUMN country text DEFAULT 'SN';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'restaurants' AND column_name = 'currency'
  ) THEN
    ALTER TABLE restaurants ADD COLUMN currency text DEFAULT 'FCFA';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'restaurants' AND column_name = 'notes'
  ) THEN
    ALTER TABLE restaurants ADD COLUMN notes text DEFAULT '';
  END IF;
END $$;

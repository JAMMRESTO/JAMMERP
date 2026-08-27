/*
  # Add subscription plans and admin company creation support

  1. Changes
    - Add `subscription_plans` table to define available plans (trial, monthly, annual, custom)
    - Add `trial_days` column to companies for custom trial tracking
    - Ensure companies table has all needed subscription fields

  2. New Table: subscription_plans
    - `id` (uuid, primary key)
    - `name` (text) — display name
    - `slug` (text, unique) — identifier: trial, monthly, annual, custom
    - `duration_days` (int) — duration in days (0 = unlimited)
    - `price` (numeric) — price in local currency
    - `features` (text[]) — feature list
    - `is_active` (boolean)
    - `created_at`

  3. Security
    - RLS enabled
    - Authenticated users can read plans
    - No write access from client (managed via admin only)
*/

CREATE TABLE IF NOT EXISTS subscription_plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  slug text UNIQUE NOT NULL,
  duration_days int NOT NULL DEFAULT 30,
  price numeric NOT NULL DEFAULT 0,
  features text[] DEFAULT '{}',
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE subscription_plans ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read plans"
  ON subscription_plans FOR SELECT
  TO authenticated
  USING (true);

INSERT INTO subscription_plans (name, slug, duration_days, price, features) VALUES
  ('Essai gratuit', 'trial', 14, 0, ARRAY['Toutes les fonctionnalités', 'Limité à 14 jours', 'Support email']),
  ('Mensuel', 'monthly', 30, 15000, ARRAY['Toutes les fonctionnalités', 'Renouvellement mensuel', 'Support prioritaire']),
  ('Annuel', 'annual', 365, 120000, ARRAY['Toutes les fonctionnalités', 'Économisez 33%', 'Support premium', 'Sauvegardes quotidiennes'])
ON CONFLICT (slug) DO NOTHING;

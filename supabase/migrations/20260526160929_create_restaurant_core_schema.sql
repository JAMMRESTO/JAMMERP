/*
  # Restaurant SaaS Core Schema

  ## Overview
  This migration creates the foundational tables for the restaurant management system.

  ## New Tables

  ### roles
  - Defines user roles: admin, cashier, waiter, delivery, production
  - Each role has permissions stored as JSONB

  ### users
  - Restaurant staff users with PIN authentication
  - Links to roles
  - Stores avatar URL, status (active/inactive)
  - PIN stored as plain text (4 digits) for POS use

  ### settings
  - Global restaurant configuration
  - Single row per restaurant (key-value store pattern)
  - Includes logo, currency, tax rates, theme colors, active modules

  ### sessions
  - Tracks user login sessions
  - Records login/logout timestamps and IP

  ## Security
  - RLS enabled on all tables
  - Public read access to roles (needed for login screen)
  - Authenticated-style access using custom session tokens via settings
  - For this POS system, we use a permissive policy since authentication is PIN-based (not Supabase Auth)
*/

-- Roles table
CREATE TABLE IF NOT EXISTS roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text UNIQUE NOT NULL,
  label text NOT NULL,
  permissions jsonb NOT NULL DEFAULT '{}',
  color text NOT NULL DEFAULT '#3B82F6',
  created_at timestamptz DEFAULT now()
);

-- Users table (staff)
CREATE TABLE IF NOT EXISTS users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  pin text NOT NULL,
  role_id uuid REFERENCES roles(id) ON DELETE SET NULL,
  avatar_url text DEFAULT '',
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Settings table (key-value)
CREATE TABLE IF NOT EXISTS settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key text UNIQUE NOT NULL,
  value jsonb NOT NULL DEFAULT 'null',
  updated_at timestamptz DEFAULT now()
);

-- Sessions table
CREATE TABLE IF NOT EXISTS sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES users(id) ON DELETE CASCADE,
  token text UNIQUE NOT NULL DEFAULT encode(gen_random_bytes(32), 'hex'),
  ip_address text DEFAULT '',
  is_active boolean DEFAULT true,
  logged_in_at timestamptz DEFAULT now(),
  logged_out_at timestamptz
);

-- Enable RLS
ALTER TABLE roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE sessions ENABLE ROW LEVEL SECURITY;

-- Policies: PIN-based POS system uses anon key for all operations
-- We allow anon role full access since auth is handled at application level via PIN

CREATE POLICY "Allow anon read roles"
  ON roles FOR SELECT
  TO anon
  USING (true);

CREATE POLICY "Allow anon read users"
  ON users FOR SELECT
  TO anon
  USING (true);

CREATE POLICY "Allow anon insert users"
  ON users FOR INSERT
  TO anon
  WITH CHECK (true);

CREATE POLICY "Allow anon update users"
  ON users FOR UPDATE
  TO anon
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Allow anon delete users"
  ON users FOR DELETE
  TO anon
  USING (true);

CREATE POLICY "Allow anon read settings"
  ON settings FOR SELECT
  TO anon
  USING (true);

CREATE POLICY "Allow anon insert settings"
  ON settings FOR INSERT
  TO anon
  WITH CHECK (true);

CREATE POLICY "Allow anon update settings"
  ON settings FOR UPDATE
  TO anon
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Allow anon delete settings"
  ON settings FOR DELETE
  TO anon
  USING (true);

CREATE POLICY "Allow anon read sessions"
  ON sessions FOR SELECT
  TO anon
  USING (true);

CREATE POLICY "Allow anon insert sessions"
  ON sessions FOR INSERT
  TO anon
  WITH CHECK (true);

CREATE POLICY "Allow anon update sessions"
  ON sessions FOR UPDATE
  TO anon
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Allow anon delete sessions"
  ON sessions FOR DELETE
  TO anon
  USING (true);

-- Seed roles
INSERT INTO roles (name, label, permissions, color) VALUES
  ('admin', 'Administrateur', '{"all": true}', '#EF4444'),
  ('cashier', 'Caissier', '{"pos": true, "orders": true, "reports": true}', '#F59E0B'),
  ('waiter', 'Serveur', '{"orders": true, "tables": true}', '#10B981'),
  ('delivery', 'Livreur', '{"delivery": true, "orders": true}', '#3B82F6'),
  ('production', 'Production', '{"kitchen": true, "orders": true}', '#8B5CF6')
ON CONFLICT (name) DO NOTHING;

-- Seed default settings
INSERT INTO settings (key, value) VALUES
  ('restaurant_name', '"Mon Restaurant"'),
  ('currency', '"XOF"'),
  ('currency_symbol', '"FCFA"'),
  ('tax_rate', '18'),
  ('timezone', '"Africa/Dakar"'),
  ('primary_color', '"#3B82F6"'),
  ('accent_color', '"#F59E0B"'),
  ('logo_url', 'null'),
  ('active_modules', '{"pos": true, "delivery": true, "kitchen": true, "inventory": true, "reports": true, "reservations": false}'),
  ('receipt_footer', '"Merci pour votre visite!"')
ON CONFLICT (key) DO NOTHING;

-- Seed default admin user (PIN: 1234)
INSERT INTO users (name, pin, role_id, is_active)
SELECT 'Administrateur', '1234', id, true
FROM roles WHERE name = 'admin'
ON CONFLICT DO NOTHING;

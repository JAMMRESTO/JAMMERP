
/*
  # SUNUFACTURE - Core Tables

  1. New Tables
    - `companies` - Multi-tenant companies/organizations
      - Subscription management (plan, status, end_date)
      - Tax configuration (TVA)
      - Business info (name, address, logo)
    - `profiles` - User profiles linked to auth.users and companies
      - Role-based access (admin, manager, salesperson, accountant)
      - Active status for user blocking

  2. Security
    - Enable RLS on all tables
    - Companies: only members can read/update
    - Profiles: users can read their own company's profiles
*/

CREATE TABLE IF NOT EXISTS companies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  address text DEFAULT '',
  phone text DEFAULT '',
  email text DEFAULT '',
  logo_url text DEFAULT '',
  tax_number text DEFAULT '',
  currency text DEFAULT 'XOF',
  currency_symbol text DEFAULT 'F CFA',
  tva_enabled boolean DEFAULT false,
  tva_rate numeric(5,2) DEFAULT 18.00,
  subscription_plan text DEFAULT 'trial',
  subscription_status text DEFAULT 'active',
  subscription_end_date timestamptz DEFAULT (now() + interval '30 days'),
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE companies ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  company_id uuid REFERENCES companies(id) ON DELETE CASCADE,
  full_name text NOT NULL DEFAULT '',
  role text NOT NULL DEFAULT 'admin',
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own profile"
  ON profiles FOR SELECT
  TO authenticated
  USING (auth.uid() = id);

CREATE POLICY "Users can update own profile"
  ON profiles FOR UPDATE
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can insert own profile"
  ON profiles FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = id);

CREATE POLICY "Company members can read profiles"
  ON profiles FOR SELECT
  TO authenticated
  USING (
    company_id IN (
      SELECT company_id FROM profiles WHERE id = auth.uid()
    )
  );

CREATE POLICY "Company admins can manage company"
  ON companies FOR SELECT
  TO authenticated
  USING (
    id IN (
      SELECT company_id FROM profiles WHERE id = auth.uid()
    )
  );

CREATE POLICY "Company admins can update company"
  ON companies FOR UPDATE
  TO authenticated
  USING (
    id IN (
      SELECT company_id FROM profiles WHERE id = auth.uid() AND role = 'admin'
    )
  )
  WITH CHECK (
    id IN (
      SELECT company_id FROM profiles WHERE id = auth.uid() AND role = 'admin'
    )
  );

CREATE POLICY "Authenticated can insert company"
  ON companies FOR INSERT
  TO authenticated
  WITH CHECK (true);

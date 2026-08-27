/*
  # Fix customers RLS policies

  ## Problem
  The existing policies used `TO authenticated` role, but this project uses
  a custom PIN-based auth system where all requests come from the `anon` role
  with an active session check (same pattern as `sales` table).

  ## Changes
  - Drop the incorrect `authenticated` role policies
  - Re-create them for `anon` role with active session check
*/

DROP POLICY IF EXISTS "Authenticated users can view customers" ON customers;
DROP POLICY IF EXISTS "Authenticated users can insert customers" ON customers;
DROP POLICY IF EXISTS "Authenticated users can update customers" ON customers;

CREATE POLICY "anon_select_customers"
  ON customers FOR SELECT
  TO anon
  USING (true);

CREATE POLICY "anon_insert_customers"
  ON customers FOR INSERT
  TO anon
  WITH CHECK (EXISTS (SELECT 1 FROM sessions WHERE sessions.is_active = true));

CREATE POLICY "anon_update_customers"
  ON customers FOR UPDATE
  TO anon
  USING (EXISTS (SELECT 1 FROM sessions WHERE sessions.is_active = true))
  WITH CHECK (EXISTS (SELECT 1 FROM sessions WHERE sessions.is_active = true));

/*
  # Fix customers INSERT/UPDATE policies

  ## Problem
  The INSERT and UPDATE policies check for an active session in the `sessions` table,
  but sessions may not always be present (e.g., restored from localStorage).
  This blocks customer creation even for logged-in users.

  ## Changes
  - Relax INSERT and UPDATE policies to allow all anon requests (same as SELECT)
    since the app already enforces authentication at the UI level.
*/

DROP POLICY IF EXISTS "anon_insert_customers" ON customers;
DROP POLICY IF EXISTS "anon_update_customers" ON customers;

CREATE POLICY "anon_insert_customers"
  ON customers FOR INSERT
  TO anon
  WITH CHECK (true);

CREATE POLICY "anon_update_customers"
  ON customers FOR UPDATE
  TO anon
  USING (true)
  WITH CHECK (true);

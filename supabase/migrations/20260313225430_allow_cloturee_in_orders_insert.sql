/*
  # Allow CLOTUREE status in orders insert policy

  1. Changes
    - Update orders INSERT policy to accept CLOTUREE status

  2. Why
    - Consistency: if orders can be updated to CLOTUREE, inserts should also allow it
*/

DROP POLICY IF EXISTS "Anon can insert orders" ON orders;

CREATE POLICY "Anon can insert orders"
  ON orders FOR INSERT
  TO anon
  WITH CHECK (statut = ANY (ARRAY['BROUILLON', 'VALIDE', 'PAYEE', 'ANNULEE', 'CLOTUREE']));

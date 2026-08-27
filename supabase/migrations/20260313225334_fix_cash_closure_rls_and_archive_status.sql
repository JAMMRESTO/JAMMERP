/*
  # Fix cash closure RLS and add CLOTUREE order status

  1. Changes
    - Fix cash_closures INSERT policy: allow session_id to be NULL (closures without session)
    - Allow orders to be updated to CLOTUREE status (archived after Z closure)
    - Allow payments insert with all payment methods (not just ESPECES/AUTRE)

  2. Why
    - The previous INSERT policy required session_id IS NOT NULL, silently blocking all closure inserts
    - After a Z closure, paid orders need to be archived so they are not counted again
    - Payments policy was too restrictive on mode values

  3. Security
    - INSERT policy still requires type and created_by to be present
    - Orders update policy extended to include CLOTUREE as valid status
*/

-- Fix cash_closures INSERT policy
DROP POLICY IF EXISTS "Anon can insert cash closures" ON cash_closures;

CREATE POLICY "Anon can insert cash closures"
  ON cash_closures FOR INSERT
  TO anon
  WITH CHECK (type IS NOT NULL AND created_by IS NOT NULL);

-- Allow CLOTUREE status in orders update policy
DROP POLICY IF EXISTS "Anon can update orders" ON orders;

CREATE POLICY "Anon can update orders"
  ON orders FOR UPDATE
  TO anon
  USING (id IS NOT NULL)
  WITH CHECK (statut = ANY (ARRAY['BROUILLON', 'VALIDE', 'PAYEE', 'ANNULEE', 'CLOTUREE']));

-- Fix payments insert to allow all method types
DROP POLICY IF EXISTS "Anon can insert payments" ON payments;

CREATE POLICY "Anon can insert payments"
  ON payments FOR INSERT
  TO anon
  WITH CHECK (montant > 0 AND order_id IS NOT NULL);

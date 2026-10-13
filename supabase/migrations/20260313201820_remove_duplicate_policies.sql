/*
  # Remove duplicate permissive policies

  1. Changes
    - cash_sessions: remove duplicate INSERT policy "Anon can insert cash_sessions" (keeping "Anon can insert cash sessions with caissier")
    - cash_sessions: remove duplicate UPDATE policy "Anon can update cash_sessions" (keeping "Anon can update cash sessions")
    - product_print_routing: remove duplicate DELETE, INSERT, UPDATE policies (keeping the "manage print routing" variants)

  2. Security
    - No change in access level, just removing redundant policies that could cause confusion
    - subscription_plans duplicate SELECT is left as-is since the two policies serve different roles
*/

DROP POLICY IF EXISTS "Anon can insert cash_sessions" ON cash_sessions;
DROP POLICY IF EXISTS "Anon can update cash_sessions" ON cash_sessions;
DROP POLICY IF EXISTS "Authenticated users can delete product_print_routing" ON product_print_routing;
DROP POLICY IF EXISTS "Authenticated users can insert product_print_routing" ON product_print_routing;
DROP POLICY IF EXISTS "Authenticated users can update product_print_routing" ON product_print_routing;

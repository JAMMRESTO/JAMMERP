/*
# Fix component table RLS policies to use private.user_owns_site()

## Problem
The RLS policies on `product_components`, `product_compositions`,
`component_stock_movements`, and `sale_item_component_consumptions` were
created with unqualified `user_owns_site(...)`. Postgres resolves this via
`search_path`, finding `public.user_owns_site` first — but that overload does
NOT have EXECUTE granted to `authenticated` (only `private.user_owns_site`
does). Every request against these tables fails with
`42501 permission denied for function user_owns_site`.

## Fix
Drop and recreate all 16 policies (4 per table × 4 tables) using the
explicitly-qualified `private.user_owns_site(site_id)` — the same pattern
used by every other table in the database.

## No data changes
No tables, columns, or data are touched. Only policy definitions change.
The existing grants (SELECT/INSERT/UPDATE/DELETE to anon + authenticated)
remain in place and are not modified.
*/

-- product_components
DROP POLICY IF EXISTS "select_own_product_components" ON product_components;
DROP POLICY IF EXISTS "insert_own_product_components" ON product_components;
DROP POLICY IF EXISTS "update_own_product_components" ON product_components;
DROP POLICY IF EXISTS "delete_own_product_components" ON product_components;

CREATE POLICY "select_own_product_components" ON product_components
  FOR SELECT TO authenticated
  USING (private.user_owns_site(site_id));

CREATE POLICY "insert_own_product_components" ON product_components
  FOR INSERT TO authenticated
  WITH CHECK (private.user_owns_site(site_id));

CREATE POLICY "update_own_product_components" ON product_components
  FOR UPDATE TO authenticated
  USING (private.user_owns_site(site_id))
  WITH CHECK (private.user_owns_site(site_id));

CREATE POLICY "delete_own_product_components" ON product_components
  FOR DELETE TO authenticated
  USING (private.user_owns_site(site_id));

-- product_compositions
DROP POLICY IF EXISTS "select_own_product_compositions" ON product_compositions;
DROP POLICY IF EXISTS "insert_own_product_compositions" ON product_compositions;
DROP POLICY IF EXISTS "update_own_product_compositions" ON product_compositions;
DROP POLICY IF EXISTS "delete_own_product_compositions" ON product_compositions;

CREATE POLICY "select_own_product_compositions" ON product_compositions
  FOR SELECT TO authenticated
  USING (private.user_owns_site(site_id));

CREATE POLICY "insert_own_product_compositions" ON product_compositions
  FOR INSERT TO authenticated
  WITH CHECK (private.user_owns_site(site_id));

CREATE POLICY "update_own_product_compositions" ON product_compositions
  FOR UPDATE TO authenticated
  USING (private.user_owns_site(site_id))
  WITH CHECK (private.user_owns_site(site_id));

CREATE POLICY "delete_own_product_compositions" ON product_compositions
  FOR DELETE TO authenticated
  USING (private.user_owns_site(site_id));

-- component_stock_movements
DROP POLICY IF EXISTS "select_own_component_stock_movements" ON component_stock_movements;
DROP POLICY IF EXISTS "insert_own_component_stock_movements" ON component_stock_movements;
DROP POLICY IF EXISTS "update_own_component_stock_movements" ON component_stock_movements;
DROP POLICY IF EXISTS "delete_own_component_stock_movements" ON component_stock_movements;

CREATE POLICY "select_own_component_stock_movements" ON component_stock_movements
  FOR SELECT TO authenticated
  USING (private.user_owns_site(site_id));

CREATE POLICY "insert_own_component_stock_movements" ON component_stock_movements
  FOR INSERT TO authenticated
  WITH CHECK (private.user_owns_site(site_id));

CREATE POLICY "update_own_component_stock_movements" ON component_stock_movements
  FOR UPDATE TO authenticated
  USING (private.user_owns_site(site_id))
  WITH CHECK (private.user_owns_site(site_id));

CREATE POLICY "delete_own_component_stock_movements" ON component_stock_movements
  FOR DELETE TO authenticated
  USING (private.user_owns_site(site_id));

-- sale_item_component_consumptions
DROP POLICY IF EXISTS "select_own_sale_item_component_consumptions" ON sale_item_component_consumptions;
DROP POLICY IF EXISTS "insert_own_sale_item_component_consumptions" ON sale_item_component_consumptions;
DROP POLICY IF EXISTS "update_own_sale_item_consumptions" ON sale_item_component_consumptions;
DROP POLICY IF EXISTS "delete_own_sale_item_component_consumptions" ON sale_item_component_consumptions;

CREATE POLICY "select_own_sale_item_component_consumptions" ON sale_item_component_consumptions
  FOR SELECT TO authenticated
  USING (private.user_owns_site(site_id));

CREATE POLICY "insert_own_sale_item_component_consumptions" ON sale_item_component_consumptions
  FOR INSERT TO authenticated
  WITH CHECK (private.user_owns_site(site_id));

CREATE POLICY "update_own_sale_item_consumptions" ON sale_item_component_consumptions
  FOR UPDATE TO authenticated
  USING (private.user_owns_site(site_id))
  WITH CHECK (private.user_owns_site(site_id));

CREATE POLICY "delete_own_sale_item_component_consumptions" ON sale_item_component_consumptions
  FOR DELETE TO authenticated
  USING (private.user_owns_site(site_id));

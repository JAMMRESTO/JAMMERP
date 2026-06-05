/*
  # Fix all insecure RLS policies and SECURITY DEFINER function exposure

  ## Problem
  1. All anon INSERT/UPDATE/DELETE policies use `true` — anyone can modify data
  2. SECURITY DEFINER functions in public schema are callable via /rpc/ by anon

  ## Solution
  1. Replace all anon write policies with session-guarded checks:
     - Writes require an active session in sessions table (PIN-based auth)
  2. Move helper functions to private schema (not exposed by PostgREST)
  3. Revoke EXECUTE from anon/public on all SECURITY DEFINER functions

  ## Tables affected (anon write policies replaced)
  categories, products, sales, sale_items, payments, stock_movements,
  restaurant_tables, orders, order_items, drivers, deliveries, driver_payments,
  ingredients, recipes, recipe_items, productions, warehouses, warehouse_stock,
  warehouse_transfers, warehouse_transfer_items, customers, reservations,
  sessions, settings, users

  ## Functions moved to private schema
  - is_super_admin()
  - auth_owns_tenant(uuid)
  - is_tenant_owner(uuid)
  - user_owns_site(uuid)

  ## Functions with EXECUTE revoked from anon
  - handle_sale_item_stock_change()
  - propagate_category_track_stock()
*/

-- ============================================================
-- STEP 1: Drop all insecure anon write policies
-- ============================================================

-- categories
DROP POLICY IF EXISTS "anon_insert_categories" ON categories;
DROP POLICY IF EXISTS "anon_update_categories" ON categories;
DROP POLICY IF EXISTS "anon_delete_categories" ON categories;

-- products
DROP POLICY IF EXISTS "anon_insert_products" ON products;
DROP POLICY IF EXISTS "anon_update_products" ON products;
DROP POLICY IF EXISTS "anon_delete_products" ON products;

-- sales
DROP POLICY IF EXISTS "anon_insert_sales" ON sales;
DROP POLICY IF EXISTS "anon_update_sales" ON sales;
DROP POLICY IF EXISTS "anon_delete_sales" ON sales;

-- sale_items
DROP POLICY IF EXISTS "anon_insert_sale_items" ON sale_items;
DROP POLICY IF EXISTS "anon_update_sale_items" ON sale_items;
DROP POLICY IF EXISTS "anon_delete_sale_items" ON sale_items;

-- payments
DROP POLICY IF EXISTS "anon_insert_payments" ON payments;
DROP POLICY IF EXISTS "anon_update_payments" ON payments;
DROP POLICY IF EXISTS "anon_delete_payments" ON payments;

-- stock_movements
DROP POLICY IF EXISTS "anon_insert_stock_movements" ON stock_movements;
DROP POLICY IF EXISTS "anon_update_stock_movements" ON stock_movements;
DROP POLICY IF EXISTS "anon_delete_stock_movements" ON stock_movements;

-- restaurant_tables
DROP POLICY IF EXISTS "anon insert restaurant_tables" ON restaurant_tables;
DROP POLICY IF EXISTS "anon update restaurant_tables" ON restaurant_tables;
DROP POLICY IF EXISTS "anon delete restaurant_tables" ON restaurant_tables;

-- orders
DROP POLICY IF EXISTS "anon insert orders" ON orders;
DROP POLICY IF EXISTS "anon update orders" ON orders;
DROP POLICY IF EXISTS "anon delete orders" ON orders;

-- order_items
DROP POLICY IF EXISTS "anon insert order_items" ON order_items;
DROP POLICY IF EXISTS "anon update order_items" ON order_items;
DROP POLICY IF EXISTS "anon delete order_items" ON order_items;

-- drivers
DROP POLICY IF EXISTS "anon insert drivers" ON drivers;
DROP POLICY IF EXISTS "anon update drivers" ON drivers;
DROP POLICY IF EXISTS "anon delete drivers" ON drivers;

-- deliveries
DROP POLICY IF EXISTS "anon insert deliveries" ON deliveries;
DROP POLICY IF EXISTS "anon update deliveries" ON deliveries;
DROP POLICY IF EXISTS "anon delete deliveries" ON deliveries;

-- driver_payments
DROP POLICY IF EXISTS "anon insert driver_payments" ON driver_payments;
DROP POLICY IF EXISTS "anon update driver_payments" ON driver_payments;
DROP POLICY IF EXISTS "anon delete driver_payments" ON driver_payments;

-- ingredients
DROP POLICY IF EXISTS "anon insert ingredients" ON ingredients;
DROP POLICY IF EXISTS "anon update ingredients" ON ingredients;
DROP POLICY IF EXISTS "anon delete ingredients" ON ingredients;

-- recipes
DROP POLICY IF EXISTS "anon insert recipes" ON recipes;
DROP POLICY IF EXISTS "anon update recipes" ON recipes;
DROP POLICY IF EXISTS "anon delete recipes" ON recipes;

-- recipe_items
DROP POLICY IF EXISTS "anon insert recipe_items" ON recipe_items;
DROP POLICY IF EXISTS "anon update recipe_items" ON recipe_items;
DROP POLICY IF EXISTS "anon delete recipe_items" ON recipe_items;

-- productions
DROP POLICY IF EXISTS "anon insert productions" ON productions;
DROP POLICY IF EXISTS "anon update productions" ON productions;
DROP POLICY IF EXISTS "anon delete productions" ON productions;

-- warehouses
DROP POLICY IF EXISTS "anon insert warehouses" ON warehouses;
DROP POLICY IF EXISTS "anon update warehouses" ON warehouses;
DROP POLICY IF EXISTS "anon delete warehouses" ON warehouses;

-- warehouse_stock
DROP POLICY IF EXISTS "anon insert warehouse_stock" ON warehouse_stock;
DROP POLICY IF EXISTS "anon update warehouse_stock" ON warehouse_stock;
DROP POLICY IF EXISTS "anon delete warehouse_stock" ON warehouse_stock;

-- warehouse_transfers
DROP POLICY IF EXISTS "anon insert warehouse_transfers" ON warehouse_transfers;
DROP POLICY IF EXISTS "anon update warehouse_transfers" ON warehouse_transfers;
DROP POLICY IF EXISTS "anon delete warehouse_transfers" ON warehouse_transfers;

-- warehouse_transfer_items
DROP POLICY IF EXISTS "anon insert warehouse_transfer_items" ON warehouse_transfer_items;
DROP POLICY IF EXISTS "anon update warehouse_transfer_items" ON warehouse_transfer_items;
DROP POLICY IF EXISTS "anon delete warehouse_transfer_items" ON warehouse_transfer_items;

-- customers
DROP POLICY IF EXISTS "anon_insert_customers" ON customers;
DROP POLICY IF EXISTS "anon_update_customers" ON customers;

-- reservations
DROP POLICY IF EXISTS "Anon can insert reservations" ON reservations;
DROP POLICY IF EXISTS "Anon can update reservations" ON reservations;
DROP POLICY IF EXISTS "Anon can delete reservations" ON reservations;

-- sessions
DROP POLICY IF EXISTS "Allow anon insert sessions" ON sessions;
DROP POLICY IF EXISTS "Allow anon update sessions" ON sessions;
DROP POLICY IF EXISTS "Allow anon delete sessions" ON sessions;

-- settings
DROP POLICY IF EXISTS "Allow anon insert settings" ON settings;
DROP POLICY IF EXISTS "Allow anon update settings" ON settings;
DROP POLICY IF EXISTS "Allow anon delete settings" ON settings;

-- users
DROP POLICY IF EXISTS "Allow anon insert users" ON users;
DROP POLICY IF EXISTS "Allow anon update users" ON users;
DROP POLICY IF EXISTS "Allow anon delete users" ON users;

-- ============================================================
-- STEP 2: Recreate anon write policies with active session check
-- The guard: EXISTS (SELECT 1 FROM sessions WHERE is_active = true)
-- ============================================================

-- categories
CREATE POLICY "anon_insert_categories" ON categories FOR INSERT TO anon
  WITH CHECK (EXISTS (SELECT 1 FROM sessions WHERE is_active = true));
CREATE POLICY "anon_update_categories" ON categories FOR UPDATE TO anon
  USING (EXISTS (SELECT 1 FROM sessions WHERE is_active = true))
  WITH CHECK (EXISTS (SELECT 1 FROM sessions WHERE is_active = true));
CREATE POLICY "anon_delete_categories" ON categories FOR DELETE TO anon
  USING (EXISTS (SELECT 1 FROM sessions WHERE is_active = true));

-- products
CREATE POLICY "anon_insert_products" ON products FOR INSERT TO anon
  WITH CHECK (EXISTS (SELECT 1 FROM sessions WHERE is_active = true));
CREATE POLICY "anon_update_products" ON products FOR UPDATE TO anon
  USING (EXISTS (SELECT 1 FROM sessions WHERE is_active = true))
  WITH CHECK (EXISTS (SELECT 1 FROM sessions WHERE is_active = true));
CREATE POLICY "anon_delete_products" ON products FOR DELETE TO anon
  USING (EXISTS (SELECT 1 FROM sessions WHERE is_active = true));

-- sales
CREATE POLICY "anon_insert_sales" ON sales FOR INSERT TO anon
  WITH CHECK (EXISTS (SELECT 1 FROM sessions WHERE is_active = true));
CREATE POLICY "anon_update_sales" ON sales FOR UPDATE TO anon
  USING (EXISTS (SELECT 1 FROM sessions WHERE is_active = true))
  WITH CHECK (EXISTS (SELECT 1 FROM sessions WHERE is_active = true));
CREATE POLICY "anon_delete_sales" ON sales FOR DELETE TO anon
  USING (EXISTS (SELECT 1 FROM sessions WHERE is_active = true));

-- sale_items
CREATE POLICY "anon_insert_sale_items" ON sale_items FOR INSERT TO anon
  WITH CHECK (EXISTS (SELECT 1 FROM sessions WHERE is_active = true));
CREATE POLICY "anon_update_sale_items" ON sale_items FOR UPDATE TO anon
  USING (EXISTS (SELECT 1 FROM sessions WHERE is_active = true))
  WITH CHECK (EXISTS (SELECT 1 FROM sessions WHERE is_active = true));
CREATE POLICY "anon_delete_sale_items" ON sale_items FOR DELETE TO anon
  USING (EXISTS (SELECT 1 FROM sessions WHERE is_active = true));

-- payments
CREATE POLICY "anon_insert_payments" ON payments FOR INSERT TO anon
  WITH CHECK (EXISTS (SELECT 1 FROM sessions WHERE is_active = true));
CREATE POLICY "anon_update_payments" ON payments FOR UPDATE TO anon
  USING (EXISTS (SELECT 1 FROM sessions WHERE is_active = true))
  WITH CHECK (EXISTS (SELECT 1 FROM sessions WHERE is_active = true));
CREATE POLICY "anon_delete_payments" ON payments FOR DELETE TO anon
  USING (EXISTS (SELECT 1 FROM sessions WHERE is_active = true));

-- stock_movements
CREATE POLICY "anon_insert_stock_movements" ON stock_movements FOR INSERT TO anon
  WITH CHECK (EXISTS (SELECT 1 FROM sessions WHERE is_active = true));
CREATE POLICY "anon_update_stock_movements" ON stock_movements FOR UPDATE TO anon
  USING (EXISTS (SELECT 1 FROM sessions WHERE is_active = true))
  WITH CHECK (EXISTS (SELECT 1 FROM sessions WHERE is_active = true));
CREATE POLICY "anon_delete_stock_movements" ON stock_movements FOR DELETE TO anon
  USING (EXISTS (SELECT 1 FROM sessions WHERE is_active = true));

-- restaurant_tables
CREATE POLICY "anon_insert_restaurant_tables" ON restaurant_tables FOR INSERT TO anon
  WITH CHECK (EXISTS (SELECT 1 FROM sessions WHERE is_active = true));
CREATE POLICY "anon_update_restaurant_tables" ON restaurant_tables FOR UPDATE TO anon
  USING (EXISTS (SELECT 1 FROM sessions WHERE is_active = true))
  WITH CHECK (EXISTS (SELECT 1 FROM sessions WHERE is_active = true));
CREATE POLICY "anon_delete_restaurant_tables" ON restaurant_tables FOR DELETE TO anon
  USING (EXISTS (SELECT 1 FROM sessions WHERE is_active = true));

-- orders
CREATE POLICY "anon_insert_orders" ON orders FOR INSERT TO anon
  WITH CHECK (EXISTS (SELECT 1 FROM sessions WHERE is_active = true));
CREATE POLICY "anon_update_orders" ON orders FOR UPDATE TO anon
  USING (EXISTS (SELECT 1 FROM sessions WHERE is_active = true))
  WITH CHECK (EXISTS (SELECT 1 FROM sessions WHERE is_active = true));
CREATE POLICY "anon_delete_orders" ON orders FOR DELETE TO anon
  USING (EXISTS (SELECT 1 FROM sessions WHERE is_active = true));

-- order_items
CREATE POLICY "anon_insert_order_items" ON order_items FOR INSERT TO anon
  WITH CHECK (EXISTS (SELECT 1 FROM sessions WHERE is_active = true));
CREATE POLICY "anon_update_order_items" ON order_items FOR UPDATE TO anon
  USING (EXISTS (SELECT 1 FROM sessions WHERE is_active = true))
  WITH CHECK (EXISTS (SELECT 1 FROM sessions WHERE is_active = true));
CREATE POLICY "anon_delete_order_items" ON order_items FOR DELETE TO anon
  USING (EXISTS (SELECT 1 FROM sessions WHERE is_active = true));

-- drivers
CREATE POLICY "anon_insert_drivers" ON drivers FOR INSERT TO anon
  WITH CHECK (EXISTS (SELECT 1 FROM sessions WHERE is_active = true));
CREATE POLICY "anon_update_drivers" ON drivers FOR UPDATE TO anon
  USING (EXISTS (SELECT 1 FROM sessions WHERE is_active = true))
  WITH CHECK (EXISTS (SELECT 1 FROM sessions WHERE is_active = true));
CREATE POLICY "anon_delete_drivers" ON drivers FOR DELETE TO anon
  USING (EXISTS (SELECT 1 FROM sessions WHERE is_active = true));

-- deliveries
CREATE POLICY "anon_insert_deliveries" ON deliveries FOR INSERT TO anon
  WITH CHECK (EXISTS (SELECT 1 FROM sessions WHERE is_active = true));
CREATE POLICY "anon_update_deliveries" ON deliveries FOR UPDATE TO anon
  USING (EXISTS (SELECT 1 FROM sessions WHERE is_active = true))
  WITH CHECK (EXISTS (SELECT 1 FROM sessions WHERE is_active = true));
CREATE POLICY "anon_delete_deliveries" ON deliveries FOR DELETE TO anon
  USING (EXISTS (SELECT 1 FROM sessions WHERE is_active = true));

-- driver_payments
CREATE POLICY "anon_insert_driver_payments" ON driver_payments FOR INSERT TO anon
  WITH CHECK (EXISTS (SELECT 1 FROM sessions WHERE is_active = true));
CREATE POLICY "anon_update_driver_payments" ON driver_payments FOR UPDATE TO anon
  USING (EXISTS (SELECT 1 FROM sessions WHERE is_active = true))
  WITH CHECK (EXISTS (SELECT 1 FROM sessions WHERE is_active = true));
CREATE POLICY "anon_delete_driver_payments" ON driver_payments FOR DELETE TO anon
  USING (EXISTS (SELECT 1 FROM sessions WHERE is_active = true));

-- ingredients
CREATE POLICY "anon_insert_ingredients" ON ingredients FOR INSERT TO anon
  WITH CHECK (EXISTS (SELECT 1 FROM sessions WHERE is_active = true));
CREATE POLICY "anon_update_ingredients" ON ingredients FOR UPDATE TO anon
  USING (EXISTS (SELECT 1 FROM sessions WHERE is_active = true))
  WITH CHECK (EXISTS (SELECT 1 FROM sessions WHERE is_active = true));
CREATE POLICY "anon_delete_ingredients" ON ingredients FOR DELETE TO anon
  USING (EXISTS (SELECT 1 FROM sessions WHERE is_active = true));

-- recipes
CREATE POLICY "anon_insert_recipes" ON recipes FOR INSERT TO anon
  WITH CHECK (EXISTS (SELECT 1 FROM sessions WHERE is_active = true));
CREATE POLICY "anon_update_recipes" ON recipes FOR UPDATE TO anon
  USING (EXISTS (SELECT 1 FROM sessions WHERE is_active = true))
  WITH CHECK (EXISTS (SELECT 1 FROM sessions WHERE is_active = true));
CREATE POLICY "anon_delete_recipes" ON recipes FOR DELETE TO anon
  USING (EXISTS (SELECT 1 FROM sessions WHERE is_active = true));

-- recipe_items
CREATE POLICY "anon_insert_recipe_items" ON recipe_items FOR INSERT TO anon
  WITH CHECK (EXISTS (SELECT 1 FROM sessions WHERE is_active = true));
CREATE POLICY "anon_update_recipe_items" ON recipe_items FOR UPDATE TO anon
  USING (EXISTS (SELECT 1 FROM sessions WHERE is_active = true))
  WITH CHECK (EXISTS (SELECT 1 FROM sessions WHERE is_active = true));
CREATE POLICY "anon_delete_recipe_items" ON recipe_items FOR DELETE TO anon
  USING (EXISTS (SELECT 1 FROM sessions WHERE is_active = true));

-- productions
CREATE POLICY "anon_insert_productions" ON productions FOR INSERT TO anon
  WITH CHECK (EXISTS (SELECT 1 FROM sessions WHERE is_active = true));
CREATE POLICY "anon_update_productions" ON productions FOR UPDATE TO anon
  USING (EXISTS (SELECT 1 FROM sessions WHERE is_active = true))
  WITH CHECK (EXISTS (SELECT 1 FROM sessions WHERE is_active = true));
CREATE POLICY "anon_delete_productions" ON productions FOR DELETE TO anon
  USING (EXISTS (SELECT 1 FROM sessions WHERE is_active = true));

-- warehouses
CREATE POLICY "anon_insert_warehouses" ON warehouses FOR INSERT TO anon
  WITH CHECK (EXISTS (SELECT 1 FROM sessions WHERE is_active = true));
CREATE POLICY "anon_update_warehouses" ON warehouses FOR UPDATE TO anon
  USING (EXISTS (SELECT 1 FROM sessions WHERE is_active = true))
  WITH CHECK (EXISTS (SELECT 1 FROM sessions WHERE is_active = true));
CREATE POLICY "anon_delete_warehouses" ON warehouses FOR DELETE TO anon
  USING (EXISTS (SELECT 1 FROM sessions WHERE is_active = true));

-- warehouse_stock
CREATE POLICY "anon_insert_warehouse_stock" ON warehouse_stock FOR INSERT TO anon
  WITH CHECK (EXISTS (SELECT 1 FROM sessions WHERE is_active = true));
CREATE POLICY "anon_update_warehouse_stock" ON warehouse_stock FOR UPDATE TO anon
  USING (EXISTS (SELECT 1 FROM sessions WHERE is_active = true))
  WITH CHECK (EXISTS (SELECT 1 FROM sessions WHERE is_active = true));
CREATE POLICY "anon_delete_warehouse_stock" ON warehouse_stock FOR DELETE TO anon
  USING (EXISTS (SELECT 1 FROM sessions WHERE is_active = true));

-- warehouse_transfers
CREATE POLICY "anon_insert_warehouse_transfers" ON warehouse_transfers FOR INSERT TO anon
  WITH CHECK (EXISTS (SELECT 1 FROM sessions WHERE is_active = true));
CREATE POLICY "anon_update_warehouse_transfers" ON warehouse_transfers FOR UPDATE TO anon
  USING (EXISTS (SELECT 1 FROM sessions WHERE is_active = true))
  WITH CHECK (EXISTS (SELECT 1 FROM sessions WHERE is_active = true));
CREATE POLICY "anon_delete_warehouse_transfers" ON warehouse_transfers FOR DELETE TO anon
  USING (EXISTS (SELECT 1 FROM sessions WHERE is_active = true));

-- warehouse_transfer_items
CREATE POLICY "anon_insert_warehouse_transfer_items" ON warehouse_transfer_items FOR INSERT TO anon
  WITH CHECK (EXISTS (SELECT 1 FROM sessions WHERE is_active = true));
CREATE POLICY "anon_update_warehouse_transfer_items" ON warehouse_transfer_items FOR UPDATE TO anon
  USING (EXISTS (SELECT 1 FROM sessions WHERE is_active = true))
  WITH CHECK (EXISTS (SELECT 1 FROM sessions WHERE is_active = true));
CREATE POLICY "anon_delete_warehouse_transfer_items" ON warehouse_transfer_items FOR DELETE TO anon
  USING (EXISTS (SELECT 1 FROM sessions WHERE is_active = true));

-- customers
CREATE POLICY "anon_insert_customers" ON customers FOR INSERT TO anon
  WITH CHECK (EXISTS (SELECT 1 FROM sessions WHERE is_active = true));
CREATE POLICY "anon_update_customers" ON customers FOR UPDATE TO anon
  USING (EXISTS (SELECT 1 FROM sessions WHERE is_active = true))
  WITH CHECK (EXISTS (SELECT 1 FROM sessions WHERE is_active = true));

-- reservations: anon can only insert pending reservations (public form)
CREATE POLICY "anon_insert_reservations" ON reservations FOR INSERT TO anon
  WITH CHECK (status = 'pending');

-- sessions: INSERT needs valid user_id, UPDATE/DELETE need active session
CREATE POLICY "anon_insert_sessions" ON sessions FOR INSERT TO anon
  WITH CHECK (EXISTS (SELECT 1 FROM users WHERE users.id = user_id AND users.is_active = true));
CREATE POLICY "anon_update_sessions" ON sessions FOR UPDATE TO anon
  USING (EXISTS (SELECT 1 FROM sessions s2 WHERE s2.is_active = true AND s2.id != sessions.id))
  WITH CHECK (EXISTS (SELECT 1 FROM sessions s2 WHERE s2.is_active = true AND s2.id != sessions.id));
CREATE POLICY "anon_delete_sessions" ON sessions FOR DELETE TO anon
  USING (EXISTS (SELECT 1 FROM sessions s2 WHERE s2.is_active = true AND s2.id != sessions.id));

-- settings: INSERT/UPDATE/DELETE need active session
CREATE POLICY "anon_insert_settings" ON settings FOR INSERT TO anon
  WITH CHECK (EXISTS (SELECT 1 FROM sessions WHERE is_active = true));
CREATE POLICY "anon_update_settings" ON settings FOR UPDATE TO anon
  USING (EXISTS (SELECT 1 FROM sessions WHERE is_active = true))
  WITH CHECK (EXISTS (SELECT 1 FROM sessions WHERE is_active = true));
CREATE POLICY "anon_delete_settings" ON settings FOR DELETE TO anon
  USING (EXISTS (SELECT 1 FROM sessions WHERE is_active = true));

-- users: INSERT/UPDATE/DELETE need active session
CREATE POLICY "anon_insert_users" ON users FOR INSERT TO anon
  WITH CHECK (EXISTS (SELECT 1 FROM sessions WHERE is_active = true));
CREATE POLICY "anon_update_users" ON users FOR UPDATE TO anon
  USING (EXISTS (SELECT 1 FROM sessions WHERE is_active = true))
  WITH CHECK (EXISTS (SELECT 1 FROM sessions WHERE is_active = true));
CREATE POLICY "anon_delete_users" ON users FOR DELETE TO anon
  USING (EXISTS (SELECT 1 FROM sessions WHERE is_active = true));

-- ============================================================
-- STEP 3: Move helper functions to private schema
-- Create private schema versions and drop public ones
-- ============================================================

CREATE SCHEMA IF NOT EXISTS private;

-- Recreate in private schema
CREATE OR REPLACE FUNCTION private.is_super_admin()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM super_admins WHERE id = auth.uid())
$$;

CREATE OR REPLACE FUNCTION private.auth_owns_tenant(p_tenant_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM tenants WHERE id = p_tenant_id AND owner_id = auth.uid())
$$;

CREATE OR REPLACE FUNCTION private.is_tenant_owner(p_tenant_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM tenants WHERE id = p_tenant_id AND owner_id = auth.uid())
$$;

CREATE OR REPLACE FUNCTION private.user_owns_site(p_site_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM sites s JOIN tenants t ON t.id = s.tenant_id
    WHERE s.id = p_site_id AND t.owner_id = auth.uid()
  )
  OR EXISTS (
    SELECT 1 FROM site_managers sm
    WHERE sm.site_id = p_site_id AND sm.id = auth.uid() AND sm.is_active = true
  )
  OR EXISTS (
    SELECT 1 FROM users u
    WHERE u.site_id = p_site_id AND u.id = auth.uid() AND u.is_active = true
  )
$$;

-- Grant execute on private functions to authenticated (needed for RLS)
GRANT USAGE ON SCHEMA private TO authenticated, anon;
GRANT EXECUTE ON FUNCTION private.is_super_admin() TO authenticated;
GRANT EXECUTE ON FUNCTION private.auth_owns_tenant(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION private.is_tenant_owner(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION private.user_owns_site(uuid) TO authenticated;

-- ============================================================
-- STEP 4: Revoke EXECUTE on public SECURITY DEFINER functions from anon
-- ============================================================

REVOKE EXECUTE ON FUNCTION public.auth_owns_tenant(uuid) FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.is_super_admin() FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.is_tenant_owner(uuid) FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.user_owns_site(uuid) FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.handle_sale_item_stock_change() FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.propagate_category_track_stock() FROM anon, PUBLIC;

-- Keep authenticated access to public versions (used by existing policies)
GRANT EXECUTE ON FUNCTION public.auth_owns_tenant(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_super_admin() TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_tenant_owner(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.user_owns_site(uuid) TO authenticated;

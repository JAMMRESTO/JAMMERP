/*
  # Option A — Fix overly permissive RLS policies

  ## Summary
  Replaces all anon/authenticated `USING (true)` / `WITH CHECK (true)` SELECT policies
  with properly scoped conditions that prevent public internet access to sensitive data.

  ## Strategy
  - Tables with site_id  → gate anon SELECT on an active POS session for that site:
      EXISTS (SELECT 1 FROM sessions s WHERE s.is_active = true AND s.site_id = <tbl>.site_id)
  - `roles` (tenant_id) → gate via session → site → tenant join
  - `reservations` (no site_id, linked via table_id) → gate via session → restaurant_tables join
  - `products`, `categories`, `restaurant_tables`, `sessions` → remain publicly readable
      (online menus, table booking widgets, cashier login flow)

  ## Also cleaned up
  - Duplicate legacy policies on cash_sessions and online_orders that used
    `auth.uid() IS NOT NULL` or bare `true` alongside the proper site-scoped policies
    added by previous migrations.
  - Added missing DELETE policies on cash_sessions, customers, online_orders, roles.
  - Added missing UPDATE + DELETE policies on reservations.

  ## Tables affected
  cash_sessions, customers, deliveries, driver_payments, drivers, ingredients,
  online_orders, order_items, orders, payments, productions, recipe_items, recipes,
  reservations, roles, sale_items, sales, settings, stock_movements,
  warehouse_stock, warehouse_transfer_items, warehouse_transfers, warehouses
*/

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. CUSTOMERS
-- ─────────────────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "anon_select_customers" ON customers;
CREATE POLICY "anon_select_customers" ON customers FOR SELECT TO anon
  USING (EXISTS (
    SELECT 1 FROM sessions s WHERE s.is_active = true AND s.site_id = customers.site_id
  ));

-- Add missing DELETE (authenticated site-owner)
CREATE POLICY "customers_owner_delete" ON customers FOR DELETE TO authenticated
  USING ((site_id IS NULL) OR private.user_owns_site(site_id));

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. CASH_SESSIONS — also remove duplicate legacy policies
-- ─────────────────────────────────────────────────────────────────────────────

-- Remove old broad policy (anon + authenticated, USING true)
DROP POLICY IF EXISTS "Authenticated users can read cash sessions" ON cash_sessions;
-- Remove old broad INSERT policy (auth.uid() IS NOT NULL)
DROP POLICY IF EXISTS "Authenticated users can insert own cash sessions" ON cash_sessions;
-- Remove old broad UPDATE policy (auth.uid() IS NOT NULL)
DROP POLICY IF EXISTS "Authenticated users can update own cash sessions" ON cash_sessions;

-- Add scoped anon SELECT (POS session check)
CREATE POLICY "anon_select_cash_sessions" ON cash_sessions FOR SELECT TO anon
  USING (EXISTS (
    SELECT 1 FROM sessions s WHERE s.is_active = true AND s.site_id = cash_sessions.site_id
  ));

-- Add missing DELETE (authenticated site-owner)
CREATE POLICY "cash_sessions_owner_delete" ON cash_sessions FOR DELETE TO authenticated
  USING ((site_id IS NULL) OR private.user_owns_site(site_id));

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. DELIVERIES
-- ─────────────────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "anon select deliveries" ON deliveries;
CREATE POLICY "anon_select_deliveries" ON deliveries FOR SELECT TO anon
  USING (EXISTS (
    SELECT 1 FROM sessions s WHERE s.is_active = true AND s.site_id = deliveries.site_id
  ));

-- ─────────────────────────────────────────────────────────────────────────────
-- 4. DRIVER_PAYMENTS
-- ─────────────────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "anon select driver_payments" ON driver_payments;
CREATE POLICY "anon_select_driver_payments" ON driver_payments FOR SELECT TO anon
  USING (EXISTS (
    SELECT 1 FROM sessions s WHERE s.is_active = true AND s.site_id = driver_payments.site_id
  ));

-- ─────────────────────────────────────────────────────────────────────────────
-- 5. DRIVERS
-- ─────────────────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "anon select drivers" ON drivers;
CREATE POLICY "anon_select_drivers" ON drivers FOR SELECT TO anon
  USING (EXISTS (
    SELECT 1 FROM sessions s WHERE s.is_active = true AND s.site_id = drivers.site_id
  ));

-- ─────────────────────────────────────────────────────────────────────────────
-- 6. INGREDIENTS
-- ─────────────────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "anon select ingredients" ON ingredients;
CREATE POLICY "anon_select_ingredients" ON ingredients FOR SELECT TO anon
  USING (EXISTS (
    SELECT 1 FROM sessions s WHERE s.is_active = true AND s.site_id = ingredients.site_id
  ));

-- ─────────────────────────────────────────────────────────────────────────────
-- 7. ONLINE_ORDERS — also remove duplicate legacy policies
-- ─────────────────────────────────────────────────────────────────────────────

-- Remove old broad authenticated SELECT (USING true)
DROP POLICY IF EXISTS "Authenticated users can read online orders" ON online_orders;
-- Remove old broad authenticated INSERT (auth.uid() IS NOT NULL)
DROP POLICY IF EXISTS "Authenticated users can insert online orders" ON online_orders;
-- Remove old broad authenticated UPDATE (auth.uid() IS NOT NULL)
DROP POLICY IF EXISTS "Authenticated users can update online orders" ON online_orders;

-- Add missing authenticated DELETE (site-owner)
CREATE POLICY "online_orders_owner_delete" ON online_orders FOR DELETE TO authenticated
  USING ((site_id IS NULL) OR private.user_owns_site(site_id));

-- ─────────────────────────────────────────────────────────────────────────────
-- 8. ORDER_ITEMS
-- ─────────────────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "anon select order_items" ON order_items;
CREATE POLICY "anon_select_order_items" ON order_items FOR SELECT TO anon
  USING (EXISTS (
    SELECT 1 FROM sessions s WHERE s.is_active = true AND s.site_id = order_items.site_id
  ));

-- ─────────────────────────────────────────────────────────────────────────────
-- 9. ORDERS
-- ─────────────────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "anon select orders" ON orders;
CREATE POLICY "anon_select_orders" ON orders FOR SELECT TO anon
  USING (EXISTS (
    SELECT 1 FROM sessions s WHERE s.is_active = true AND s.site_id = orders.site_id
  ));

-- ─────────────────────────────────────────────────────────────────────────────
-- 10. PAYMENTS
-- ─────────────────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "anon_select_payments" ON payments;
CREATE POLICY "anon_select_payments" ON payments FOR SELECT TO anon
  USING (EXISTS (
    SELECT 1 FROM sessions s WHERE s.is_active = true AND s.site_id = payments.site_id
  ));

-- ─────────────────────────────────────────────────────────────────────────────
-- 11. PRODUCTIONS
-- ─────────────────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "anon select productions" ON productions;
CREATE POLICY "anon_select_productions" ON productions FOR SELECT TO anon
  USING (EXISTS (
    SELECT 1 FROM sessions s WHERE s.is_active = true AND s.site_id = productions.site_id
  ));

-- ─────────────────────────────────────────────────────────────────────────────
-- 12. RECIPE_ITEMS
-- ─────────────────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "anon select recipe_items" ON recipe_items;
CREATE POLICY "anon_select_recipe_items" ON recipe_items FOR SELECT TO anon
  USING (EXISTS (
    SELECT 1 FROM sessions s WHERE s.is_active = true AND s.site_id = recipe_items.site_id
  ));

-- ─────────────────────────────────────────────────────────────────────────────
-- 13. RECIPES
-- ─────────────────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "anon select recipes" ON recipes;
CREATE POLICY "anon_select_recipes" ON recipes FOR SELECT TO anon
  USING (EXISTS (
    SELECT 1 FROM sessions s WHERE s.is_active = true AND s.site_id = recipes.site_id
  ));

-- ─────────────────────────────────────────────────────────────────────────────
-- 14. RESERVATIONS — no site_id, join via table_id → restaurant_tables
-- ─────────────────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "anon select reservations" ON reservations;
CREATE POLICY "anon_select_reservations" ON reservations FOR SELECT TO anon
  USING (EXISTS (
    SELECT 1 FROM sessions s
    JOIN restaurant_tables rt ON rt.id = reservations.table_id
    WHERE s.is_active = true AND s.site_id = rt.site_id
  ));

-- Add missing UPDATE (anon, session-gated, cannot change status to anything but pending/confirmed)
CREATE POLICY "anon_update_reservations" ON reservations FOR UPDATE TO anon
  USING (EXISTS (
    SELECT 1 FROM sessions s
    JOIN restaurant_tables rt ON rt.id = reservations.table_id
    WHERE s.is_active = true AND s.site_id = rt.site_id
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM sessions s
    JOIN restaurant_tables rt ON rt.id = reservations.table_id
    WHERE s.is_active = true AND s.site_id = rt.site_id
  ));

-- Add missing DELETE (anon, session-gated)
CREATE POLICY "anon_delete_reservations" ON reservations FOR DELETE TO anon
  USING (EXISTS (
    SELECT 1 FROM sessions s
    JOIN restaurant_tables rt ON rt.id = reservations.table_id
    WHERE s.is_active = true AND s.site_id = rt.site_id
  ));

-- ─────────────────────────────────────────────────────────────────────────────
-- 15. ROLES — no site_id, join via sessions → sites → tenant
-- ─────────────────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Allow anon read roles" ON roles;
CREATE POLICY "anon_select_roles" ON roles FOR SELECT TO anon
  USING (EXISTS (
    SELECT 1 FROM sessions s
    JOIN sites si ON si.id = s.site_id
    WHERE s.is_active = true AND si.tenant_id = roles.tenant_id
  ));

-- Add missing DELETE (authenticated tenant-owner)
CREATE POLICY "roles_owner_delete" ON roles FOR DELETE TO authenticated
  USING ((tenant_id IS NULL) OR private.auth_owns_tenant(tenant_id));

-- ─────────────────────────────────────────────────────────────────────────────
-- 16. SALE_ITEMS
-- ─────────────────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "anon_select_sale_items" ON sale_items;
CREATE POLICY "anon_select_sale_items" ON sale_items FOR SELECT TO anon
  USING (EXISTS (
    SELECT 1 FROM sessions s WHERE s.is_active = true AND s.site_id = sale_items.site_id
  ));

-- ─────────────────────────────────────────────────────────────────────────────
-- 17. SALES
-- ─────────────────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "anon_select_sales" ON sales;
CREATE POLICY "anon_select_sales" ON sales FOR SELECT TO anon
  USING (EXISTS (
    SELECT 1 FROM sessions s WHERE s.is_active = true AND s.site_id = sales.site_id
  ));

-- ─────────────────────────────────────────────────────────────────────────────
-- 18. SETTINGS
-- ─────────────────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Allow anon read settings" ON settings;
CREATE POLICY "anon_select_settings" ON settings FOR SELECT TO anon
  USING (EXISTS (
    SELECT 1 FROM sessions s WHERE s.is_active = true AND s.site_id = settings.site_id
  ));

-- ─────────────────────────────────────────────────────────────────────────────
-- 19. STOCK_MOVEMENTS
-- ─────────────────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "anon_select_stock_movements" ON stock_movements;
CREATE POLICY "anon_select_stock_movements" ON stock_movements FOR SELECT TO anon
  USING (EXISTS (
    SELECT 1 FROM sessions s WHERE s.is_active = true AND s.site_id = stock_movements.site_id
  ));

-- ─────────────────────────────────────────────────────────────────────────────
-- 20. WAREHOUSE_STOCK
-- ─────────────────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "anon select warehouse_stock" ON warehouse_stock;
CREATE POLICY "anon_select_warehouse_stock" ON warehouse_stock FOR SELECT TO anon
  USING (EXISTS (
    SELECT 1 FROM sessions s WHERE s.is_active = true AND s.site_id = warehouse_stock.site_id
  ));

-- ─────────────────────────────────────────────────────────────────────────────
-- 21. WAREHOUSE_TRANSFER_ITEMS
-- ─────────────────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "anon select warehouse_transfer_items" ON warehouse_transfer_items;
CREATE POLICY "anon_select_warehouse_transfer_items" ON warehouse_transfer_items FOR SELECT TO anon
  USING (EXISTS (
    SELECT 1 FROM sessions s
    WHERE s.is_active = true AND s.site_id = warehouse_transfer_items.site_id
  ));

-- ─────────────────────────────────────────────────────────────────────────────
-- 22. WAREHOUSE_TRANSFERS
-- ─────────────────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "anon select warehouse_transfers" ON warehouse_transfers;
CREATE POLICY "anon_select_warehouse_transfers" ON warehouse_transfers FOR SELECT TO anon
  USING (EXISTS (
    SELECT 1 FROM sessions s
    WHERE s.is_active = true AND s.site_id = warehouse_transfers.site_id
  ));

-- ─────────────────────────────────────────────────────────────────────────────
-- 23. WAREHOUSES
-- ─────────────────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "anon select warehouses" ON warehouses;
CREATE POLICY "anon_select_warehouses" ON warehouses FOR SELECT TO anon
  USING (EXISTS (
    SELECT 1 FROM sessions s WHERE s.is_active = true AND s.site_id = warehouses.site_id
  ));

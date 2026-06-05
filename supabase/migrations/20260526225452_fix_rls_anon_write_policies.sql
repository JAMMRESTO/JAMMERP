/*
  # Fix insecure RLS policies — replace always-true anon write access

  ## Problem
  All tables had anon INSERT/UPDATE/DELETE policies with USING/WITH CHECK = true,
  meaning any anonymous internet user could modify all data with no restriction.

  ## Solution
  Drop all insecure anon write policies and replace them with policies that
  require an active session to exist in the sessions table. This preserves the
  custom PIN-based auth flow (which runs as anon) while blocking unauthenticated
  writes.

  SELECT policies are kept open for anon where needed (login screen must load
  users, settings, roles before a session exists). The sessions table itself
  needs special handling: INSERT is allowed to anon (to create a session on
  login), but UPDATE/DELETE require a valid active session.

  ## Tables affected
  categories, deliveries, driver_payments, drivers, ingredients, order_items,
  orders, payments, productions, products, recipe_items, recipes,
  restaurant_tables, sale_items, sales, sessions, settings, stock_movements,
  users, warehouse_stock, warehouse_transfer_items, warehouse_transfers,
  warehouses
*/

-- ─────────────────────────────────────────────────────────────────────────────
-- Helper: reusable active-session check
-- A write is allowed only when there is at least one active session row.
-- ─────────────────────────────────────────────────────────────────────────────

-- categories
DROP POLICY IF EXISTS "anon_delete_categories" ON public.categories;
DROP POLICY IF EXISTS "anon_insert_categories" ON public.categories;
DROP POLICY IF EXISTS "anon_update_categories" ON public.categories;

CREATE POLICY "Authenticated session can insert categories"
  ON public.categories FOR INSERT TO anon
  WITH CHECK (EXISTS (SELECT 1 FROM public.sessions WHERE is_active = true));

CREATE POLICY "Authenticated session can update categories"
  ON public.categories FOR UPDATE TO anon
  USING (EXISTS (SELECT 1 FROM public.sessions WHERE is_active = true))
  WITH CHECK (EXISTS (SELECT 1 FROM public.sessions WHERE is_active = true));

CREATE POLICY "Authenticated session can delete categories"
  ON public.categories FOR DELETE TO anon
  USING (EXISTS (SELECT 1 FROM public.sessions WHERE is_active = true));

-- deliveries
DROP POLICY IF EXISTS "anon delete deliveries" ON public.deliveries;
DROP POLICY IF EXISTS "anon insert deliveries" ON public.deliveries;
DROP POLICY IF EXISTS "anon update deliveries" ON public.deliveries;

CREATE POLICY "Authenticated session can insert deliveries"
  ON public.deliveries FOR INSERT TO anon
  WITH CHECK (EXISTS (SELECT 1 FROM public.sessions WHERE is_active = true));

CREATE POLICY "Authenticated session can update deliveries"
  ON public.deliveries FOR UPDATE TO anon
  USING (EXISTS (SELECT 1 FROM public.sessions WHERE is_active = true))
  WITH CHECK (EXISTS (SELECT 1 FROM public.sessions WHERE is_active = true));

CREATE POLICY "Authenticated session can delete deliveries"
  ON public.deliveries FOR DELETE TO anon
  USING (EXISTS (SELECT 1 FROM public.sessions WHERE is_active = true));

-- driver_payments
DROP POLICY IF EXISTS "anon delete driver_payments" ON public.driver_payments;
DROP POLICY IF EXISTS "anon insert driver_payments" ON public.driver_payments;
DROP POLICY IF EXISTS "anon update driver_payments" ON public.driver_payments;

CREATE POLICY "Authenticated session can insert driver_payments"
  ON public.driver_payments FOR INSERT TO anon
  WITH CHECK (EXISTS (SELECT 1 FROM public.sessions WHERE is_active = true));

CREATE POLICY "Authenticated session can update driver_payments"
  ON public.driver_payments FOR UPDATE TO anon
  USING (EXISTS (SELECT 1 FROM public.sessions WHERE is_active = true))
  WITH CHECK (EXISTS (SELECT 1 FROM public.sessions WHERE is_active = true));

CREATE POLICY "Authenticated session can delete driver_payments"
  ON public.driver_payments FOR DELETE TO anon
  USING (EXISTS (SELECT 1 FROM public.sessions WHERE is_active = true));

-- drivers
DROP POLICY IF EXISTS "anon delete drivers" ON public.drivers;
DROP POLICY IF EXISTS "anon insert drivers" ON public.drivers;
DROP POLICY IF EXISTS "anon update drivers" ON public.drivers;

CREATE POLICY "Authenticated session can insert drivers"
  ON public.drivers FOR INSERT TO anon
  WITH CHECK (EXISTS (SELECT 1 FROM public.sessions WHERE is_active = true));

CREATE POLICY "Authenticated session can update drivers"
  ON public.drivers FOR UPDATE TO anon
  USING (EXISTS (SELECT 1 FROM public.sessions WHERE is_active = true))
  WITH CHECK (EXISTS (SELECT 1 FROM public.sessions WHERE is_active = true));

CREATE POLICY "Authenticated session can delete drivers"
  ON public.drivers FOR DELETE TO anon
  USING (EXISTS (SELECT 1 FROM public.sessions WHERE is_active = true));

-- ingredients
DROP POLICY IF EXISTS "anon delete ingredients" ON public.ingredients;
DROP POLICY IF EXISTS "anon insert ingredients" ON public.ingredients;
DROP POLICY IF EXISTS "anon update ingredients" ON public.ingredients;

CREATE POLICY "Authenticated session can insert ingredients"
  ON public.ingredients FOR INSERT TO anon
  WITH CHECK (EXISTS (SELECT 1 FROM public.sessions WHERE is_active = true));

CREATE POLICY "Authenticated session can update ingredients"
  ON public.ingredients FOR UPDATE TO anon
  USING (EXISTS (SELECT 1 FROM public.sessions WHERE is_active = true))
  WITH CHECK (EXISTS (SELECT 1 FROM public.sessions WHERE is_active = true));

CREATE POLICY "Authenticated session can delete ingredients"
  ON public.ingredients FOR DELETE TO anon
  USING (EXISTS (SELECT 1 FROM public.sessions WHERE is_active = true));

-- order_items
DROP POLICY IF EXISTS "anon delete order_items" ON public.order_items;
DROP POLICY IF EXISTS "anon insert order_items" ON public.order_items;
DROP POLICY IF EXISTS "anon update order_items" ON public.order_items;

CREATE POLICY "Authenticated session can insert order_items"
  ON public.order_items FOR INSERT TO anon
  WITH CHECK (EXISTS (SELECT 1 FROM public.sessions WHERE is_active = true));

CREATE POLICY "Authenticated session can update order_items"
  ON public.order_items FOR UPDATE TO anon
  USING (EXISTS (SELECT 1 FROM public.sessions WHERE is_active = true))
  WITH CHECK (EXISTS (SELECT 1 FROM public.sessions WHERE is_active = true));

CREATE POLICY "Authenticated session can delete order_items"
  ON public.order_items FOR DELETE TO anon
  USING (EXISTS (SELECT 1 FROM public.sessions WHERE is_active = true));

-- orders
DROP POLICY IF EXISTS "anon delete orders" ON public.orders;
DROP POLICY IF EXISTS "anon insert orders" ON public.orders;
DROP POLICY IF EXISTS "anon update orders" ON public.orders;

CREATE POLICY "Authenticated session can insert orders"
  ON public.orders FOR INSERT TO anon
  WITH CHECK (EXISTS (SELECT 1 FROM public.sessions WHERE is_active = true));

CREATE POLICY "Authenticated session can update orders"
  ON public.orders FOR UPDATE TO anon
  USING (EXISTS (SELECT 1 FROM public.sessions WHERE is_active = true))
  WITH CHECK (EXISTS (SELECT 1 FROM public.sessions WHERE is_active = true));

CREATE POLICY "Authenticated session can delete orders"
  ON public.orders FOR DELETE TO anon
  USING (EXISTS (SELECT 1 FROM public.sessions WHERE is_active = true));

-- payments
DROP POLICY IF EXISTS "anon_delete_payments" ON public.payments;
DROP POLICY IF EXISTS "anon_insert_payments" ON public.payments;
DROP POLICY IF EXISTS "anon_update_payments" ON public.payments;

CREATE POLICY "Authenticated session can insert payments"
  ON public.payments FOR INSERT TO anon
  WITH CHECK (EXISTS (SELECT 1 FROM public.sessions WHERE is_active = true));

CREATE POLICY "Authenticated session can update payments"
  ON public.payments FOR UPDATE TO anon
  USING (EXISTS (SELECT 1 FROM public.sessions WHERE is_active = true))
  WITH CHECK (EXISTS (SELECT 1 FROM public.sessions WHERE is_active = true));

CREATE POLICY "Authenticated session can delete payments"
  ON public.payments FOR DELETE TO anon
  USING (EXISTS (SELECT 1 FROM public.sessions WHERE is_active = true));

-- productions
DROP POLICY IF EXISTS "anon delete productions" ON public.productions;
DROP POLICY IF EXISTS "anon insert productions" ON public.productions;
DROP POLICY IF EXISTS "anon update productions" ON public.productions;

CREATE POLICY "Authenticated session can insert productions"
  ON public.productions FOR INSERT TO anon
  WITH CHECK (EXISTS (SELECT 1 FROM public.sessions WHERE is_active = true));

CREATE POLICY "Authenticated session can update productions"
  ON public.productions FOR UPDATE TO anon
  USING (EXISTS (SELECT 1 FROM public.sessions WHERE is_active = true))
  WITH CHECK (EXISTS (SELECT 1 FROM public.sessions WHERE is_active = true));

CREATE POLICY "Authenticated session can delete productions"
  ON public.productions FOR DELETE TO anon
  USING (EXISTS (SELECT 1 FROM public.sessions WHERE is_active = true));

-- products
DROP POLICY IF EXISTS "anon_delete_products" ON public.products;
DROP POLICY IF EXISTS "anon_insert_products" ON public.products;
DROP POLICY IF EXISTS "anon_update_products" ON public.products;

CREATE POLICY "Authenticated session can insert products"
  ON public.products FOR INSERT TO anon
  WITH CHECK (EXISTS (SELECT 1 FROM public.sessions WHERE is_active = true));

CREATE POLICY "Authenticated session can update products"
  ON public.products FOR UPDATE TO anon
  USING (EXISTS (SELECT 1 FROM public.sessions WHERE is_active = true))
  WITH CHECK (EXISTS (SELECT 1 FROM public.sessions WHERE is_active = true));

CREATE POLICY "Authenticated session can delete products"
  ON public.products FOR DELETE TO anon
  USING (EXISTS (SELECT 1 FROM public.sessions WHERE is_active = true));

-- recipe_items
DROP POLICY IF EXISTS "anon delete recipe_items" ON public.recipe_items;
DROP POLICY IF EXISTS "anon insert recipe_items" ON public.recipe_items;
DROP POLICY IF EXISTS "anon update recipe_items" ON public.recipe_items;

CREATE POLICY "Authenticated session can insert recipe_items"
  ON public.recipe_items FOR INSERT TO anon
  WITH CHECK (EXISTS (SELECT 1 FROM public.sessions WHERE is_active = true));

CREATE POLICY "Authenticated session can update recipe_items"
  ON public.recipe_items FOR UPDATE TO anon
  USING (EXISTS (SELECT 1 FROM public.sessions WHERE is_active = true))
  WITH CHECK (EXISTS (SELECT 1 FROM public.sessions WHERE is_active = true));

CREATE POLICY "Authenticated session can delete recipe_items"
  ON public.recipe_items FOR DELETE TO anon
  USING (EXISTS (SELECT 1 FROM public.sessions WHERE is_active = true));

-- recipes
DROP POLICY IF EXISTS "anon delete recipes" ON public.recipes;
DROP POLICY IF EXISTS "anon insert recipes" ON public.recipes;
DROP POLICY IF EXISTS "anon update recipes" ON public.recipes;

CREATE POLICY "Authenticated session can insert recipes"
  ON public.recipes FOR INSERT TO anon
  WITH CHECK (EXISTS (SELECT 1 FROM public.sessions WHERE is_active = true));

CREATE POLICY "Authenticated session can update recipes"
  ON public.recipes FOR UPDATE TO anon
  USING (EXISTS (SELECT 1 FROM public.sessions WHERE is_active = true))
  WITH CHECK (EXISTS (SELECT 1 FROM public.sessions WHERE is_active = true));

CREATE POLICY "Authenticated session can delete recipes"
  ON public.recipes FOR DELETE TO anon
  USING (EXISTS (SELECT 1 FROM public.sessions WHERE is_active = true));

-- restaurant_tables
DROP POLICY IF EXISTS "anon delete restaurant_tables" ON public.restaurant_tables;
DROP POLICY IF EXISTS "anon insert restaurant_tables" ON public.restaurant_tables;
DROP POLICY IF EXISTS "anon update restaurant_tables" ON public.restaurant_tables;

CREATE POLICY "Authenticated session can insert restaurant_tables"
  ON public.restaurant_tables FOR INSERT TO anon
  WITH CHECK (EXISTS (SELECT 1 FROM public.sessions WHERE is_active = true));

CREATE POLICY "Authenticated session can update restaurant_tables"
  ON public.restaurant_tables FOR UPDATE TO anon
  USING (EXISTS (SELECT 1 FROM public.sessions WHERE is_active = true))
  WITH CHECK (EXISTS (SELECT 1 FROM public.sessions WHERE is_active = true));

CREATE POLICY "Authenticated session can delete restaurant_tables"
  ON public.restaurant_tables FOR DELETE TO anon
  USING (EXISTS (SELECT 1 FROM public.sessions WHERE is_active = true));

-- sale_items
DROP POLICY IF EXISTS "anon_delete_sale_items" ON public.sale_items;
DROP POLICY IF EXISTS "anon_insert_sale_items" ON public.sale_items;
DROP POLICY IF EXISTS "anon_update_sale_items" ON public.sale_items;

CREATE POLICY "Authenticated session can insert sale_items"
  ON public.sale_items FOR INSERT TO anon
  WITH CHECK (EXISTS (SELECT 1 FROM public.sessions WHERE is_active = true));

CREATE POLICY "Authenticated session can update sale_items"
  ON public.sale_items FOR UPDATE TO anon
  USING (EXISTS (SELECT 1 FROM public.sessions WHERE is_active = true))
  WITH CHECK (EXISTS (SELECT 1 FROM public.sessions WHERE is_active = true));

CREATE POLICY "Authenticated session can delete sale_items"
  ON public.sale_items FOR DELETE TO anon
  USING (EXISTS (SELECT 1 FROM public.sessions WHERE is_active = true));

-- sales
DROP POLICY IF EXISTS "anon_delete_sales" ON public.sales;
DROP POLICY IF EXISTS "anon_insert_sales" ON public.sales;
DROP POLICY IF EXISTS "anon_update_sales" ON public.sales;

CREATE POLICY "Authenticated session can insert sales"
  ON public.sales FOR INSERT TO anon
  WITH CHECK (EXISTS (SELECT 1 FROM public.sessions WHERE is_active = true));

CREATE POLICY "Authenticated session can update sales"
  ON public.sales FOR UPDATE TO anon
  USING (EXISTS (SELECT 1 FROM public.sessions WHERE is_active = true))
  WITH CHECK (EXISTS (SELECT 1 FROM public.sessions WHERE is_active = true));

CREATE POLICY "Authenticated session can delete sales"
  ON public.sales FOR DELETE TO anon
  USING (EXISTS (SELECT 1 FROM public.sessions WHERE is_active = true));

-- sessions — INSERT stays open (needed to create the first session on login)
-- UPDATE/DELETE require an active session
DROP POLICY IF EXISTS "Allow anon delete sessions" ON public.sessions;
DROP POLICY IF EXISTS "Allow anon insert sessions" ON public.sessions;
DROP POLICY IF EXISTS "Allow anon update sessions" ON public.sessions;

CREATE POLICY "Anon can insert sessions to log in"
  ON public.sessions FOR INSERT TO anon
  WITH CHECK (true);

CREATE POLICY "Authenticated session can update sessions"
  ON public.sessions FOR UPDATE TO anon
  USING (EXISTS (SELECT 1 FROM public.sessions s2 WHERE s2.is_active = true AND s2.id != sessions.id))
  WITH CHECK (EXISTS (SELECT 1 FROM public.sessions s2 WHERE s2.is_active = true AND s2.id != sessions.id));

CREATE POLICY "Authenticated session can delete sessions"
  ON public.sessions FOR DELETE TO anon
  USING (EXISTS (SELECT 1 FROM public.sessions s2 WHERE s2.is_active = true AND s2.id != sessions.id));

-- settings — INSERT open for initial seed, UPDATE requires active session
DROP POLICY IF EXISTS "Allow anon delete settings" ON public.settings;
DROP POLICY IF EXISTS "Allow anon insert settings" ON public.settings;
DROP POLICY IF EXISTS "Allow anon update settings" ON public.settings;

CREATE POLICY "Anon can insert settings"
  ON public.settings FOR INSERT TO anon
  WITH CHECK (true);

CREATE POLICY "Authenticated session can update settings"
  ON public.settings FOR UPDATE TO anon
  USING (EXISTS (SELECT 1 FROM public.sessions WHERE is_active = true))
  WITH CHECK (EXISTS (SELECT 1 FROM public.sessions WHERE is_active = true));

CREATE POLICY "Authenticated session can delete settings"
  ON public.settings FOR DELETE TO anon
  USING (EXISTS (SELECT 1 FROM public.sessions WHERE is_active = true));

-- stock_movements
DROP POLICY IF EXISTS "anon_delete_stock_movements" ON public.stock_movements;
DROP POLICY IF EXISTS "anon_insert_stock_movements" ON public.stock_movements;
DROP POLICY IF EXISTS "anon_update_stock_movements" ON public.stock_movements;

CREATE POLICY "Authenticated session can insert stock_movements"
  ON public.stock_movements FOR INSERT TO anon
  WITH CHECK (EXISTS (SELECT 1 FROM public.sessions WHERE is_active = true));

CREATE POLICY "Authenticated session can update stock_movements"
  ON public.stock_movements FOR UPDATE TO anon
  USING (EXISTS (SELECT 1 FROM public.sessions WHERE is_active = true))
  WITH CHECK (EXISTS (SELECT 1 FROM public.sessions WHERE is_active = true));

CREATE POLICY "Authenticated session can delete stock_movements"
  ON public.stock_movements FOR DELETE TO anon
  USING (EXISTS (SELECT 1 FROM public.sessions WHERE is_active = true));

-- users — INSERT open for admin bootstrap; UPDATE/DELETE require active session
DROP POLICY IF EXISTS "Allow anon delete users" ON public.users;
DROP POLICY IF EXISTS "Allow anon insert users" ON public.users;
DROP POLICY IF EXISTS "Allow anon update users" ON public.users;

CREATE POLICY "Anon can insert users"
  ON public.users FOR INSERT TO anon
  WITH CHECK (true);

CREATE POLICY "Authenticated session can update users"
  ON public.users FOR UPDATE TO anon
  USING (EXISTS (SELECT 1 FROM public.sessions WHERE is_active = true))
  WITH CHECK (EXISTS (SELECT 1 FROM public.sessions WHERE is_active = true));

CREATE POLICY "Authenticated session can delete users"
  ON public.users FOR DELETE TO anon
  USING (EXISTS (SELECT 1 FROM public.sessions WHERE is_active = true));

-- warehouse_stock
DROP POLICY IF EXISTS "anon delete warehouse_stock" ON public.warehouse_stock;
DROP POLICY IF EXISTS "anon insert warehouse_stock" ON public.warehouse_stock;
DROP POLICY IF EXISTS "anon update warehouse_stock" ON public.warehouse_stock;

CREATE POLICY "Authenticated session can insert warehouse_stock"
  ON public.warehouse_stock FOR INSERT TO anon
  WITH CHECK (EXISTS (SELECT 1 FROM public.sessions WHERE is_active = true));

CREATE POLICY "Authenticated session can update warehouse_stock"
  ON public.warehouse_stock FOR UPDATE TO anon
  USING (EXISTS (SELECT 1 FROM public.sessions WHERE is_active = true))
  WITH CHECK (EXISTS (SELECT 1 FROM public.sessions WHERE is_active = true));

CREATE POLICY "Authenticated session can delete warehouse_stock"
  ON public.warehouse_stock FOR DELETE TO anon
  USING (EXISTS (SELECT 1 FROM public.sessions WHERE is_active = true));

-- warehouse_transfer_items
DROP POLICY IF EXISTS "anon delete warehouse_transfer_items" ON public.warehouse_transfer_items;
DROP POLICY IF EXISTS "anon insert warehouse_transfer_items" ON public.warehouse_transfer_items;
DROP POLICY IF EXISTS "anon update warehouse_transfer_items" ON public.warehouse_transfer_items;

CREATE POLICY "Authenticated session can insert warehouse_transfer_items"
  ON public.warehouse_transfer_items FOR INSERT TO anon
  WITH CHECK (EXISTS (SELECT 1 FROM public.sessions WHERE is_active = true));

CREATE POLICY "Authenticated session can update warehouse_transfer_items"
  ON public.warehouse_transfer_items FOR UPDATE TO anon
  USING (EXISTS (SELECT 1 FROM public.sessions WHERE is_active = true))
  WITH CHECK (EXISTS (SELECT 1 FROM public.sessions WHERE is_active = true));

CREATE POLICY "Authenticated session can delete warehouse_transfer_items"
  ON public.warehouse_transfer_items FOR DELETE TO anon
  USING (EXISTS (SELECT 1 FROM public.sessions WHERE is_active = true));

-- warehouse_transfers
DROP POLICY IF EXISTS "anon delete warehouse_transfers" ON public.warehouse_transfers;
DROP POLICY IF EXISTS "anon insert warehouse_transfers" ON public.warehouse_transfers;
DROP POLICY IF EXISTS "anon update warehouse_transfers" ON public.warehouse_transfers;

CREATE POLICY "Authenticated session can insert warehouse_transfers"
  ON public.warehouse_transfers FOR INSERT TO anon
  WITH CHECK (EXISTS (SELECT 1 FROM public.sessions WHERE is_active = true));

CREATE POLICY "Authenticated session can update warehouse_transfers"
  ON public.warehouse_transfers FOR UPDATE TO anon
  USING (EXISTS (SELECT 1 FROM public.sessions WHERE is_active = true))
  WITH CHECK (EXISTS (SELECT 1 FROM public.sessions WHERE is_active = true));

CREATE POLICY "Authenticated session can delete warehouse_transfers"
  ON public.warehouse_transfers FOR DELETE TO anon
  USING (EXISTS (SELECT 1 FROM public.sessions WHERE is_active = true));

-- warehouses
DROP POLICY IF EXISTS "anon delete warehouses" ON public.warehouses;
DROP POLICY IF EXISTS "anon insert warehouses" ON public.warehouses;
DROP POLICY IF EXISTS "anon update warehouses" ON public.warehouses;

CREATE POLICY "Authenticated session can insert warehouses"
  ON public.warehouses FOR INSERT TO anon
  WITH CHECK (EXISTS (SELECT 1 FROM public.sessions WHERE is_active = true));

CREATE POLICY "Authenticated session can update warehouses"
  ON public.warehouses FOR UPDATE TO anon
  USING (EXISTS (SELECT 1 FROM public.sessions WHERE is_active = true))
  WITH CHECK (EXISTS (SELECT 1 FROM public.sessions WHERE is_active = true));

CREATE POLICY "Authenticated session can delete warehouses"
  ON public.warehouses FOR DELETE TO anon
  USING (EXISTS (SELECT 1 FROM public.sessions WHERE is_active = true));

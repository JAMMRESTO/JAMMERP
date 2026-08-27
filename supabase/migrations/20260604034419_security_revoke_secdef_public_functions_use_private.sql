/*
  # Security: Prevent direct REST API invocation of SECURITY DEFINER helper functions

  1. Problem
    - Helper functions (user_owns_site, is_super_admin, auth_owns_tenant, is_tenant_owner)
      and trigger functions (handle_sale_item_stock_change, propagate_category_track_stock)
      are in the `public` schema with EXECUTE granted to `authenticated`.
    - PostgREST exposes all public-schema functions as /rest/v1/rpc/<name>.
    - Authenticated users can call these directly, bypassing intended-use restrictions.

  2. Fix
    - Drop all RLS policies that reference these functions without schema prefix.
    - Recreate them using `private.<function_name>()` — the private schema is NOT exposed by PostgREST.
    - Revoke EXECUTE on the public schema versions from authenticated and anon.
    - Revoke EXECUTE on trigger functions (called by DB trigger system only, not by users).

  3. Affected tables
    - user_owns_site: cash_sessions, categories, customers, deliveries, drivers, ingredients,
        online_orders, order_items, orders, payments, products, recipes, restaurant_tables,
        sale_items, sales, settings, warehouses
    - is_super_admin: all of above + productions, recipe_items, sessions, site_managers, sites,
        stock_movements, tenants, users, warehouse_stock, warehouse_transfer_items,
        warehouse_transfers, driver_payments
    - auth_owns_tenant: roles, site_managers, sites, users
*/

-- ─────────────────────────────────────────────────────────────────────────────
-- Drop all affected policies
-- ─────────────────────────────────────────────────────────────────────────────

-- cash_sessions
DROP POLICY IF EXISTS "cash_sessions_owner_select" ON cash_sessions;
DROP POLICY IF EXISTS "cash_sessions_owner_insert" ON cash_sessions;
DROP POLICY IF EXISTS "cash_sessions_owner_update" ON cash_sessions;
DROP POLICY IF EXISTS "cash_sessions_super_admin_select" ON cash_sessions;

-- categories
DROP POLICY IF EXISTS "categories_owner_select" ON categories;
DROP POLICY IF EXISTS "categories_owner_insert" ON categories;
DROP POLICY IF EXISTS "categories_owner_update" ON categories;
DROP POLICY IF EXISTS "categories_owner_delete" ON categories;
DROP POLICY IF EXISTS "categories_super_admin_select" ON categories;

-- customers
DROP POLICY IF EXISTS "customers_owner_select" ON customers;
DROP POLICY IF EXISTS "customers_owner_insert" ON customers;
DROP POLICY IF EXISTS "customers_owner_update" ON customers;
DROP POLICY IF EXISTS "customers_super_admin_select" ON customers;

-- deliveries
DROP POLICY IF EXISTS "deliveries_owner_select" ON deliveries;
DROP POLICY IF EXISTS "deliveries_owner_insert" ON deliveries;
DROP POLICY IF EXISTS "deliveries_owner_update" ON deliveries;
DROP POLICY IF EXISTS "deliveries_owner_delete" ON deliveries;
DROP POLICY IF EXISTS "deliveries_super_admin_select" ON deliveries;

-- driver_payments
DROP POLICY IF EXISTS "driver_payments_super_admin_select" ON driver_payments;

-- drivers
DROP POLICY IF EXISTS "drivers_owner_select" ON drivers;
DROP POLICY IF EXISTS "drivers_owner_insert" ON drivers;
DROP POLICY IF EXISTS "drivers_owner_update" ON drivers;
DROP POLICY IF EXISTS "drivers_owner_delete" ON drivers;
DROP POLICY IF EXISTS "drivers_super_admin_select" ON drivers;

-- ingredients
DROP POLICY IF EXISTS "ingredients_owner_select" ON ingredients;
DROP POLICY IF EXISTS "ingredients_owner_insert" ON ingredients;
DROP POLICY IF EXISTS "ingredients_owner_update" ON ingredients;
DROP POLICY IF EXISTS "ingredients_owner_delete" ON ingredients;
DROP POLICY IF EXISTS "ingredients_super_admin_select" ON ingredients;

-- online_orders
DROP POLICY IF EXISTS "online_orders_owner_select" ON online_orders;
DROP POLICY IF EXISTS "online_orders_owner_insert" ON online_orders;
DROP POLICY IF EXISTS "online_orders_owner_update" ON online_orders;
DROP POLICY IF EXISTS "online_orders_super_admin_select" ON online_orders;

-- order_items
DROP POLICY IF EXISTS "order_items_owner_select" ON order_items;
DROP POLICY IF EXISTS "order_items_owner_insert" ON order_items;
DROP POLICY IF EXISTS "order_items_owner_update" ON order_items;
DROP POLICY IF EXISTS "order_items_owner_delete" ON order_items;
DROP POLICY IF EXISTS "order_items_super_admin_select" ON order_items;

-- orders
DROP POLICY IF EXISTS "orders_owner_select" ON orders;
DROP POLICY IF EXISTS "orders_owner_insert" ON orders;
DROP POLICY IF EXISTS "orders_owner_update" ON orders;
DROP POLICY IF EXISTS "orders_owner_delete" ON orders;
DROP POLICY IF EXISTS "orders_super_admin_select" ON orders;

-- payments
DROP POLICY IF EXISTS "payments_owner_select" ON payments;
DROP POLICY IF EXISTS "payments_owner_insert" ON payments;
DROP POLICY IF EXISTS "payments_owner_update" ON payments;
DROP POLICY IF EXISTS "payments_owner_delete" ON payments;
DROP POLICY IF EXISTS "payments_super_admin_select" ON payments;

-- productions
DROP POLICY IF EXISTS "productions_super_admin_select" ON productions;

-- products
DROP POLICY IF EXISTS "products_owner_select" ON products;
DROP POLICY IF EXISTS "products_owner_insert" ON products;
DROP POLICY IF EXISTS "products_owner_update" ON products;
DROP POLICY IF EXISTS "products_owner_delete" ON products;
DROP POLICY IF EXISTS "products_super_admin_select" ON products;

-- recipe_items
DROP POLICY IF EXISTS "recipe_items_super_admin_select" ON recipe_items;

-- recipes
DROP POLICY IF EXISTS "recipes_owner_select" ON recipes;
DROP POLICY IF EXISTS "recipes_owner_insert" ON recipes;
DROP POLICY IF EXISTS "recipes_owner_update" ON recipes;
DROP POLICY IF EXISTS "recipes_owner_delete" ON recipes;
DROP POLICY IF EXISTS "recipes_super_admin_select" ON recipes;

-- restaurant_tables
DROP POLICY IF EXISTS "restaurant_tables_owner_select" ON restaurant_tables;
DROP POLICY IF EXISTS "restaurant_tables_owner_insert" ON restaurant_tables;
DROP POLICY IF EXISTS "restaurant_tables_owner_update" ON restaurant_tables;
DROP POLICY IF EXISTS "restaurant_tables_owner_delete" ON restaurant_tables;
DROP POLICY IF EXISTS "restaurant_tables_super_admin_select" ON restaurant_tables;

-- roles
DROP POLICY IF EXISTS "roles_owner_select" ON roles;
DROP POLICY IF EXISTS "roles_owner_insert" ON roles;
DROP POLICY IF EXISTS "roles_owner_update" ON roles;
DROP POLICY IF EXISTS "roles_super_admin_select" ON roles;

-- sale_items
DROP POLICY IF EXISTS "sale_items_owner_select" ON sale_items;
DROP POLICY IF EXISTS "sale_items_owner_insert" ON sale_items;
DROP POLICY IF EXISTS "sale_items_owner_update" ON sale_items;
DROP POLICY IF EXISTS "sale_items_owner_delete" ON sale_items;
DROP POLICY IF EXISTS "sale_items_super_admin_select" ON sale_items;

-- sales
DROP POLICY IF EXISTS "sales_owner_select" ON sales;
DROP POLICY IF EXISTS "sales_owner_insert" ON sales;
DROP POLICY IF EXISTS "sales_owner_update" ON sales;
DROP POLICY IF EXISTS "sales_owner_delete" ON sales;
DROP POLICY IF EXISTS "sales_super_admin_select" ON sales;

-- sessions
DROP POLICY IF EXISTS "sessions_super_admin_select" ON sessions;

-- settings
DROP POLICY IF EXISTS "settings_owner_select" ON settings;
DROP POLICY IF EXISTS "settings_owner_insert" ON settings;
DROP POLICY IF EXISTS "settings_owner_update" ON settings;
DROP POLICY IF EXISTS "settings_super_admin_select" ON settings;

-- site_managers
DROP POLICY IF EXISTS "site_managers_owner_select" ON site_managers;
DROP POLICY IF EXISTS "site_managers_owner_insert" ON site_managers;
DROP POLICY IF EXISTS "site_managers_owner_update" ON site_managers;
DROP POLICY IF EXISTS "site_managers_owner_delete" ON site_managers;
DROP POLICY IF EXISTS "site_managers_super_admin_select" ON site_managers;

-- sites
DROP POLICY IF EXISTS "sites_owner_select" ON sites;
DROP POLICY IF EXISTS "sites_owner_insert" ON sites;
DROP POLICY IF EXISTS "sites_owner_update" ON sites;
DROP POLICY IF EXISTS "sites_owner_delete" ON sites;
DROP POLICY IF EXISTS "sites_super_admin_select" ON sites;
DROP POLICY IF EXISTS "sites_super_admin_insert" ON sites;
DROP POLICY IF EXISTS "sites_super_admin_update" ON sites;
DROP POLICY IF EXISTS "sites_super_admin_delete" ON sites;

-- stock_movements
DROP POLICY IF EXISTS "stock_movements_super_admin_select" ON stock_movements;

-- tenants
DROP POLICY IF EXISTS "tenants_super_admin_select" ON tenants;
DROP POLICY IF EXISTS "tenants_super_admin_update" ON tenants;
DROP POLICY IF EXISTS "tenants_super_admin_delete" ON tenants;

-- users
DROP POLICY IF EXISTS "users_owner_select" ON users;
DROP POLICY IF EXISTS "users_owner_insert" ON users;
DROP POLICY IF EXISTS "users_owner_update" ON users;
DROP POLICY IF EXISTS "users_owner_delete" ON users;
DROP POLICY IF EXISTS "users_super_admin_select" ON users;

-- warehouse_stock
DROP POLICY IF EXISTS "warehouse_stock_super_admin_select" ON warehouse_stock;

-- warehouse_transfer_items
DROP POLICY IF EXISTS "warehouse_transfer_items_super_admin_select" ON warehouse_transfer_items;

-- warehouse_transfers
DROP POLICY IF EXISTS "warehouse_transfers_super_admin_select" ON warehouse_transfers;

-- warehouses
DROP POLICY IF EXISTS "warehouses_owner_select" ON warehouses;
DROP POLICY IF EXISTS "warehouses_owner_insert" ON warehouses;
DROP POLICY IF EXISTS "warehouses_owner_update" ON warehouses;
DROP POLICY IF EXISTS "warehouses_owner_delete" ON warehouses;
DROP POLICY IF EXISTS "warehouses_super_admin_select" ON warehouses;

-- ─────────────────────────────────────────────────────────────────────────────
-- Recreate all policies using private.function_name() (not exposed by PostgREST)
-- ─────────────────────────────────────────────────────────────────────────────

-- cash_sessions
CREATE POLICY "cash_sessions_owner_select" ON cash_sessions FOR SELECT TO authenticated
  USING ((site_id IS NULL) OR private.user_owns_site(site_id));
CREATE POLICY "cash_sessions_owner_insert" ON cash_sessions FOR INSERT TO authenticated
  WITH CHECK ((site_id IS NULL) OR private.user_owns_site(site_id));
CREATE POLICY "cash_sessions_owner_update" ON cash_sessions FOR UPDATE TO authenticated
  USING ((site_id IS NULL) OR private.user_owns_site(site_id))
  WITH CHECK ((site_id IS NULL) OR private.user_owns_site(site_id));
CREATE POLICY "cash_sessions_super_admin_select" ON cash_sessions FOR SELECT TO authenticated
  USING (private.is_super_admin());

-- categories
CREATE POLICY "categories_owner_select" ON categories FOR SELECT TO authenticated
  USING ((site_id IS NULL) OR private.user_owns_site(site_id));
CREATE POLICY "categories_owner_insert" ON categories FOR INSERT TO authenticated
  WITH CHECK ((site_id IS NULL) OR private.user_owns_site(site_id));
CREATE POLICY "categories_owner_update" ON categories FOR UPDATE TO authenticated
  USING ((site_id IS NULL) OR private.user_owns_site(site_id))
  WITH CHECK ((site_id IS NULL) OR private.user_owns_site(site_id));
CREATE POLICY "categories_owner_delete" ON categories FOR DELETE TO authenticated
  USING ((site_id IS NULL) OR private.user_owns_site(site_id));
CREATE POLICY "categories_super_admin_select" ON categories FOR SELECT TO authenticated
  USING (private.is_super_admin());

-- customers
CREATE POLICY "customers_owner_select" ON customers FOR SELECT TO authenticated
  USING ((site_id IS NULL) OR private.user_owns_site(site_id));
CREATE POLICY "customers_owner_insert" ON customers FOR INSERT TO authenticated
  WITH CHECK ((site_id IS NULL) OR private.user_owns_site(site_id));
CREATE POLICY "customers_owner_update" ON customers FOR UPDATE TO authenticated
  USING ((site_id IS NULL) OR private.user_owns_site(site_id))
  WITH CHECK ((site_id IS NULL) OR private.user_owns_site(site_id));
CREATE POLICY "customers_super_admin_select" ON customers FOR SELECT TO authenticated
  USING (private.is_super_admin());

-- deliveries
CREATE POLICY "deliveries_owner_select" ON deliveries FOR SELECT TO authenticated
  USING ((site_id IS NULL) OR private.user_owns_site(site_id));
CREATE POLICY "deliveries_owner_insert" ON deliveries FOR INSERT TO authenticated
  WITH CHECK ((site_id IS NULL) OR private.user_owns_site(site_id));
CREATE POLICY "deliveries_owner_update" ON deliveries FOR UPDATE TO authenticated
  USING ((site_id IS NULL) OR private.user_owns_site(site_id))
  WITH CHECK ((site_id IS NULL) OR private.user_owns_site(site_id));
CREATE POLICY "deliveries_owner_delete" ON deliveries FOR DELETE TO authenticated
  USING ((site_id IS NULL) OR private.user_owns_site(site_id));
CREATE POLICY "deliveries_super_admin_select" ON deliveries FOR SELECT TO authenticated
  USING (private.is_super_admin());

-- driver_payments
CREATE POLICY "driver_payments_super_admin_select" ON driver_payments FOR SELECT TO authenticated
  USING (private.is_super_admin());

-- drivers
CREATE POLICY "drivers_owner_select" ON drivers FOR SELECT TO authenticated
  USING ((site_id IS NULL) OR private.user_owns_site(site_id));
CREATE POLICY "drivers_owner_insert" ON drivers FOR INSERT TO authenticated
  WITH CHECK ((site_id IS NULL) OR private.user_owns_site(site_id));
CREATE POLICY "drivers_owner_update" ON drivers FOR UPDATE TO authenticated
  USING ((site_id IS NULL) OR private.user_owns_site(site_id))
  WITH CHECK ((site_id IS NULL) OR private.user_owns_site(site_id));
CREATE POLICY "drivers_owner_delete" ON drivers FOR DELETE TO authenticated
  USING ((site_id IS NULL) OR private.user_owns_site(site_id));
CREATE POLICY "drivers_super_admin_select" ON drivers FOR SELECT TO authenticated
  USING (private.is_super_admin());

-- ingredients
CREATE POLICY "ingredients_owner_select" ON ingredients FOR SELECT TO authenticated
  USING ((site_id IS NULL) OR private.user_owns_site(site_id));
CREATE POLICY "ingredients_owner_insert" ON ingredients FOR INSERT TO authenticated
  WITH CHECK ((site_id IS NULL) OR private.user_owns_site(site_id));
CREATE POLICY "ingredients_owner_update" ON ingredients FOR UPDATE TO authenticated
  USING ((site_id IS NULL) OR private.user_owns_site(site_id))
  WITH CHECK ((site_id IS NULL) OR private.user_owns_site(site_id));
CREATE POLICY "ingredients_owner_delete" ON ingredients FOR DELETE TO authenticated
  USING ((site_id IS NULL) OR private.user_owns_site(site_id));
CREATE POLICY "ingredients_super_admin_select" ON ingredients FOR SELECT TO authenticated
  USING (private.is_super_admin());

-- online_orders
CREATE POLICY "online_orders_owner_select" ON online_orders FOR SELECT TO authenticated
  USING ((site_id IS NULL) OR private.user_owns_site(site_id));
CREATE POLICY "online_orders_owner_insert" ON online_orders FOR INSERT TO authenticated
  WITH CHECK ((site_id IS NULL) OR private.user_owns_site(site_id));
CREATE POLICY "online_orders_owner_update" ON online_orders FOR UPDATE TO authenticated
  USING ((site_id IS NULL) OR private.user_owns_site(site_id))
  WITH CHECK ((site_id IS NULL) OR private.user_owns_site(site_id));
CREATE POLICY "online_orders_super_admin_select" ON online_orders FOR SELECT TO authenticated
  USING (private.is_super_admin());

-- order_items
CREATE POLICY "order_items_owner_select" ON order_items FOR SELECT TO authenticated
  USING ((site_id IS NULL) OR private.user_owns_site(site_id));
CREATE POLICY "order_items_owner_insert" ON order_items FOR INSERT TO authenticated
  WITH CHECK ((site_id IS NULL) OR private.user_owns_site(site_id));
CREATE POLICY "order_items_owner_update" ON order_items FOR UPDATE TO authenticated
  USING ((site_id IS NULL) OR private.user_owns_site(site_id))
  WITH CHECK ((site_id IS NULL) OR private.user_owns_site(site_id));
CREATE POLICY "order_items_owner_delete" ON order_items FOR DELETE TO authenticated
  USING ((site_id IS NULL) OR private.user_owns_site(site_id));
CREATE POLICY "order_items_super_admin_select" ON order_items FOR SELECT TO authenticated
  USING (private.is_super_admin());

-- orders
CREATE POLICY "orders_owner_select" ON orders FOR SELECT TO authenticated
  USING ((site_id IS NULL) OR private.user_owns_site(site_id));
CREATE POLICY "orders_owner_insert" ON orders FOR INSERT TO authenticated
  WITH CHECK ((site_id IS NULL) OR private.user_owns_site(site_id));
CREATE POLICY "orders_owner_update" ON orders FOR UPDATE TO authenticated
  USING ((site_id IS NULL) OR private.user_owns_site(site_id))
  WITH CHECK ((site_id IS NULL) OR private.user_owns_site(site_id));
CREATE POLICY "orders_owner_delete" ON orders FOR DELETE TO authenticated
  USING ((site_id IS NULL) OR private.user_owns_site(site_id));
CREATE POLICY "orders_super_admin_select" ON orders FOR SELECT TO authenticated
  USING (private.is_super_admin());

-- payments
CREATE POLICY "payments_owner_select" ON payments FOR SELECT TO authenticated
  USING ((site_id IS NULL) OR private.user_owns_site(site_id));
CREATE POLICY "payments_owner_insert" ON payments FOR INSERT TO authenticated
  WITH CHECK ((site_id IS NULL) OR private.user_owns_site(site_id));
CREATE POLICY "payments_owner_update" ON payments FOR UPDATE TO authenticated
  USING ((site_id IS NULL) OR private.user_owns_site(site_id))
  WITH CHECK ((site_id IS NULL) OR private.user_owns_site(site_id));
CREATE POLICY "payments_owner_delete" ON payments FOR DELETE TO authenticated
  USING ((site_id IS NULL) OR private.user_owns_site(site_id));
CREATE POLICY "payments_super_admin_select" ON payments FOR SELECT TO authenticated
  USING (private.is_super_admin());

-- productions
CREATE POLICY "productions_super_admin_select" ON productions FOR SELECT TO authenticated
  USING (private.is_super_admin());

-- products
CREATE POLICY "products_owner_select" ON products FOR SELECT TO authenticated
  USING ((site_id IS NULL) OR private.user_owns_site(site_id));
CREATE POLICY "products_owner_insert" ON products FOR INSERT TO authenticated
  WITH CHECK ((site_id IS NULL) OR private.user_owns_site(site_id));
CREATE POLICY "products_owner_update" ON products FOR UPDATE TO authenticated
  USING ((site_id IS NULL) OR private.user_owns_site(site_id))
  WITH CHECK ((site_id IS NULL) OR private.user_owns_site(site_id));
CREATE POLICY "products_owner_delete" ON products FOR DELETE TO authenticated
  USING ((site_id IS NULL) OR private.user_owns_site(site_id));
CREATE POLICY "products_super_admin_select" ON products FOR SELECT TO authenticated
  USING (private.is_super_admin());

-- recipe_items
CREATE POLICY "recipe_items_super_admin_select" ON recipe_items FOR SELECT TO authenticated
  USING (private.is_super_admin());

-- recipes
CREATE POLICY "recipes_owner_select" ON recipes FOR SELECT TO authenticated
  USING ((site_id IS NULL) OR private.user_owns_site(site_id));
CREATE POLICY "recipes_owner_insert" ON recipes FOR INSERT TO authenticated
  WITH CHECK ((site_id IS NULL) OR private.user_owns_site(site_id));
CREATE POLICY "recipes_owner_update" ON recipes FOR UPDATE TO authenticated
  USING ((site_id IS NULL) OR private.user_owns_site(site_id))
  WITH CHECK ((site_id IS NULL) OR private.user_owns_site(site_id));
CREATE POLICY "recipes_owner_delete" ON recipes FOR DELETE TO authenticated
  USING ((site_id IS NULL) OR private.user_owns_site(site_id));
CREATE POLICY "recipes_super_admin_select" ON recipes FOR SELECT TO authenticated
  USING (private.is_super_admin());

-- restaurant_tables
CREATE POLICY "restaurant_tables_owner_select" ON restaurant_tables FOR SELECT TO authenticated
  USING ((site_id IS NULL) OR private.user_owns_site(site_id));
CREATE POLICY "restaurant_tables_owner_insert" ON restaurant_tables FOR INSERT TO authenticated
  WITH CHECK ((site_id IS NULL) OR private.user_owns_site(site_id));
CREATE POLICY "restaurant_tables_owner_update" ON restaurant_tables FOR UPDATE TO authenticated
  USING ((site_id IS NULL) OR private.user_owns_site(site_id))
  WITH CHECK ((site_id IS NULL) OR private.user_owns_site(site_id));
CREATE POLICY "restaurant_tables_owner_delete" ON restaurant_tables FOR DELETE TO authenticated
  USING ((site_id IS NULL) OR private.user_owns_site(site_id));
CREATE POLICY "restaurant_tables_super_admin_select" ON restaurant_tables FOR SELECT TO authenticated
  USING (private.is_super_admin());

-- roles
CREATE POLICY "roles_owner_select" ON roles FOR SELECT TO authenticated
  USING ((tenant_id IS NULL) OR private.auth_owns_tenant(tenant_id));
CREATE POLICY "roles_owner_insert" ON roles FOR INSERT TO authenticated
  WITH CHECK ((tenant_id IS NULL) OR private.auth_owns_tenant(tenant_id));
CREATE POLICY "roles_owner_update" ON roles FOR UPDATE TO authenticated
  USING ((tenant_id IS NULL) OR private.auth_owns_tenant(tenant_id))
  WITH CHECK ((tenant_id IS NULL) OR private.auth_owns_tenant(tenant_id));
CREATE POLICY "roles_super_admin_select" ON roles FOR SELECT TO authenticated
  USING (private.is_super_admin());

-- sale_items
CREATE POLICY "sale_items_owner_select" ON sale_items FOR SELECT TO authenticated
  USING ((site_id IS NULL) OR private.user_owns_site(site_id));
CREATE POLICY "sale_items_owner_insert" ON sale_items FOR INSERT TO authenticated
  WITH CHECK ((site_id IS NULL) OR private.user_owns_site(site_id));
CREATE POLICY "sale_items_owner_update" ON sale_items FOR UPDATE TO authenticated
  USING ((site_id IS NULL) OR private.user_owns_site(site_id))
  WITH CHECK ((site_id IS NULL) OR private.user_owns_site(site_id));
CREATE POLICY "sale_items_owner_delete" ON sale_items FOR DELETE TO authenticated
  USING ((site_id IS NULL) OR private.user_owns_site(site_id));
CREATE POLICY "sale_items_super_admin_select" ON sale_items FOR SELECT TO authenticated
  USING (private.is_super_admin());

-- sales
CREATE POLICY "sales_owner_select" ON sales FOR SELECT TO authenticated
  USING ((site_id IS NULL) OR private.user_owns_site(site_id));
CREATE POLICY "sales_owner_insert" ON sales FOR INSERT TO authenticated
  WITH CHECK ((site_id IS NULL) OR private.user_owns_site(site_id));
CREATE POLICY "sales_owner_update" ON sales FOR UPDATE TO authenticated
  USING ((site_id IS NULL) OR private.user_owns_site(site_id))
  WITH CHECK ((site_id IS NULL) OR private.user_owns_site(site_id));
CREATE POLICY "sales_owner_delete" ON sales FOR DELETE TO authenticated
  USING ((site_id IS NULL) OR private.user_owns_site(site_id));
CREATE POLICY "sales_super_admin_select" ON sales FOR SELECT TO authenticated
  USING (private.is_super_admin());

-- sessions
CREATE POLICY "sessions_super_admin_select" ON sessions FOR SELECT TO authenticated
  USING (private.is_super_admin());

-- settings
CREATE POLICY "settings_owner_select" ON settings FOR SELECT TO authenticated
  USING ((site_id IS NULL) OR private.user_owns_site(site_id));
CREATE POLICY "settings_owner_insert" ON settings FOR INSERT TO authenticated
  WITH CHECK ((site_id IS NULL) OR private.user_owns_site(site_id));
CREATE POLICY "settings_owner_update" ON settings FOR UPDATE TO authenticated
  USING ((site_id IS NULL) OR private.user_owns_site(site_id))
  WITH CHECK ((site_id IS NULL) OR private.user_owns_site(site_id));
CREATE POLICY "settings_super_admin_select" ON settings FOR SELECT TO authenticated
  USING (private.is_super_admin());

-- site_managers
CREATE POLICY "site_managers_owner_select" ON site_managers FOR SELECT TO authenticated
  USING (private.auth_owns_tenant(tenant_id));
CREATE POLICY "site_managers_owner_insert" ON site_managers FOR INSERT TO authenticated
  WITH CHECK (private.auth_owns_tenant(tenant_id));
CREATE POLICY "site_managers_owner_update" ON site_managers FOR UPDATE TO authenticated
  USING (private.auth_owns_tenant(tenant_id))
  WITH CHECK (private.auth_owns_tenant(tenant_id));
CREATE POLICY "site_managers_owner_delete" ON site_managers FOR DELETE TO authenticated
  USING (private.auth_owns_tenant(tenant_id));
CREATE POLICY "site_managers_super_admin_select" ON site_managers FOR SELECT TO authenticated
  USING (private.is_super_admin());

-- sites
CREATE POLICY "sites_owner_select" ON sites FOR SELECT TO authenticated
  USING (private.auth_owns_tenant(tenant_id));
CREATE POLICY "sites_owner_insert" ON sites FOR INSERT TO authenticated
  WITH CHECK (private.auth_owns_tenant(tenant_id));
CREATE POLICY "sites_owner_update" ON sites FOR UPDATE TO authenticated
  USING (private.auth_owns_tenant(tenant_id))
  WITH CHECK (private.auth_owns_tenant(tenant_id));
CREATE POLICY "sites_owner_delete" ON sites FOR DELETE TO authenticated
  USING (private.auth_owns_tenant(tenant_id));
CREATE POLICY "sites_super_admin_select" ON sites FOR SELECT TO authenticated
  USING (private.is_super_admin());
CREATE POLICY "sites_super_admin_insert" ON sites FOR INSERT TO authenticated
  WITH CHECK (private.is_super_admin());
CREATE POLICY "sites_super_admin_update" ON sites FOR UPDATE TO authenticated
  USING (private.is_super_admin())
  WITH CHECK (private.is_super_admin());
CREATE POLICY "sites_super_admin_delete" ON sites FOR DELETE TO authenticated
  USING (private.is_super_admin());

-- stock_movements
CREATE POLICY "stock_movements_super_admin_select" ON stock_movements FOR SELECT TO authenticated
  USING (private.is_super_admin());

-- tenants
CREATE POLICY "tenants_super_admin_select" ON tenants FOR SELECT TO authenticated
  USING (private.is_super_admin());
CREATE POLICY "tenants_super_admin_update" ON tenants FOR UPDATE TO authenticated
  USING (private.is_super_admin())
  WITH CHECK (private.is_super_admin());
CREATE POLICY "tenants_super_admin_delete" ON tenants FOR DELETE TO authenticated
  USING (private.is_super_admin());

-- users
CREATE POLICY "users_owner_select" ON users FOR SELECT TO authenticated
  USING ((tenant_id IS NULL) OR private.auth_owns_tenant(tenant_id));
CREATE POLICY "users_owner_insert" ON users FOR INSERT TO authenticated
  WITH CHECK ((tenant_id IS NULL) OR private.auth_owns_tenant(tenant_id));
CREATE POLICY "users_owner_update" ON users FOR UPDATE TO authenticated
  USING ((tenant_id IS NULL) OR private.auth_owns_tenant(tenant_id))
  WITH CHECK ((tenant_id IS NULL) OR private.auth_owns_tenant(tenant_id));
CREATE POLICY "users_owner_delete" ON users FOR DELETE TO authenticated
  USING ((tenant_id IS NULL) OR private.auth_owns_tenant(tenant_id));
CREATE POLICY "users_super_admin_select" ON users FOR SELECT TO authenticated
  USING (private.is_super_admin());

-- warehouse_stock
CREATE POLICY "warehouse_stock_super_admin_select" ON warehouse_stock FOR SELECT TO authenticated
  USING (private.is_super_admin());

-- warehouse_transfer_items
CREATE POLICY "warehouse_transfer_items_super_admin_select" ON warehouse_transfer_items FOR SELECT TO authenticated
  USING (private.is_super_admin());

-- warehouse_transfers
CREATE POLICY "warehouse_transfers_super_admin_select" ON warehouse_transfers FOR SELECT TO authenticated
  USING (private.is_super_admin());

-- warehouses
CREATE POLICY "warehouses_owner_select" ON warehouses FOR SELECT TO authenticated
  USING ((site_id IS NULL) OR private.user_owns_site(site_id));
CREATE POLICY "warehouses_owner_insert" ON warehouses FOR INSERT TO authenticated
  WITH CHECK ((site_id IS NULL) OR private.user_owns_site(site_id));
CREATE POLICY "warehouses_owner_update" ON warehouses FOR UPDATE TO authenticated
  USING ((site_id IS NULL) OR private.user_owns_site(site_id))
  WITH CHECK ((site_id IS NULL) OR private.user_owns_site(site_id));
CREATE POLICY "warehouses_owner_delete" ON warehouses FOR DELETE TO authenticated
  USING ((site_id IS NULL) OR private.user_owns_site(site_id));
CREATE POLICY "warehouses_super_admin_select" ON warehouses FOR SELECT TO authenticated
  USING (private.is_super_admin());

-- ─────────────────────────────────────────────────────────────────────────────
-- Revoke EXECUTE on public schema helper functions from authenticated and anon
-- The private schema versions remain callable for RLS (already granted)
-- ─────────────────────────────────────────────────────────────────────────────

REVOKE EXECUTE ON FUNCTION public.auth_owns_tenant(uuid) FROM authenticated, anon;
REVOKE EXECUTE ON FUNCTION public.is_super_admin() FROM authenticated, anon;
REVOKE EXECUTE ON FUNCTION public.is_tenant_owner(uuid) FROM authenticated, anon;
REVOKE EXECUTE ON FUNCTION public.user_owns_site(uuid) FROM authenticated, anon;

-- Trigger functions are only invoked by the DB trigger system, never by users
REVOKE EXECUTE ON FUNCTION public.handle_sale_item_stock_change() FROM authenticated, anon;
REVOKE EXECUTE ON FUNCTION public.propagate_category_track_stock() FROM authenticated, anon;

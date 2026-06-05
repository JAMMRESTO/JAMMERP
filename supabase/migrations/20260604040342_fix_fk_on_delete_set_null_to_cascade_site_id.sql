/*
  # Migration 4/6 — Fix FK ON DELETE: SET NULL → CASCADE for site_id

  ## Problem
  24 tables used ON DELETE SET NULL for their site_id → sites FK.
  Deleting a site would null-out site_id on all child rows instead of
  deleting them. The nulled rows become invisible to RLS (which filters
  on site_id), effectively leaking unowned data that accumulates silently.

  Now that site_id is NOT NULL on all these tables, SET NULL would also
  violate the NOT NULL constraint — so CASCADE is the only correct behavior.

  ## Action
  Drop each FK constraint and recreate it with ON DELETE CASCADE.
  This means: deleting a site deletes all its operational data cleanly.

  ## Tables (25 FKs replaced)
  cash_sessions, categories, customers, deliveries, driver_payments, drivers,
  ingredients, online_orders, order_items, orders, payments, productions,
  products, recipe_items, recipes, restaurant_tables, sale_items, sales,
  sessions, stock_movements, users (site_id), warehouse_stock,
  warehouse_transfer_items, warehouse_transfers, warehouses
*/

-- cash_sessions
ALTER TABLE cash_sessions
  DROP CONSTRAINT IF EXISTS cash_sessions_site_id_fkey,
  ADD CONSTRAINT cash_sessions_site_id_fkey
    FOREIGN KEY (site_id) REFERENCES sites(id) ON DELETE CASCADE;

-- categories
ALTER TABLE categories
  DROP CONSTRAINT IF EXISTS categories_site_id_fkey,
  ADD CONSTRAINT categories_site_id_fkey
    FOREIGN KEY (site_id) REFERENCES sites(id) ON DELETE CASCADE;

-- customers
ALTER TABLE customers
  DROP CONSTRAINT IF EXISTS customers_site_id_fkey,
  ADD CONSTRAINT customers_site_id_fkey
    FOREIGN KEY (site_id) REFERENCES sites(id) ON DELETE CASCADE;

-- deliveries
ALTER TABLE deliveries
  DROP CONSTRAINT IF EXISTS deliveries_site_id_fkey,
  ADD CONSTRAINT deliveries_site_id_fkey
    FOREIGN KEY (site_id) REFERENCES sites(id) ON DELETE CASCADE;

-- driver_payments
ALTER TABLE driver_payments
  DROP CONSTRAINT IF EXISTS driver_payments_site_id_fkey,
  ADD CONSTRAINT driver_payments_site_id_fkey
    FOREIGN KEY (site_id) REFERENCES sites(id) ON DELETE CASCADE;

-- drivers
ALTER TABLE drivers
  DROP CONSTRAINT IF EXISTS drivers_site_id_fkey,
  ADD CONSTRAINT drivers_site_id_fkey
    FOREIGN KEY (site_id) REFERENCES sites(id) ON DELETE CASCADE;

-- ingredients
ALTER TABLE ingredients
  DROP CONSTRAINT IF EXISTS ingredients_site_id_fkey,
  ADD CONSTRAINT ingredients_site_id_fkey
    FOREIGN KEY (site_id) REFERENCES sites(id) ON DELETE CASCADE;

-- online_orders
ALTER TABLE online_orders
  DROP CONSTRAINT IF EXISTS online_orders_site_id_fkey,
  ADD CONSTRAINT online_orders_site_id_fkey
    FOREIGN KEY (site_id) REFERENCES sites(id) ON DELETE CASCADE;

-- order_items
ALTER TABLE order_items
  DROP CONSTRAINT IF EXISTS order_items_site_id_fkey,
  ADD CONSTRAINT order_items_site_id_fkey
    FOREIGN KEY (site_id) REFERENCES sites(id) ON DELETE CASCADE;

-- orders
ALTER TABLE orders
  DROP CONSTRAINT IF EXISTS orders_site_id_fkey,
  ADD CONSTRAINT orders_site_id_fkey
    FOREIGN KEY (site_id) REFERENCES sites(id) ON DELETE CASCADE;

-- payments
ALTER TABLE payments
  DROP CONSTRAINT IF EXISTS payments_site_id_fkey,
  ADD CONSTRAINT payments_site_id_fkey
    FOREIGN KEY (site_id) REFERENCES sites(id) ON DELETE CASCADE;

-- productions
ALTER TABLE productions
  DROP CONSTRAINT IF EXISTS productions_site_id_fkey,
  ADD CONSTRAINT productions_site_id_fkey
    FOREIGN KEY (site_id) REFERENCES sites(id) ON DELETE CASCADE;

-- products
ALTER TABLE products
  DROP CONSTRAINT IF EXISTS products_site_id_fkey,
  ADD CONSTRAINT products_site_id_fkey
    FOREIGN KEY (site_id) REFERENCES sites(id) ON DELETE CASCADE;

-- recipe_items
ALTER TABLE recipe_items
  DROP CONSTRAINT IF EXISTS recipe_items_site_id_fkey,
  ADD CONSTRAINT recipe_items_site_id_fkey
    FOREIGN KEY (site_id) REFERENCES sites(id) ON DELETE CASCADE;

-- recipes
ALTER TABLE recipes
  DROP CONSTRAINT IF EXISTS recipes_site_id_fkey,
  ADD CONSTRAINT recipes_site_id_fkey
    FOREIGN KEY (site_id) REFERENCES sites(id) ON DELETE CASCADE;

-- restaurant_tables
ALTER TABLE restaurant_tables
  DROP CONSTRAINT IF EXISTS restaurant_tables_site_id_fkey,
  ADD CONSTRAINT restaurant_tables_site_id_fkey
    FOREIGN KEY (site_id) REFERENCES sites(id) ON DELETE CASCADE;

-- sale_items
ALTER TABLE sale_items
  DROP CONSTRAINT IF EXISTS sale_items_site_id_fkey,
  ADD CONSTRAINT sale_items_site_id_fkey
    FOREIGN KEY (site_id) REFERENCES sites(id) ON DELETE CASCADE;

-- sales
ALTER TABLE sales
  DROP CONSTRAINT IF EXISTS sales_site_id_fkey,
  ADD CONSTRAINT sales_site_id_fkey
    FOREIGN KEY (site_id) REFERENCES sites(id) ON DELETE CASCADE;

-- sessions
ALTER TABLE sessions
  DROP CONSTRAINT IF EXISTS sessions_site_id_fkey,
  ADD CONSTRAINT sessions_site_id_fkey
    FOREIGN KEY (site_id) REFERENCES sites(id) ON DELETE CASCADE;

-- stock_movements
ALTER TABLE stock_movements
  DROP CONSTRAINT IF EXISTS stock_movements_site_id_fkey,
  ADD CONSTRAINT stock_movements_site_id_fkey
    FOREIGN KEY (site_id) REFERENCES sites(id) ON DELETE CASCADE;

-- users (site_id only — tenant_id FK already uses CASCADE)
ALTER TABLE users
  DROP CONSTRAINT IF EXISTS users_site_id_fkey,
  ADD CONSTRAINT users_site_id_fkey
    FOREIGN KEY (site_id) REFERENCES sites(id) ON DELETE CASCADE;

-- warehouse_stock
ALTER TABLE warehouse_stock
  DROP CONSTRAINT IF EXISTS warehouse_stock_site_id_fkey,
  ADD CONSTRAINT warehouse_stock_site_id_fkey
    FOREIGN KEY (site_id) REFERENCES sites(id) ON DELETE CASCADE;

-- warehouse_transfer_items
ALTER TABLE warehouse_transfer_items
  DROP CONSTRAINT IF EXISTS warehouse_transfer_items_site_id_fkey,
  ADD CONSTRAINT warehouse_transfer_items_site_id_fkey
    FOREIGN KEY (site_id) REFERENCES sites(id) ON DELETE CASCADE;

-- warehouse_transfers
ALTER TABLE warehouse_transfers
  DROP CONSTRAINT IF EXISTS warehouse_transfers_site_id_fkey,
  ADD CONSTRAINT warehouse_transfers_site_id_fkey
    FOREIGN KEY (site_id) REFERENCES sites(id) ON DELETE CASCADE;

-- warehouses
ALTER TABLE warehouses
  DROP CONSTRAINT IF EXISTS warehouses_site_id_fkey,
  ADD CONSTRAINT warehouses_site_id_fkey
    FOREIGN KEY (site_id) REFERENCES sites(id) ON DELETE CASCADE;

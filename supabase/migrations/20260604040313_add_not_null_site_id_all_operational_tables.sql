/*
  # Migration 3/6 — Add NOT NULL on site_id for all operational tables

  ## Problem
  Every operational table accepts INSERT without a site_id (column is nullable).
  Any buggy or malicious INSERT can create data with site_id = NULL, making it
  invisible to RLS and accessible by no one — a silent data leak / data loss.

  ## Pre-condition
  Migration 1 fixed all orphan rows (0 NULLs remain on all tables below).
  This was verified by the audit before applying this migration.

  ## Tables modified (24 tables)
  All operational tables that carry a site_id column and had 0 NULL rows
  after orphan cleanup. The users table is intentionally excluded — it hosts
  the super admin and cashier_auth virtual users which follow different rules.

  ## Note on settings
  settings.site_id already has a NOT NULL-like guarantee via the UNIQUE(site_id, key)
  constraint but was still nullable. Included here for consistency.
*/

ALTER TABLE cash_sessions            ALTER COLUMN site_id SET NOT NULL;
ALTER TABLE categories               ALTER COLUMN site_id SET NOT NULL;
ALTER TABLE customers                ALTER COLUMN site_id SET NOT NULL;
ALTER TABLE deliveries               ALTER COLUMN site_id SET NOT NULL;
ALTER TABLE driver_payments          ALTER COLUMN site_id SET NOT NULL;
ALTER TABLE drivers                  ALTER COLUMN site_id SET NOT NULL;
ALTER TABLE ingredients              ALTER COLUMN site_id SET NOT NULL;
ALTER TABLE online_orders            ALTER COLUMN site_id SET NOT NULL;
ALTER TABLE order_items              ALTER COLUMN site_id SET NOT NULL;
ALTER TABLE orders                   ALTER COLUMN site_id SET NOT NULL;
ALTER TABLE payments                 ALTER COLUMN site_id SET NOT NULL;
ALTER TABLE productions              ALTER COLUMN site_id SET NOT NULL;
ALTER TABLE products                 ALTER COLUMN site_id SET NOT NULL;
ALTER TABLE recipe_items             ALTER COLUMN site_id SET NOT NULL;
ALTER TABLE recipes                  ALTER COLUMN site_id SET NOT NULL;
ALTER TABLE restaurant_tables        ALTER COLUMN site_id SET NOT NULL;
ALTER TABLE sale_items               ALTER COLUMN site_id SET NOT NULL;
ALTER TABLE sales                    ALTER COLUMN site_id SET NOT NULL;
ALTER TABLE sessions                 ALTER COLUMN site_id SET NOT NULL;
ALTER TABLE settings                 ALTER COLUMN site_id SET NOT NULL;
ALTER TABLE stock_movements          ALTER COLUMN site_id SET NOT NULL;
ALTER TABLE warehouse_stock          ALTER COLUMN site_id SET NOT NULL;
ALTER TABLE warehouse_transfer_items ALTER COLUMN site_id SET NOT NULL;
ALTER TABLE warehouse_transfers      ALTER COLUMN site_id SET NOT NULL;
ALTER TABLE warehouses               ALTER COLUMN site_id SET NOT NULL;

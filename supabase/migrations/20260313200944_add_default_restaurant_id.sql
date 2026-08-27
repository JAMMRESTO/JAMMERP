/*
  # Add default restaurant_id to all tables

  1. Changes
    - Sets a default value of '00000000-0000-0000-0000-000000000001' for the restaurant_id column
      on all tables that require it but have no default
    - This fixes inserts that omit restaurant_id, which was causing NOT NULL constraint violations
    - Affected tables: orders, order_items, order_item_options, print_jobs, activity_logs,
      app_settings, cash_audit_logs, cash_closures, cash_movements, cash_sessions, categories,
      data_exports, payments, printers, product_options, product_print_routing, products,
      restaurant_admins, subscriptions, tables, user_permissions, users, zones

  2. Important Notes
    - Since there is only one restaurant (SEN RESTO with id 00000000-0000-0000-0000-000000000001),
      this default is safe and correct
    - No data is modified, only the column default is changed
*/

ALTER TABLE orders ALTER COLUMN restaurant_id SET DEFAULT '00000000-0000-0000-0000-000000000001';
ALTER TABLE order_items ALTER COLUMN restaurant_id SET DEFAULT '00000000-0000-0000-0000-000000000001';
ALTER TABLE order_item_options ALTER COLUMN restaurant_id SET DEFAULT '00000000-0000-0000-0000-000000000001';
ALTER TABLE print_jobs ALTER COLUMN restaurant_id SET DEFAULT '00000000-0000-0000-0000-000000000001';
ALTER TABLE activity_logs ALTER COLUMN restaurant_id SET DEFAULT '00000000-0000-0000-0000-000000000001';
ALTER TABLE app_settings ALTER COLUMN restaurant_id SET DEFAULT '00000000-0000-0000-0000-000000000001';
ALTER TABLE cash_audit_logs ALTER COLUMN restaurant_id SET DEFAULT '00000000-0000-0000-0000-000000000001';
ALTER TABLE cash_closures ALTER COLUMN restaurant_id SET DEFAULT '00000000-0000-0000-0000-000000000001';
ALTER TABLE cash_movements ALTER COLUMN restaurant_id SET DEFAULT '00000000-0000-0000-0000-000000000001';
ALTER TABLE cash_sessions ALTER COLUMN restaurant_id SET DEFAULT '00000000-0000-0000-0000-000000000001';
ALTER TABLE categories ALTER COLUMN restaurant_id SET DEFAULT '00000000-0000-0000-0000-000000000001';
ALTER TABLE data_exports ALTER COLUMN restaurant_id SET DEFAULT '00000000-0000-0000-0000-000000000001';
ALTER TABLE payments ALTER COLUMN restaurant_id SET DEFAULT '00000000-0000-0000-0000-000000000001';
ALTER TABLE printers ALTER COLUMN restaurant_id SET DEFAULT '00000000-0000-0000-0000-000000000001';
ALTER TABLE product_options ALTER COLUMN restaurant_id SET DEFAULT '00000000-0000-0000-0000-000000000001';
ALTER TABLE product_print_routing ALTER COLUMN restaurant_id SET DEFAULT '00000000-0000-0000-0000-000000000001';
ALTER TABLE products ALTER COLUMN restaurant_id SET DEFAULT '00000000-0000-0000-0000-000000000001';
ALTER TABLE subscriptions ALTER COLUMN restaurant_id SET DEFAULT '00000000-0000-0000-0000-000000000001';
ALTER TABLE tables ALTER COLUMN restaurant_id SET DEFAULT '00000000-0000-0000-0000-000000000001';
ALTER TABLE user_permissions ALTER COLUMN restaurant_id SET DEFAULT '00000000-0000-0000-0000-000000000001';
ALTER TABLE users ALTER COLUMN restaurant_id SET DEFAULT '00000000-0000-0000-0000-000000000001';
ALTER TABLE zones ALTER COLUMN restaurant_id SET DEFAULT '00000000-0000-0000-0000-000000000001';

/*
  # Drop unused indexes

  1. Changes
    - Removes indexes on restaurant_id columns across all tables (single-restaurant setup, never queried)
    - Removes unused indexes on restaurants table (slug, owner_id, license_status)
    - Removes unused indexes on restaurant_admins (user_id, restaurant_id)
    - Removes unused indexes on cash_closures(created_by), cash_movements(created_by), printers(backup_printer_id)

  2. Important Notes
    - These indexes have never been used according to pg_stat_user_indexes
    - Removing them reduces write overhead and storage
    - Can be re-added if query patterns change
*/

DROP INDEX IF EXISTS idx_restaurants_slug;
DROP INDEX IF EXISTS idx_restaurants_owner_id;
DROP INDEX IF EXISTS idx_restaurants_license_status;
DROP INDEX IF EXISTS idx_restaurant_admins_user_id;
DROP INDEX IF EXISTS idx_restaurant_admins_restaurant_id;
DROP INDEX IF EXISTS idx_users_restaurant_id;
DROP INDEX IF EXISTS idx_zones_restaurant_id;
DROP INDEX IF EXISTS idx_subscriptions_restaurant_id;
DROP INDEX IF EXISTS idx_tables_restaurant_id;
DROP INDEX IF EXISTS idx_categories_restaurant_id;
DROP INDEX IF EXISTS idx_cash_movements_restaurant_id;
DROP INDEX IF EXISTS idx_products_restaurant_id;
DROP INDEX IF EXISTS idx_product_options_restaurant_id;
DROP INDEX IF EXISTS idx_orders_restaurant_id;
DROP INDEX IF EXISTS idx_order_items_restaurant_id;
DROP INDEX IF EXISTS idx_order_item_options_restaurant_id;
DROP INDEX IF EXISTS idx_payments_restaurant_id;
DROP INDEX IF EXISTS idx_cash_sessions_restaurant_id;
DROP INDEX IF EXISTS idx_cash_closures_restaurant_id;
DROP INDEX IF EXISTS idx_cash_audit_logs_restaurant_id;
DROP INDEX IF EXISTS idx_activity_logs_restaurant_id;
DROP INDEX IF EXISTS idx_data_exports_restaurant_id;
DROP INDEX IF EXISTS idx_printers_restaurant_id;
DROP INDEX IF EXISTS idx_print_jobs_restaurant_id;
DROP INDEX IF EXISTS idx_product_print_routing_restaurant_id;
DROP INDEX IF EXISTS idx_app_settings_restaurant_id;
DROP INDEX IF EXISTS idx_user_permissions_restaurant_id;
DROP INDEX IF EXISTS idx_cash_closures_created_by;
DROP INDEX IF EXISTS idx_cash_movements_created_by;
DROP INDEX IF EXISTS idx_printers_backup_printer_id;

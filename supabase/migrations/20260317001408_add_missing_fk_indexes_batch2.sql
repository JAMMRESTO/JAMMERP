/*
  # Add missing covering indexes for foreign keys (batch 2)

  Adds indexes on all foreign key columns that currently lack one.
  This prevents sequential scans when Postgres enforces referential integrity
  or when these columns are used in JOIN conditions.

  Tables covered:
    - activity_logs (restaurant_id)
    - cash_audit_logs (restaurant_id)
    - cash_closures (created_by, restaurant_id)
    - cash_movements (created_by, restaurant_id)
    - cash_sessions (restaurant_id)
    - categories (restaurant_id)
    - data_exports (restaurant_id)
    - order_item_options (restaurant_id)
    - order_items (restaurant_id)
    - orders (restaurant_id)
    - payments (restaurant_id)
    - print_jobs (restaurant_id)
    - printers (backup_printer_id, restaurant_id)
    - product_options (restaurant_id)
    - product_print_routing (restaurant_id)
    - products (restaurant_id)
    - restaurant_admins (user_id)
    - restaurants (owner_id)
    - subscriptions (restaurant_id)
    - tables (restaurant_id)
    - user_permissions (restaurant_id)
    - users (restaurant_id)
    - zones (restaurant_id)
*/

CREATE INDEX IF NOT EXISTS idx_activity_logs_restaurant_id ON public.activity_logs (restaurant_id);
CREATE INDEX IF NOT EXISTS idx_cash_audit_logs_restaurant_id ON public.cash_audit_logs (restaurant_id);
CREATE INDEX IF NOT EXISTS idx_cash_closures_created_by ON public.cash_closures (created_by);
CREATE INDEX IF NOT EXISTS idx_cash_closures_restaurant_id ON public.cash_closures (restaurant_id);
CREATE INDEX IF NOT EXISTS idx_cash_movements_created_by ON public.cash_movements (created_by);
CREATE INDEX IF NOT EXISTS idx_cash_movements_restaurant_id ON public.cash_movements (restaurant_id);
CREATE INDEX IF NOT EXISTS idx_cash_sessions_restaurant_id ON public.cash_sessions (restaurant_id);
CREATE INDEX IF NOT EXISTS idx_categories_restaurant_id ON public.categories (restaurant_id);
CREATE INDEX IF NOT EXISTS idx_data_exports_restaurant_id ON public.data_exports (restaurant_id);
CREATE INDEX IF NOT EXISTS idx_order_item_options_restaurant_id ON public.order_item_options (restaurant_id);
CREATE INDEX IF NOT EXISTS idx_order_items_restaurant_id ON public.order_items (restaurant_id);
CREATE INDEX IF NOT EXISTS idx_orders_restaurant_id ON public.orders (restaurant_id);
CREATE INDEX IF NOT EXISTS idx_payments_restaurant_id ON public.payments (restaurant_id);
CREATE INDEX IF NOT EXISTS idx_print_jobs_restaurant_id ON public.print_jobs (restaurant_id);
CREATE INDEX IF NOT EXISTS idx_printers_backup_printer_id ON public.printers (backup_printer_id);
CREATE INDEX IF NOT EXISTS idx_printers_restaurant_id ON public.printers (restaurant_id);
CREATE INDEX IF NOT EXISTS idx_product_options_restaurant_id ON public.product_options (restaurant_id);
CREATE INDEX IF NOT EXISTS idx_product_print_routing_restaurant_id ON public.product_print_routing (restaurant_id);
CREATE INDEX IF NOT EXISTS idx_products_restaurant_id ON public.products (restaurant_id);
CREATE INDEX IF NOT EXISTS idx_restaurant_admins_user_id ON public.restaurant_admins (user_id);
CREATE INDEX IF NOT EXISTS idx_restaurants_owner_id ON public.restaurants (owner_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_restaurant_id ON public.subscriptions (restaurant_id);
CREATE INDEX IF NOT EXISTS idx_tables_restaurant_id ON public.tables (restaurant_id);
CREATE INDEX IF NOT EXISTS idx_user_permissions_restaurant_id ON public.user_permissions (restaurant_id);
CREATE INDEX IF NOT EXISTS idx_users_restaurant_id ON public.users (restaurant_id);
CREATE INDEX IF NOT EXISTS idx_zones_restaurant_id ON public.zones (restaurant_id);

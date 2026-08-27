/*
  # Drop unused indexes

  Removes indexes that have never been used according to pg_stat_user_indexes.
  These indexes consume disk space and slow down writes without benefiting reads.

  Indexes dropped:
    - idx_categories_printer_id
    - idx_subscriptions_changed_by
    - idx_tables_zone_id
    - idx_tables_locked_by
    - idx_cash_movements_session_id
    - idx_products_category_id
    - idx_product_options_product_id
    - idx_orders_caissier_id
    - idx_orders_serveur_id
    - idx_order_items_product_id
    - idx_cash_sessions_caissier_id
    - idx_product_print_routing_category_id
    - idx_product_print_routing_printer_id
    - idx_product_print_routing_product_id
    - idx_print_jobs_created_by
    - idx_print_jobs_table_id
    - idx_cash_audit_logs_user_id
    - idx_activity_logs_user_id
    - idx_payments_caissier_id
    - idx_payments_session_id
    - idx_data_exports_performed_by
    - idx_expenses_restaurant_id
    - idx_expenses_created_by
*/

DROP INDEX IF EXISTS public.idx_categories_printer_id;
DROP INDEX IF EXISTS public.idx_subscriptions_changed_by;
DROP INDEX IF EXISTS public.idx_tables_zone_id;
DROP INDEX IF EXISTS public.idx_tables_locked_by;
DROP INDEX IF EXISTS public.idx_cash_movements_session_id;
DROP INDEX IF EXISTS public.idx_products_category_id;
DROP INDEX IF EXISTS public.idx_product_options_product_id;
DROP INDEX IF EXISTS public.idx_orders_caissier_id;
DROP INDEX IF EXISTS public.idx_orders_serveur_id;
DROP INDEX IF EXISTS public.idx_order_items_product_id;
DROP INDEX IF EXISTS public.idx_cash_sessions_caissier_id;
DROP INDEX IF EXISTS public.idx_product_print_routing_category_id;
DROP INDEX IF EXISTS public.idx_product_print_routing_printer_id;
DROP INDEX IF EXISTS public.idx_product_print_routing_product_id;
DROP INDEX IF EXISTS public.idx_print_jobs_created_by;
DROP INDEX IF EXISTS public.idx_print_jobs_table_id;
DROP INDEX IF EXISTS public.idx_cash_audit_logs_user_id;
DROP INDEX IF EXISTS public.idx_activity_logs_user_id;
DROP INDEX IF EXISTS public.idx_payments_caissier_id;
DROP INDEX IF EXISTS public.idx_payments_session_id;
DROP INDEX IF EXISTS public.idx_data_exports_performed_by;
DROP INDEX IF EXISTS public.idx_expenses_restaurant_id;
DROP INDEX IF EXISTS public.idx_expenses_created_by;

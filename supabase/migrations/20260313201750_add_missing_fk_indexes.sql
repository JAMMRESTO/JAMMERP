/*
  # Add missing foreign key indexes

  1. New Indexes
    - activity_logs(user_id)
    - cash_audit_logs(user_id)
    - cash_closures(session_id)
    - cash_movements(session_id)
    - cash_sessions(caissier_id)
    - categories(printer_id)
    - data_exports(performed_by)
    - order_items(product_id)
    - orders(caissier_id, serveur_id, table_id)
    - payments(caissier_id, order_id, session_id)
    - print_jobs(created_by, printer_id, table_id)
    - product_options(product_id)
    - product_print_routing(category_id, printer_id, product_id)
    - products(category_id)
    - subscriptions(changed_by)
    - tables(zone_id)

  2. Important Notes
    - These indexes cover foreign key columns that were missing indexes
    - Improves JOIN and DELETE performance on referenced tables
*/

CREATE INDEX IF NOT EXISTS idx_activity_logs_user_id ON activity_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_cash_audit_logs_user_id ON cash_audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_cash_closures_session_id ON cash_closures(session_id);
CREATE INDEX IF NOT EXISTS idx_cash_movements_session_id ON cash_movements(session_id);
CREATE INDEX IF NOT EXISTS idx_cash_sessions_caissier_id ON cash_sessions(caissier_id);
CREATE INDEX IF NOT EXISTS idx_categories_printer_id ON categories(printer_id);
CREATE INDEX IF NOT EXISTS idx_data_exports_performed_by ON data_exports(performed_by);
CREATE INDEX IF NOT EXISTS idx_order_items_product_id ON order_items(product_id);
CREATE INDEX IF NOT EXISTS idx_orders_caissier_id ON orders(caissier_id);
CREATE INDEX IF NOT EXISTS idx_orders_serveur_id ON orders(serveur_id);
CREATE INDEX IF NOT EXISTS idx_orders_table_id ON orders(table_id);
CREATE INDEX IF NOT EXISTS idx_payments_caissier_id ON payments(caissier_id);
CREATE INDEX IF NOT EXISTS idx_payments_order_id ON payments(order_id);
CREATE INDEX IF NOT EXISTS idx_payments_session_id ON payments(session_id);
CREATE INDEX IF NOT EXISTS idx_print_jobs_created_by ON print_jobs(created_by);
CREATE INDEX IF NOT EXISTS idx_print_jobs_printer_id ON print_jobs(printer_id);
CREATE INDEX IF NOT EXISTS idx_print_jobs_table_id ON print_jobs(table_id);
CREATE INDEX IF NOT EXISTS idx_product_options_product_id ON product_options(product_id);
CREATE INDEX IF NOT EXISTS idx_product_print_routing_category_id ON product_print_routing(category_id);
CREATE INDEX IF NOT EXISTS idx_product_print_routing_printer_id ON product_print_routing(printer_id);
CREATE INDEX IF NOT EXISTS idx_product_print_routing_product_id ON product_print_routing(product_id);
CREATE INDEX IF NOT EXISTS idx_products_category_id ON products(category_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_changed_by ON subscriptions(changed_by);
CREATE INDEX IF NOT EXISTS idx_tables_zone_id ON tables(zone_id);

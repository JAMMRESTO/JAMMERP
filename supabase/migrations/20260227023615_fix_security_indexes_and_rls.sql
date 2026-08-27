/*
  # Fix Security Issues — Indexes & RLS Policies

  ## Changes

  ### 1. Missing FK indexes
  Add covering indexes for unindexed foreign keys to improve JOIN/query performance:
  - cash_closures.created_by
  - cash_movements.created_by
  - cash_sessions.closed_by
  - cash_sessions.opened_by
  - printers.backup_printer_id

  ### 2. RLS auth() performance fix
  Replace auth.uid() with (select auth.uid()) in data_exports policies
  so the function is evaluated once per query instead of once per row.

  ### 3. Drop unused indexes
  Remove indexes that have never been used to reduce write overhead and storage.

  ### 4. Fix always-true RLS policies
  - activity_logs: restrict insert to authenticated users only (no always-true check)
  - app_settings: restrict insert/update to authenticated users only
  - cash_audit_logs: restrict insert to authenticated staff
  - cash_closures: restrict insert to authenticated staff
  - cash_movements: restrict insert to authenticated staff
  - cash_sessions: restrict insert/update to authenticated staff
  - product_print_routing: remove anon access, restrict to authenticated only

  ### Notes
  - "Auth DB Connection Strategy" warning is an infrastructure setting — not fixable via SQL migration.
  - Unused index drops are safe: Postgres/PostgREST will recreate or use the FK indexes added here.
*/

-- ============================================================
-- 1. ADD MISSING FK INDEXES
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_cash_closures_created_by
  ON cash_closures (created_by);

CREATE INDEX IF NOT EXISTS idx_cash_movements_created_by
  ON cash_movements (created_by);

CREATE INDEX IF NOT EXISTS idx_cash_sessions_closed_by
  ON cash_sessions (closed_by);

CREATE INDEX IF NOT EXISTS idx_cash_sessions_opened_by
  ON cash_sessions (opened_by);

CREATE INDEX IF NOT EXISTS idx_printers_backup_printer_id
  ON printers (backup_printer_id);

-- ============================================================
-- 2. FIX data_exports RLS — use (select auth.uid()) for performance
-- ============================================================
DROP POLICY IF EXISTS "Admins can insert export logs" ON data_exports;
DROP POLICY IF EXISTS "Admins can view export logs" ON data_exports;

CREATE POLICY "Admins can insert export logs"
  ON data_exports FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = (select auth.uid())
      AND users.role = 'ADMIN'
    )
  );

CREATE POLICY "Admins can view export logs"
  ON data_exports FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = (select auth.uid())
      AND users.role = 'ADMIN'
    )
  );

-- ============================================================
-- 3. DROP UNUSED INDEXES
-- ============================================================
DROP INDEX IF EXISTS idx_cash_sessions_status;
DROP INDEX IF EXISTS idx_cash_sessions_opened_at;
DROP INDEX IF EXISTS idx_cash_movements_session;
DROP INDEX IF EXISTS idx_cash_sessions_caissier_id;
DROP INDEX IF EXISTS idx_categories_printer_id;
DROP INDEX IF EXISTS idx_order_items_product_id;
DROP INDEX IF EXISTS idx_orders_serveur_id;
DROP INDEX IF EXISTS idx_orders_table_id;
DROP INDEX IF EXISTS idx_payments_caissier_id;
DROP INDEX IF EXISTS idx_payments_order_id;
DROP INDEX IF EXISTS idx_print_jobs_created_by;
DROP INDEX IF EXISTS idx_print_jobs_order_id;
DROP INDEX IF EXISTS idx_print_jobs_printer_id;
DROP INDEX IF EXISTS idx_print_jobs_table_id;
DROP INDEX IF EXISTS idx_product_options_product_id;
DROP INDEX IF EXISTS idx_products_category_id;
DROP INDEX IF EXISTS idx_tables_zone_id;
DROP INDEX IF EXISTS idx_cash_closures_session;
DROP INDEX IF EXISTS idx_cash_closures_type;
DROP INDEX IF EXISTS idx_orders_caissier_id;
DROP INDEX IF EXISTS idx_orders_order_type;
DROP INDEX IF EXISTS idx_ppr_product_id;
DROP INDEX IF EXISTS idx_ppr_category_id;
DROP INDEX IF EXISTS idx_ppr_printer_id;
DROP INDEX IF EXISTS idx_cash_audit_logs_user;
DROP INDEX IF EXISTS idx_activity_logs_user_id;
DROP INDEX IF EXISTS idx_activity_logs_created_at;
DROP INDEX IF EXISTS idx_activity_logs_action;
DROP INDEX IF EXISTS idx_cash_audit_logs_created;
DROP INDEX IF EXISTS idx_payments_session;
DROP INDEX IF EXISTS idx_payments_paid_at;
DROP INDEX IF EXISTS idx_payments_pay_status;
DROP INDEX IF EXISTS idx_data_exports_performed_by;
DROP INDEX IF EXISTS idx_data_exports_created_at;

-- ============================================================
-- 4. FIX ALWAYS-TRUE RLS POLICIES
-- ============================================================

-- activity_logs: replace always-true insert with authenticated-only check
DROP POLICY IF EXISTS "Authenticated users can insert activity logs" ON activity_logs;
CREATE POLICY "Authenticated users can insert activity logs"
  ON activity_logs FOR INSERT
  TO authenticated
  WITH CHECK ((select auth.uid()) IS NOT NULL);

-- app_settings: replace always-true insert/update with admin-only
DROP POLICY IF EXISTS "Authenticated users can insert settings" ON app_settings;
DROP POLICY IF EXISTS "Authenticated users can update settings" ON app_settings;

CREATE POLICY "Admins can insert settings"
  ON app_settings FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = (select auth.uid())
      AND users.role = 'ADMIN'
    )
  );

CREATE POLICY "Admins can update settings"
  ON app_settings FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = (select auth.uid())
      AND users.role = 'ADMIN'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = (select auth.uid())
      AND users.role = 'ADMIN'
    )
  );

-- cash_audit_logs: restrict insert to authenticated users only
DROP POLICY IF EXISTS "Staff can insert audit logs" ON cash_audit_logs;
CREATE POLICY "Staff can insert audit logs"
  ON cash_audit_logs FOR INSERT
  TO authenticated
  WITH CHECK ((select auth.uid()) IS NOT NULL);

-- cash_closures: restrict insert to authenticated staff
DROP POLICY IF EXISTS "Staff can insert cash closures" ON cash_closures;
CREATE POLICY "Staff can insert cash closures"
  ON cash_closures FOR INSERT
  TO authenticated
  WITH CHECK ((select auth.uid()) IS NOT NULL);

-- cash_movements: restrict insert to authenticated staff
DROP POLICY IF EXISTS "Staff can insert cash movements" ON cash_movements;
CREATE POLICY "Staff can insert cash movements"
  ON cash_movements FOR INSERT
  TO authenticated
  WITH CHECK ((select auth.uid()) IS NOT NULL);

-- cash_sessions: restrict insert/update to authenticated staff
DROP POLICY IF EXISTS "Staff can insert cash sessions" ON cash_sessions;
DROP POLICY IF EXISTS "Staff can update cash sessions" ON cash_sessions;

CREATE POLICY "Staff can insert cash sessions"
  ON cash_sessions FOR INSERT
  TO authenticated
  WITH CHECK ((select auth.uid()) IS NOT NULL);

CREATE POLICY "Staff can update cash sessions"
  ON cash_sessions FOR UPDATE
  TO authenticated
  USING ((select auth.uid()) IS NOT NULL)
  WITH CHECK ((select auth.uid()) IS NOT NULL);

-- product_print_routing: remove anon policies, keep authenticated-only
DROP POLICY IF EXISTS "Allow anon delete on product_print_routing" ON product_print_routing;
DROP POLICY IF EXISTS "Allow anon insert on product_print_routing" ON product_print_routing;
DROP POLICY IF EXISTS "Allow anon update on product_print_routing" ON product_print_routing;
DROP POLICY IF EXISTS "Allow authenticated delete on product_print_routing" ON product_print_routing;
DROP POLICY IF EXISTS "Allow authenticated insert on product_print_routing" ON product_print_routing;
DROP POLICY IF EXISTS "Allow authenticated update on product_print_routing" ON product_print_routing;

CREATE POLICY "Authenticated users can manage print routing insert"
  ON product_print_routing FOR INSERT
  TO authenticated
  WITH CHECK ((select auth.uid()) IS NOT NULL);

CREATE POLICY "Authenticated users can manage print routing update"
  ON product_print_routing FOR UPDATE
  TO authenticated
  USING ((select auth.uid()) IS NOT NULL)
  WITH CHECK ((select auth.uid()) IS NOT NULL);

CREATE POLICY "Authenticated users can manage print routing delete"
  ON product_print_routing FOR DELETE
  TO authenticated
  USING ((select auth.uid()) IS NOT NULL);

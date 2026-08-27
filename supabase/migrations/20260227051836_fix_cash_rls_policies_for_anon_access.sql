/*
  # Fix cash module RLS policies for anonymous access

  ## Problem
  The application uses custom PIN-based authentication (not Supabase Auth), so
  auth.uid() is always NULL. The INSERT policies on cash tables require
  auth.uid() IS NOT NULL, which blocks all insert operations silently.

  ## Changes
  - Drop and replace INSERT policies on cash_sessions, cash_audit_logs,
    cash_closures, and cash_movements to allow anon inserts with basic
    field-level validation (matching the pattern used elsewhere in the app).
  - Also fix UPDATE policy on cash_sessions which has the same issue.
*/

-- cash_sessions: fix INSERT policy
DROP POLICY IF EXISTS "Staff can insert cash sessions" ON cash_sessions;
CREATE POLICY "Anon can insert cash sessions with caissier"
  ON cash_sessions
  FOR INSERT
  WITH CHECK (caissier_id IS NOT NULL);

-- cash_sessions: fix UPDATE policy  
DROP POLICY IF EXISTS "Staff can update cash sessions" ON cash_sessions;
CREATE POLICY "Anon can update cash sessions"
  ON cash_sessions
  FOR UPDATE
  USING (id IS NOT NULL)
  WITH CHECK (id IS NOT NULL);

-- cash_audit_logs: fix INSERT policy
DROP POLICY IF EXISTS "Staff can insert audit logs" ON cash_audit_logs;
CREATE POLICY "Anon can insert audit logs"
  ON cash_audit_logs
  FOR INSERT
  WITH CHECK (action IS NOT NULL);

-- cash_closures: fix INSERT policy
DROP POLICY IF EXISTS "Staff can insert cash closures" ON cash_closures;
CREATE POLICY "Anon can insert cash closures"
  ON cash_closures
  FOR INSERT
  WITH CHECK (session_id IS NOT NULL);

-- cash_movements: fix INSERT policy
DROP POLICY IF EXISTS "Staff can insert cash movements" ON cash_movements;
CREATE POLICY "Anon can insert cash movements"
  ON cash_movements
  FOR INSERT
  WITH CHECK (session_id IS NOT NULL AND amount > 0);

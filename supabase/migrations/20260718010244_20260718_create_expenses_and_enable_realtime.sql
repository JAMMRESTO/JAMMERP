/*
  # Create expenses table and enable realtime

  ## Purpose
  The `expenses` table is referenced by the frontend (ExpensesView,
  AdminStatistics) and by a migration file on disk
  (20260316190249_add_expenses_table.sql), but it does not exist in the
  current database. This migration creates it and adds it to the
  `supabase_realtime` publication so the admin statistics dashboard
  refreshes instantly when expenses are added/edited/deleted.

  ## New Table
  - `expenses`
    - `id` (uuid, primary key)
    - `restaurant_id` (uuid, FK to restaurants, ON DELETE CASCADE)
    - `session_id` (uuid, FK to cash_sessions, nullable, ON DELETE SET NULL)
    - `created_by` (uuid, FK to users, ON DELETE SET NULL)
    - `category` (text, default 'AUTRE') — e.g. FOURNITURE, TRANSPORT, SALAIRE, MAINTENANCE, REPAS, AUTRE
    - `label` (text, default '') — description of the expense
    - `amount` (numeric(12,2), default 0) — amount in FCFA
    - `expense_date` (timestamptz, default now()) — when the expense occurred
    - `notes` (text, default '') — optional notes
    - `created_at` (timestamptz, default now())

  ## Security
  - RLS enabled on `expenses`.
  - anon + authenticated roles can read/insert/update/delete. This is a
    single-tenant POS app (no sign-in screen required to read its own data),
    so `USING (true)` is intentional and documented here.

  ## Realtime
  - Adds `expenses` to the `supabase_realtime` publication so the admin
    statistics dashboard receives instant postgres_changes events.

  ## Idempotency
  - `CREATE TABLE IF NOT EXISTS` and a DO block guard the realtime addition.
  - Policies are dropped before (re)creation.
*/

CREATE TABLE IF NOT EXISTS expenses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id uuid REFERENCES restaurants(id) ON DELETE CASCADE,
  session_id uuid REFERENCES cash_sessions(id) ON DELETE SET NULL,
  created_by uuid REFERENCES users(id) ON DELETE SET NULL,
  category text NOT NULL DEFAULT 'AUTRE',
  label text NOT NULL DEFAULT '',
  amount numeric(12, 2) NOT NULL DEFAULT 0,
  expense_date timestamptz NOT NULL DEFAULT now(),
  notes text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_expenses_restaurant_id ON expenses(restaurant_id);
CREATE INDEX IF NOT EXISTS idx_expenses_session_id ON expenses(session_id);
CREATE INDEX IF NOT EXISTS idx_expenses_expense_date ON expenses(expense_date);
CREATE INDEX IF NOT EXISTS idx_expenses_created_by ON expenses(created_by);

ALTER TABLE expenses ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users can view expenses" ON expenses;
CREATE POLICY "Authenticated users can view expenses"
  ON expenses FOR SELECT
  TO anon, authenticated
  USING (true);

DROP POLICY IF EXISTS "Authenticated users can insert expenses" ON expenses;
CREATE POLICY "Authenticated users can insert expenses"
  ON expenses FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

DROP POLICY IF EXISTS "Authenticated users can update expenses" ON expenses;
CREATE POLICY "Authenticated users can update expenses"
  ON expenses FOR UPDATE
  TO anon, authenticated
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS "Authenticated users can delete expenses" ON expenses;
CREATE POLICY "Authenticated users can delete expenses"
  ON expenses FOR DELETE
  TO anon, authenticated
  USING (true);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'expenses'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.expenses;
  END IF;
END $$;

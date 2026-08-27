/*
  # Add Expenses Table

  ## Overview
  Creates a system for tracking cash register expenses (depenses) that will be
  deducted from daily revenue in statistics.

  ## New Tables
  - `expenses`
    - `id` (uuid, primary key)
    - `restaurant_id` (uuid, FK to restaurants)
    - `session_id` (uuid, FK to cash_sessions, nullable - expense can exist outside session)
    - `created_by` (uuid, FK to users)
    - `category` (text) - e.g. 'FOURNITURE', 'TRANSPORT', 'SALAIRE', 'MAINTENANCE', 'AUTRE'
    - `label` (text) - description of the expense
    - `amount` (numeric) - expense amount in FCFA
    - `expense_date` (timestamptz) - when the expense occurred
    - `created_at` (timestamptz)

  ## Security
  - RLS enabled
  - anon and authenticated roles can read/insert/update expenses
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

CREATE POLICY "Authenticated users can view expenses"
  ON expenses FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert expenses"
  ON expenses FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update expenses"
  ON expenses FOR UPDATE
  TO anon, authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Authenticated users can delete expenses"
  ON expenses FOR DELETE
  TO anon, authenticated
  USING (true);


-- Expenses table for the POS module
CREATE TABLE IF NOT EXISTS expenses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id uuid NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
  expense_number serial,
  category text NOT NULL DEFAULT '',
  description text NOT NULL DEFAULT '',
  amount numeric(12,2) NOT NULL DEFAULT 0,
  payment_method text NOT NULL DEFAULT 'cash' CHECK (payment_method IN ('cash', 'wave', 'orange_money', 'card', 'bank_transfer')),
  reference text NOT NULL DEFAULT '',
  recipient text NOT NULL DEFAULT '',
  notes text NOT NULL DEFAULT '',
  expense_date date NOT NULL DEFAULT CURRENT_DATE,
  created_by text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE expenses ENABLE ROW LEVEL SECURITY;

-- RLS policies - accessible to all authenticated users within their site
CREATE POLICY "select_expenses" ON expenses FOR SELECT
  TO authenticated USING (
    site_id IN (SELECT s.id FROM sites s WHERE private.user_owns_site(s.id))
  );

CREATE POLICY "insert_expenses" ON expenses FOR INSERT
  TO authenticated WITH CHECK (
    site_id IN (SELECT s.id FROM sites s WHERE private.user_owns_site(s.id))
  );

CREATE POLICY "update_expenses" ON expenses FOR UPDATE
  TO authenticated 
  USING (site_id IN (SELECT s.id FROM sites s WHERE private.user_owns_site(s.id)))
  WITH CHECK (site_id IN (SELECT s.id FROM sites s WHERE private.user_owns_site(s.id)));

CREATE POLICY "delete_expenses" ON expenses FOR DELETE
  TO authenticated USING (
    site_id IN (SELECT s.id FROM sites s WHERE private.user_owns_site(s.id))
  );

-- Index for fast queries
CREATE INDEX idx_expenses_site_date ON expenses(site_id, expense_date DESC);
CREATE INDEX idx_expenses_site_category ON expenses(site_id, category);

/*
  # Extension du système de clôture de caisse

  ## Contexte
  La table cash_sessions existe déjà avec : id, caissier_id, ouverture, fermeture,
  total_especes, notes, created_at. On l'étend et on crée les nouvelles tables.

  ## Modifications cash_sessions
  - Ajout status (open/closed)
  - Ajout opening_float (fond de caisse initial)
  - Ajout opened_by / closed_by (liens utilisateurs)
  - Ajout closed_at

  ## Nouvelles tables
  - cash_movements : mouvements hors-ventes (IN/OUT)
  - cash_closures : rapports X/Z immuables
  - cash_audit_logs : journal d'audit

  ## Modifications payments
  - Ajout method (CASH/CARD/WAVE/ORANGE_MONEY/OTHER)
  - Ajout pay_status (valid/refunded)
  - Ajout paid_at
  - Ajout session_id
*/

-- =====================
-- EXTEND cash_sessions
-- =====================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'cash_sessions' AND column_name = 'status'
  ) THEN
    ALTER TABLE cash_sessions ADD COLUMN status text NOT NULL DEFAULT 'open';
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'cash_sessions_status_check'
  ) THEN
    ALTER TABLE cash_sessions ADD CONSTRAINT cash_sessions_status_check
      CHECK (status IN ('open', 'closed'));
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'cash_sessions' AND column_name = 'opening_float'
  ) THEN
    ALTER TABLE cash_sessions ADD COLUMN opening_float numeric(12,2) NOT NULL DEFAULT 0;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'cash_sessions' AND column_name = 'opened_by'
  ) THEN
    ALTER TABLE cash_sessions ADD COLUMN opened_by uuid REFERENCES users(id);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'cash_sessions' AND column_name = 'closed_by'
  ) THEN
    ALTER TABLE cash_sessions ADD COLUMN closed_by uuid REFERENCES users(id);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'cash_sessions' AND column_name = 'opened_at'
  ) THEN
    ALTER TABLE cash_sessions ADD COLUMN opened_at timestamptz DEFAULT now();
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'cash_sessions' AND column_name = 'closed_at'
  ) THEN
    ALTER TABLE cash_sessions ADD COLUMN closed_at timestamptz;
  END IF;
END $$;

-- Sync opened_by from caissier_id for existing rows
UPDATE cash_sessions SET opened_by = caissier_id WHERE opened_by IS NULL AND caissier_id IS NOT NULL;

-- Sync opened_at from ouverture for existing rows
UPDATE cash_sessions SET opened_at = ouverture WHERE opened_at IS NULL AND ouverture IS NOT NULL;

-- Sync closed_at from fermeture for existing rows
UPDATE cash_sessions SET closed_at = fermeture WHERE closed_at IS NULL AND fermeture IS NOT NULL;

-- Sync status for existing closed sessions
UPDATE cash_sessions SET status = 'closed' WHERE fermeture IS NOT NULL AND status = 'open';

-- Indexes
CREATE INDEX IF NOT EXISTS idx_cash_sessions_status ON cash_sessions(status);
CREATE INDEX IF NOT EXISTS idx_cash_sessions_opened_at ON cash_sessions(opened_at);

-- RLS
ALTER TABLE cash_sessions ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'cash_sessions' AND policyname = 'Staff can view cash sessions') THEN
    CREATE POLICY "Staff can view cash sessions" ON cash_sessions FOR SELECT TO authenticated USING (true);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'cash_sessions' AND policyname = 'Staff can insert cash sessions') THEN
    CREATE POLICY "Staff can insert cash sessions" ON cash_sessions FOR INSERT TO authenticated WITH CHECK (true);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'cash_sessions' AND policyname = 'Staff can update cash sessions') THEN
    CREATE POLICY "Staff can update cash sessions" ON cash_sessions FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
  END IF;
END $$;

-- =====================
-- CASH_MOVEMENTS
-- =====================
CREATE TABLE IF NOT EXISTS cash_movements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL REFERENCES cash_sessions(id),
  type text NOT NULL CHECK (type IN ('IN', 'OUT')),
  amount numeric(12,2) NOT NULL CHECK (amount > 0),
  reason text NOT NULL DEFAULT '',
  created_by uuid REFERENCES users(id),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_cash_movements_session ON cash_movements(session_id);

ALTER TABLE cash_movements ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'cash_movements' AND policyname = 'Staff can view cash movements') THEN
    CREATE POLICY "Staff can view cash movements" ON cash_movements FOR SELECT TO authenticated USING (true);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'cash_movements' AND policyname = 'Staff can insert cash movements') THEN
    CREATE POLICY "Staff can insert cash movements" ON cash_movements FOR INSERT TO authenticated WITH CHECK (true);
  END IF;
END $$;

-- =====================
-- CASH_CLOSURES
-- =====================
CREATE TABLE IF NOT EXISTS cash_closures (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL REFERENCES cash_sessions(id),
  type text NOT NULL CHECK (type IN ('X', 'Z')),
  created_by uuid REFERENCES users(id),
  totals_json jsonb NOT NULL DEFAULT '{}',
  excluded_unpaid_count integer NOT NULL DEFAULT 0,
  excluded_unpaid_amount numeric(12,2) NOT NULL DEFAULT 0,
  cash_counted numeric(12,2),
  cash_difference numeric(12,2),
  notes text DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_cash_closures_session ON cash_closures(session_id);
CREATE INDEX IF NOT EXISTS idx_cash_closures_type ON cash_closures(type);

ALTER TABLE cash_closures ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'cash_closures' AND policyname = 'Staff can view cash closures') THEN
    CREATE POLICY "Staff can view cash closures" ON cash_closures FOR SELECT TO authenticated USING (true);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'cash_closures' AND policyname = 'Staff can insert cash closures') THEN
    CREATE POLICY "Staff can insert cash closures" ON cash_closures FOR INSERT TO authenticated WITH CHECK (true);
  END IF;
END $$;

-- =====================
-- CASH_AUDIT_LOGS
-- =====================
CREATE TABLE IF NOT EXISTS cash_audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES users(id),
  action text NOT NULL,
  payload jsonb DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_cash_audit_logs_user ON cash_audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_cash_audit_logs_created ON cash_audit_logs(created_at);

ALTER TABLE cash_audit_logs ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'cash_audit_logs' AND policyname = 'Staff can view audit logs') THEN
    CREATE POLICY "Staff can view audit logs" ON cash_audit_logs FOR SELECT TO authenticated USING (true);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'cash_audit_logs' AND policyname = 'Staff can insert audit logs') THEN
    CREATE POLICY "Staff can insert audit logs" ON cash_audit_logs FOR INSERT TO authenticated WITH CHECK (true);
  END IF;
END $$;

-- =====================
-- EXTEND PAYMENTS TABLE
-- =====================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'payments' AND column_name = 'method'
  ) THEN
    ALTER TABLE payments ADD COLUMN method text DEFAULT 'CASH';
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'payments_method_check'
  ) THEN
    ALTER TABLE payments ADD CONSTRAINT payments_method_check
      CHECK (method IN ('CASH','CARD','WAVE','ORANGE_MONEY','OTHER'));
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'payments' AND column_name = 'pay_status'
  ) THEN
    ALTER TABLE payments ADD COLUMN pay_status text NOT NULL DEFAULT 'valid';
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'payments_pay_status_check'
  ) THEN
    ALTER TABLE payments ADD CONSTRAINT payments_pay_status_check
      CHECK (pay_status IN ('valid','refunded'));
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'payments' AND column_name = 'paid_at'
  ) THEN
    ALTER TABLE payments ADD COLUMN paid_at timestamptz DEFAULT now();
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'payments' AND column_name = 'session_id'
  ) THEN
    ALTER TABLE payments ADD COLUMN session_id uuid REFERENCES cash_sessions(id);
  END IF;
END $$;

-- Migrate existing mode values to method
UPDATE payments
SET method = CASE
  WHEN mode = 'ESPECES' THEN 'CASH'
  ELSE 'OTHER'
END
WHERE method IS NULL OR method = 'CASH';

-- Sync paid_at from created_at
UPDATE payments SET paid_at = created_at WHERE paid_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_payments_session ON payments(session_id);
CREATE INDEX IF NOT EXISTS idx_payments_paid_at ON payments(paid_at);
CREATE INDEX IF NOT EXISTS idx_payments_pay_status ON payments(pay_status);

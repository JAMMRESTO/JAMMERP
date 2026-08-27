/*
  # Point de Vente (POS) Module

  ## Overview
  Adds a complete Point of Sale system that integrates with existing invoicing,
  expenses, and stock management modules.

  ## New Tables

  ### `pos_sessions`
  - Tracks each POS session (opening/closing of the cash register)
  - Columns: id, company_id, opened_by, opened_at, closed_at, fond_caisse_ouverture,
    fond_caisse_fermeture, total_ventes, total_especes, total_autres, notes, statut

  ### `pos_ventes`
  - Each individual POS sale transaction
  - Columns: id, company_id, session_id, numero, client_id (optional),
    date_vente, total_ht, total_tva, total_ttc, montant_recu, monnaie_rendue,
    mode_paiement, statut, notes, created_by, created_at

  ### `pos_vente_lignes`
  - Line items for each POS sale
  - Columns: id, vente_id, produit_id, designation, quantite, prix_unitaire,
    tva_taux, montant_ht, montant_tva, montant_ttc, sort_order

  ### `pos_facture_payments`
  - Links POS payments to unpaid invoices from the invoicing module
  - Columns: id, company_id, vente_id, facture_id, montant, created_at

  ## Modified Tables
  - `companies`: adds `pos_enabled` boolean column

  ## Security
  - RLS enabled on all new tables
  - Access restricted to authenticated users belonging to the same company
*/

-- Add POS enabled flag to companies
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'companies' AND column_name = 'pos_enabled'
  ) THEN
    ALTER TABLE companies ADD COLUMN pos_enabled boolean DEFAULT false;
  END IF;
END $$;

-- POS Sessions table
CREATE TABLE IF NOT EXISTS pos_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES companies(id),
  opened_by uuid REFERENCES auth.users(id),
  opened_at timestamptz DEFAULT now(),
  closed_at timestamptz,
  fond_caisse_ouverture numeric(12,2) DEFAULT 0,
  fond_caisse_fermeture numeric(12,2),
  total_ventes numeric(12,2) DEFAULT 0,
  total_especes numeric(12,2) DEFAULT 0,
  total_autres numeric(12,2) DEFAULT 0,
  notes text DEFAULT '',
  statut text DEFAULT 'ouverte' CHECK (statut IN ('ouverte', 'fermée')),
  created_at timestamptz DEFAULT now()
);

ALTER TABLE pos_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own company pos sessions"
  ON pos_sessions FOR SELECT
  TO authenticated
  USING (company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid()));

CREATE POLICY "Users can insert own company pos sessions"
  ON pos_sessions FOR INSERT
  TO authenticated
  WITH CHECK (company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid()));

CREATE POLICY "Users can update own company pos sessions"
  ON pos_sessions FOR UPDATE
  TO authenticated
  USING (company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid()))
  WITH CHECK (company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid()));

-- POS Ventes (sales) table
CREATE TABLE IF NOT EXISTS pos_ventes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES companies(id),
  session_id uuid REFERENCES pos_sessions(id),
  numero text NOT NULL,
  client_id uuid REFERENCES clients(id),
  date_vente date NOT NULL DEFAULT CURRENT_DATE,
  total_ht numeric(12,2) DEFAULT 0,
  total_tva numeric(12,2) DEFAULT 0,
  total_ttc numeric(12,2) NOT NULL DEFAULT 0,
  montant_recu numeric(12,2) DEFAULT 0,
  monnaie_rendue numeric(12,2) DEFAULT 0,
  mode_paiement text DEFAULT 'Espèces',
  statut text DEFAULT 'finalisée' CHECK (statut IN ('finalisée', 'annulée')),
  notes text DEFAULT '',
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz DEFAULT now()
);

ALTER TABLE pos_ventes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own company pos ventes"
  ON pos_ventes FOR SELECT
  TO authenticated
  USING (company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid()));

CREATE POLICY "Users can insert own company pos ventes"
  ON pos_ventes FOR INSERT
  TO authenticated
  WITH CHECK (company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid()));

CREATE POLICY "Users can update own company pos ventes"
  ON pos_ventes FOR UPDATE
  TO authenticated
  USING (company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid()))
  WITH CHECK (company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid()));

-- POS Vente Lignes (line items) table
CREATE TABLE IF NOT EXISTS pos_vente_lignes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  vente_id uuid NOT NULL REFERENCES pos_ventes(id) ON DELETE CASCADE,
  produit_id uuid REFERENCES produits(id),
  designation text NOT NULL,
  quantite numeric(12,3) DEFAULT 1,
  prix_unitaire numeric(12,2) DEFAULT 0,
  tva_taux numeric(5,2) DEFAULT 0,
  montant_ht numeric(12,2) DEFAULT 0,
  montant_tva numeric(12,2) DEFAULT 0,
  montant_ttc numeric(12,2) DEFAULT 0,
  sort_order integer DEFAULT 0
);

ALTER TABLE pos_vente_lignes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view pos vente lignes"
  ON pos_vente_lignes FOR SELECT
  TO authenticated
  USING (vente_id IN (
    SELECT id FROM pos_ventes WHERE company_id IN (
      SELECT company_id FROM profiles WHERE id = auth.uid()
    )
  ));

CREATE POLICY "Users can insert pos vente lignes"
  ON pos_vente_lignes FOR INSERT
  TO authenticated
  WITH CHECK (vente_id IN (
    SELECT id FROM pos_ventes WHERE company_id IN (
      SELECT company_id FROM profiles WHERE id = auth.uid()
    )
  ));

-- POS Facture Payments (link POS payments to unpaid invoices)
CREATE TABLE IF NOT EXISTS pos_facture_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES companies(id),
  vente_id uuid REFERENCES pos_ventes(id),
  facture_id uuid NOT NULL REFERENCES factures(id),
  montant numeric(12,2) NOT NULL,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE pos_facture_payments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own company pos facture payments"
  ON pos_facture_payments FOR SELECT
  TO authenticated
  USING (company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid()));

CREATE POLICY "Users can insert own company pos facture payments"
  ON pos_facture_payments FOR INSERT
  TO authenticated
  WITH CHECK (company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid()));

-- Indexes for performance
CREATE INDEX IF NOT EXISTS pos_ventes_company_id_idx ON pos_ventes(company_id);
CREATE INDEX IF NOT EXISTS pos_ventes_date_vente_idx ON pos_ventes(date_vente);
CREATE INDEX IF NOT EXISTS pos_ventes_session_id_idx ON pos_ventes(session_id);
CREATE INDEX IF NOT EXISTS pos_sessions_company_id_idx ON pos_sessions(company_id);
CREATE INDEX IF NOT EXISTS pos_facture_payments_facture_id_idx ON pos_facture_payments(facture_id);

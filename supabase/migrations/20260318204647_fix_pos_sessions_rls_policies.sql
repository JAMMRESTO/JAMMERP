/*
  # Fix RLS policies for POS tables

  ## Problem
  The pos_sessions INSERT policy was failing with "new row violates row-level security policy".
  The existing policies use an inline subquery on profiles which can conflict with other RLS policies.

  ## Fix
  - Replace inline subqueries with get_my_company_id() helper (SECURITY DEFINER, bypasses RLS)
  - Add superadmin access to all POS tables
  - Ensure all CRUD operations work correctly for company members and superadmin
*/

-- =============================================
-- pos_sessions
-- =============================================

DROP POLICY IF EXISTS "Users can view own company pos sessions" ON pos_sessions;
DROP POLICY IF EXISTS "Users can insert own company pos sessions" ON pos_sessions;
DROP POLICY IF EXISTS "Users can update own company pos sessions" ON pos_sessions;

CREATE POLICY "Users can view own company pos sessions"
  ON pos_sessions FOR SELECT
  TO authenticated
  USING (company_id = get_my_company_id() OR get_my_role() = 'superadmin');

CREATE POLICY "Users can insert own company pos sessions"
  ON pos_sessions FOR INSERT
  TO authenticated
  WITH CHECK (company_id = get_my_company_id() OR get_my_role() = 'superadmin');

CREATE POLICY "Users can update own company pos sessions"
  ON pos_sessions FOR UPDATE
  TO authenticated
  USING (company_id = get_my_company_id() OR get_my_role() = 'superadmin')
  WITH CHECK (company_id = get_my_company_id() OR get_my_role() = 'superadmin');

-- =============================================
-- pos_ventes
-- =============================================

DROP POLICY IF EXISTS "Users can view own company pos ventes" ON pos_ventes;
DROP POLICY IF EXISTS "Users can insert own company pos ventes" ON pos_ventes;
DROP POLICY IF EXISTS "Users can update own company pos ventes" ON pos_ventes;

CREATE POLICY "Users can view own company pos ventes"
  ON pos_ventes FOR SELECT
  TO authenticated
  USING (company_id = get_my_company_id() OR get_my_role() = 'superadmin');

CREATE POLICY "Users can insert own company pos ventes"
  ON pos_ventes FOR INSERT
  TO authenticated
  WITH CHECK (company_id = get_my_company_id() OR get_my_role() = 'superadmin');

CREATE POLICY "Users can update own company pos ventes"
  ON pos_ventes FOR UPDATE
  TO authenticated
  USING (company_id = get_my_company_id() OR get_my_role() = 'superadmin')
  WITH CHECK (company_id = get_my_company_id() OR get_my_role() = 'superadmin');

-- =============================================
-- pos_vente_lignes
-- =============================================

DROP POLICY IF EXISTS "Users can view pos vente lignes" ON pos_vente_lignes;
DROP POLICY IF EXISTS "Users can insert pos vente lignes" ON pos_vente_lignes;

CREATE POLICY "Users can view pos vente lignes"
  ON pos_vente_lignes FOR SELECT
  TO authenticated
  USING (
    vente_id IN (
      SELECT id FROM pos_ventes
      WHERE company_id = get_my_company_id() OR get_my_role() = 'superadmin'
    )
  );

CREATE POLICY "Users can insert pos vente lignes"
  ON pos_vente_lignes FOR INSERT
  TO authenticated
  WITH CHECK (
    vente_id IN (
      SELECT id FROM pos_ventes
      WHERE company_id = get_my_company_id() OR get_my_role() = 'superadmin'
    )
  );

-- =============================================
-- pos_facture_payments
-- =============================================

DROP POLICY IF EXISTS "Users can view own company pos facture payments" ON pos_facture_payments;
DROP POLICY IF EXISTS "Users can insert own company pos facture payments" ON pos_facture_payments;

CREATE POLICY "Users can view own company pos facture payments"
  ON pos_facture_payments FOR SELECT
  TO authenticated
  USING (company_id = get_my_company_id() OR get_my_role() = 'superadmin');

CREATE POLICY "Users can insert own company pos facture payments"
  ON pos_facture_payments FOR INSERT
  TO authenticated
  WITH CHECK (company_id = get_my_company_id() OR get_my_role() = 'superadmin');

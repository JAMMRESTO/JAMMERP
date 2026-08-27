/*
  # Create Super Admin Setup

  1. Creates the SUNUFACTURE platform company
  2. Creates the profile for admin@sunufacture.com as super admin
  3. Sets the role to 'admin' with full access

  Notes:
  - The auth user already exists (id: 77a3aac0-6254-49ac-b259-2c58f517eae3)
  - We create the platform company and link the profile to it
  - A super admin role is created with all permissions
*/

DO $$
DECLARE
  v_company_id uuid;
  v_role_id uuid;
  v_user_id uuid := '77a3aac0-6254-49ac-b259-2c58f517eae3';
BEGIN
  INSERT INTO companies (name, email, currency, currency_symbol, subscription_plan, subscription_status, is_active)
  VALUES ('SUNUFACTURE', 'admin@sunufacture.com', 'XOF', 'F CFA', 'enterprise', 'active', true)
  ON CONFLICT DO NOTHING
  RETURNING id INTO v_company_id;

  IF v_company_id IS NULL THEN
    SELECT id INTO v_company_id FROM companies WHERE email = 'admin@sunufacture.com' LIMIT 1;
  END IF;

  INSERT INTO roles (company_id, nom, permissions_json)
  VALUES (v_company_id, 'Super Admin', '{"all": true, "admin": true, "factures": true, "devis": true, "clients": true, "fournisseurs": true, "produits": true, "depenses": true, "statistiques": true, "paiements": true, "inventaire": true, "parametres": true}'::jsonb)
  ON CONFLICT DO NOTHING
  RETURNING id INTO v_role_id;

  IF v_role_id IS NULL THEN
    SELECT id INTO v_role_id FROM roles WHERE company_id = v_company_id AND nom = 'Super Admin' LIMIT 1;
  END IF;

  INSERT INTO profiles (id, company_id, full_name, role, role_id, is_active)
  VALUES (v_user_id, v_company_id, 'Administrateur Général', 'admin', v_role_id, true)
  ON CONFLICT (id) DO UPDATE SET
    company_id = v_company_id,
    full_name = 'Administrateur Général',
    role = 'admin',
    role_id = v_role_id,
    is_active = true;
END $$;

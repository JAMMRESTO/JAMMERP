/*
  # Add default roles for all companies and superadmin RLS for roles

  1. Security Changes
    - Allow superadmin to SELECT, INSERT, UPDATE, DELETE roles across all companies
    - This enables the Admin SaaS panel to manage roles for any company

  2. Data Changes
    - Insert default roles (Comptable, Commercial, Superviseur, Vendeur) 
      for all existing companies that don't already have them
    - Each role comes with sensible default permissions

  3. Notes
    - Existing roles are not modified
    - Only companies missing these specific role names get new entries
*/

-- Allow superadmin to read roles from any company
DROP POLICY IF EXISTS "Superadmin can select all roles" ON roles;
CREATE POLICY "Superadmin can select all roles"
  ON roles FOR SELECT TO authenticated
  USING (get_my_role() = 'superadmin');

-- Allow superadmin to insert roles for any company
DROP POLICY IF EXISTS "Superadmin can insert roles" ON roles;
CREATE POLICY "Superadmin can insert roles"
  ON roles FOR INSERT TO authenticated
  WITH CHECK (get_my_role() = 'superadmin');

-- Allow superadmin to update roles for any company
DROP POLICY IF EXISTS "Superadmin can update roles" ON roles;
CREATE POLICY "Superadmin can update roles"
  ON roles FOR UPDATE TO authenticated
  USING (get_my_role() = 'superadmin')
  WITH CHECK (get_my_role() = 'superadmin');

-- Allow superadmin to delete roles for any company
DROP POLICY IF EXISTS "Superadmin can delete roles" ON roles;
CREATE POLICY "Superadmin can delete roles"
  ON roles FOR DELETE TO authenticated
  USING (get_my_role() = 'superadmin');

-- Insert default Comptable role for companies that don't have it
INSERT INTO roles (company_id, nom, permissions_json)
SELECT c.id, 'Comptable', '{"factures": true, "depenses": true, "statistiques": true, "paiements": true, "fournisseurs": true}'::jsonb
FROM companies c
WHERE NOT EXISTS (
  SELECT 1 FROM roles r WHERE r.company_id = c.id AND r.nom = 'Comptable'
);

-- Insert default Commercial role for companies that don't have it
INSERT INTO roles (company_id, nom, permissions_json)
SELECT c.id, 'Commercial', '{"factures": true, "clients": true, "devis": true, "produits": true, "paiements": true}'::jsonb
FROM companies c
WHERE NOT EXISTS (
  SELECT 1 FROM roles r WHERE r.company_id = c.id AND r.nom = 'Commercial'
);

-- Insert default Superviseur role for companies that don't have it
INSERT INTO roles (company_id, nom, permissions_json)
SELECT c.id, 'Superviseur', '{"factures": true, "clients": true, "devis": true, "produits": true, "paiements": true, "fournisseurs": true, "inventaire": true, "depenses": true, "statistiques": true}'::jsonb
FROM companies c
WHERE NOT EXISTS (
  SELECT 1 FROM roles r WHERE r.company_id = c.id AND r.nom = 'Superviseur'
);

-- Insert default Vendeur role for companies that don't have it
INSERT INTO roles (company_id, nom, permissions_json)
SELECT c.id, 'Vendeur', '{"factures": true, "clients": true, "produits": true, "paiements": true}'::jsonb
FROM companies c
WHERE NOT EXISTS (
  SELECT 1 FROM roles r WHERE r.company_id = c.id AND r.nom = 'Vendeur'
);

-- Create a trigger function to auto-seed default roles when a new company is created
CREATE OR REPLACE FUNCTION seed_default_roles_for_company()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO roles (company_id, nom, permissions_json) VALUES
    (NEW.id, 'Admin', '{"all": true}'::jsonb),
    (NEW.id, 'Comptable', '{"factures": true, "depenses": true, "statistiques": true, "paiements": true, "fournisseurs": true}'::jsonb),
    (NEW.id, 'Commercial', '{"factures": true, "clients": true, "devis": true, "produits": true, "paiements": true}'::jsonb),
    (NEW.id, 'Superviseur', '{"factures": true, "clients": true, "devis": true, "produits": true, "paiements": true, "fournisseurs": true, "inventaire": true, "depenses": true, "statistiques": true}'::jsonb),
    (NEW.id, 'Vendeur', '{"factures": true, "clients": true, "produits": true, "paiements": true}'::jsonb);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_seed_default_roles ON companies;
CREATE TRIGGER trg_seed_default_roles
  AFTER INSERT ON companies
  FOR EACH ROW
  EXECUTE FUNCTION seed_default_roles_for_company();

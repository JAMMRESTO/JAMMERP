/*
  # Ajouter le rôle Caissier avec permission POS

  ## Description
  - Ajoute le rôle "Caissier" à toutes les sociétés existantes
  - Met à jour le trigger pour que les nouvelles sociétés reçoivent automatiquement ce rôle
  - Le rôle Caissier a accès au module Point de Vente (pos), clients, produits et paiements
  - Met aussi à jour les rôles existants pour inclure la permission `pos` là où c'est pertinent

  ## Rôles ajoutés / mis à jour
  - **Caissier** (nouveau) : pos, clients, produits, paiements
  - Trigger mis à jour pour inclure Caissier dans les rôles par défaut de toute nouvelle société

  ## Notes
  - Les sociétés existantes sans rôle Caissier se voient attribuer ce rôle automatiquement
  - Le Superviseur et l'Admin gardent leurs permissions (all:true pour Admin couvre tout)
*/

-- Add Caissier role to all existing companies that don't have it
INSERT INTO roles (company_id, nom, permissions_json)
SELECT c.id, 'Caissier', '{"pos": true, "clients": true, "produits": true, "paiements": true}'::jsonb
FROM companies c
WHERE NOT EXISTS (
  SELECT 1 FROM roles r WHERE r.company_id = c.id AND r.nom = 'Caissier'
);

-- Update the trigger function to include the Caissier role for future companies
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
    (NEW.id, 'Superviseur', '{"factures": true, "clients": true, "devis": true, "produits": true, "paiements": true, "fournisseurs": true, "inventaire": true, "depenses": true, "statistiques": true, "pos": true}'::jsonb),
    (NEW.id, 'Vendeur', '{"factures": true, "clients": true, "produits": true, "paiements": true}'::jsonb),
    (NEW.id, 'Caissier', '{"pos": true, "clients": true, "produits": true, "paiements": true}'::jsonb);
  RETURN NEW;
END;
$$;

-- Recreate the trigger (idempotent)
DROP TRIGGER IF EXISTS trg_seed_default_roles ON companies;
CREATE TRIGGER trg_seed_default_roles
  AFTER INSERT ON companies
  FOR EACH ROW
  EXECUTE FUNCTION seed_default_roles_for_company();

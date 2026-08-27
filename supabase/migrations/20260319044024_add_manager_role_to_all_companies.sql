/*
  # Add Manager role to all companies

  1. Changes
    - Add a "Manager" role with comprehensive permissions to all companies that don't already have one
    - Manager role gets access to: POS, clients, fournisseurs, factures, devis, paiements, inventaire, produits, depenses, statistiques, parametres, import/export
    - This ensures the "manager" system profile always has a matching permissions role available

  2. Notes
    - Uses INSERT with ON CONFLICT-safe approach via NOT EXISTS check
    - Does not modify any existing roles or permissions
*/

INSERT INTO roles (company_id, nom, permissions_json)
SELECT c.id, 'Manager', '{"pos": true, "clients": true, "fournisseurs": true, "factures": true, "devis": true, "paiements": true, "inventaire": true, "produits": true, "depenses": true, "statistiques": true, "parametres": true, "import_export": true}'::jsonb
FROM companies c
WHERE NOT EXISTS (
  SELECT 1 FROM roles r WHERE r.company_id = c.id AND r.nom = 'Manager'
);

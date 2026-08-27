/*
  # Ensure standard roles exist for all companies

  1. Changes
    - Add missing standard roles to all companies
    - Standard roles: Admin, Manager, Superviseur, Commercial, Comptable, Caissier, Vendeur
    - Each role has appropriate permissions matching its responsibility level

  2. Role permissions hierarchy
    - Admin: all access
    - Manager: all except admin
    - Superviseur: all operational (pos, clients, fournisseurs, factures, devis, paiements, inventaire, produits, depenses, statistiques)
    - Commercial: sales-focused (devis, clients, factures, produits, paiements)
    - Comptable: finance-focused (depenses, factures, paiements, fournisseurs, statistiques)
    - Caissier: POS-focused (pos, clients, produits, paiements)
    - Vendeur: basic sales (clients, factures, produits, paiements)

  3. Notes
    - Uses NOT EXISTS to avoid duplicating existing roles
    - Does not modify any existing role permissions
*/

-- Admin role
INSERT INTO roles (company_id, nom, permissions_json)
SELECT c.id, 'Admin', '{"all": true}'::jsonb
FROM companies c
WHERE NOT EXISTS (SELECT 1 FROM roles r WHERE r.company_id = c.id AND r.nom = 'Admin');

-- Superviseur role
INSERT INTO roles (company_id, nom, permissions_json)
SELECT c.id, 'Superviseur', '{"pos": true, "devis": true, "clients": true, "depenses": true, "factures": true, "produits": true, "paiements": true, "inventaire": true, "fournisseurs": true, "statistiques": true}'::jsonb
FROM companies c
WHERE NOT EXISTS (SELECT 1 FROM roles r WHERE r.company_id = c.id AND r.nom = 'Superviseur');

-- Commercial role
INSERT INTO roles (company_id, nom, permissions_json)
SELECT c.id, 'Commercial', '{"devis": true, "clients": true, "factures": true, "produits": true, "paiements": true}'::jsonb
FROM companies c
WHERE NOT EXISTS (SELECT 1 FROM roles r WHERE r.company_id = c.id AND r.nom = 'Commercial');

-- Comptable role
INSERT INTO roles (company_id, nom, permissions_json)
SELECT c.id, 'Comptable', '{"depenses": true, "factures": true, "paiements": true, "fournisseurs": true, "statistiques": true}'::jsonb
FROM companies c
WHERE NOT EXISTS (SELECT 1 FROM roles r WHERE r.company_id = c.id AND r.nom = 'Comptable');

-- Caissier role
INSERT INTO roles (company_id, nom, permissions_json)
SELECT c.id, 'Caissier', '{"pos": true, "clients": true, "produits": true, "paiements": true}'::jsonb
FROM companies c
WHERE NOT EXISTS (SELECT 1 FROM roles r WHERE r.company_id = c.id AND r.nom = 'Caissier');

-- Vendeur role
INSERT INTO roles (company_id, nom, permissions_json)
SELECT c.id, 'Vendeur', '{"clients": true, "factures": true, "produits": true, "paiements": true}'::jsonb
FROM companies c
WHERE NOT EXISTS (SELECT 1 FROM roles r WHERE r.company_id = c.id AND r.nom = 'Vendeur');

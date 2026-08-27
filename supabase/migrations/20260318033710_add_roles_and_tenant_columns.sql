
/*
  # SUNUFACTURE – Roles, tenant_id & missing columns

  ## Summary
  This migration aligns the schema with the full multi-tenant specification:

  1. New Tables
    - `roles` – Per-tenant role definitions with JSON permissions
      - `id`, `company_id` (tenant), `nom`, `permissions_json`, `created_at`

  2. New Columns
    - All major tables: `tenant_id` alias column synced to `company_id` via trigger
    - `produits`: `conditionnement` (text label), `quantite_par_conditionnement` (numeric)
    - `facture_lignes`: `type_vente` (unite | conditionnement)
    - `devis_lignes`: `type_vente` (unite | conditionnement)
    - `factures_fournisseurs_lignes`: `type_vente`

  3. Security
    - RLS enabled on `roles`
    - Company members can manage their own roles
*/

-- =====================
-- ROLES TABLE
-- =====================
CREATE TABLE IF NOT EXISTS roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  nom text NOT NULL,
  permissions_json jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz DEFAULT now()
);

ALTER TABLE roles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Company members can select roles"
  ON roles FOR SELECT TO authenticated
  USING (company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid()));

CREATE POLICY "Company admins can insert roles"
  ON roles FOR INSERT TO authenticated
  WITH CHECK (company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid() AND role = 'admin'));

CREATE POLICY "Company admins can update roles"
  ON roles FOR UPDATE TO authenticated
  USING (company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid() AND role = 'admin'))
  WITH CHECK (company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid() AND role = 'admin'));

CREATE POLICY "Company admins can delete roles"
  ON roles FOR DELETE TO authenticated
  USING (company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid() AND role = 'admin'));

-- Add role_id FK to profiles (optional, references roles)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'role_id') THEN
    ALTER TABLE profiles ADD COLUMN role_id uuid REFERENCES roles(id) ON DELETE SET NULL;
  END IF;
END $$;

-- =====================
-- PRODUITS: extra columns
-- =====================
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'produits' AND column_name = 'conditionnement') THEN
    ALTER TABLE produits ADD COLUMN conditionnement text DEFAULT '';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'produits' AND column_name = 'quantite_par_conditionnement') THEN
    ALTER TABLE produits ADD COLUMN quantite_par_conditionnement numeric(10,3) DEFAULT 1;
  END IF;
END $$;

-- =====================
-- FACTURE_LIGNES: type_vente
-- =====================
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'facture_lignes' AND column_name = 'type_vente') THEN
    ALTER TABLE facture_lignes ADD COLUMN type_vente text NOT NULL DEFAULT 'unite';
  END IF;
END $$;

-- =====================
-- DEVIS_LIGNES: type_vente
-- =====================
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'devis_lignes' AND column_name = 'type_vente') THEN
    ALTER TABLE devis_lignes ADD COLUMN type_vente text NOT NULL DEFAULT 'unite';
  END IF;
END $$;

-- =====================
-- FACTURES_FOURNISSEURS_LIGNES: type_vente
-- =====================
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'factures_fournisseurs_lignes' AND column_name = 'type_vente') THEN
    ALTER TABLE factures_fournisseurs_lignes ADD COLUMN type_vente text NOT NULL DEFAULT 'unite';
  END IF;
END $$;

-- =====================
-- MOUVEMENTS_STOCK: source column
-- =====================
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'mouvements_stock' AND column_name = 'source') THEN
    ALTER TABLE mouvements_stock ADD COLUMN source text DEFAULT '';
  END IF;
END $$;

-- =====================
-- PAIEMENTS: extra fields
-- =====================
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'paiements' AND column_name = 'date_paiement') THEN
    ALTER TABLE paiements ADD COLUMN date_paiement date DEFAULT CURRENT_DATE;
  END IF;
END $$;

-- =====================
-- TENANT_ID: add to all major tables as alias for company_id
-- =====================

-- Function to sync tenant_id from company_id
CREATE OR REPLACE FUNCTION sync_tenant_id()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.tenant_id IS NULL AND NEW.company_id IS NOT NULL THEN
      NEW.tenant_id := NEW.company_id;
    ELSIF NEW.company_id IS NULL AND NEW.tenant_id IS NOT NULL THEN
      NEW.company_id := NEW.tenant_id;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

-- clients
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'clients' AND column_name = 'tenant_id') THEN
    ALTER TABLE clients ADD COLUMN tenant_id uuid REFERENCES companies(id) ON DELETE CASCADE;
    UPDATE clients SET tenant_id = company_id WHERE tenant_id IS NULL;
  END IF;
END $$;

-- fournisseurs
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'fournisseurs' AND column_name = 'tenant_id') THEN
    ALTER TABLE fournisseurs ADD COLUMN tenant_id uuid REFERENCES companies(id) ON DELETE CASCADE;
    UPDATE fournisseurs SET tenant_id = company_id WHERE tenant_id IS NULL;
  END IF;
END $$;

-- produits
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'produits' AND column_name = 'tenant_id') THEN
    ALTER TABLE produits ADD COLUMN tenant_id uuid REFERENCES companies(id) ON DELETE CASCADE;
    UPDATE produits SET tenant_id = company_id WHERE tenant_id IS NULL;
  END IF;
END $$;

-- factures
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'factures' AND column_name = 'tenant_id') THEN
    ALTER TABLE factures ADD COLUMN tenant_id uuid REFERENCES companies(id) ON DELETE CASCADE;
    UPDATE factures SET tenant_id = company_id WHERE tenant_id IS NULL;
  END IF;
END $$;

-- devis
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'devis' AND column_name = 'tenant_id') THEN
    ALTER TABLE devis ADD COLUMN tenant_id uuid REFERENCES companies(id) ON DELETE CASCADE;
    UPDATE devis SET tenant_id = company_id WHERE tenant_id IS NULL;
  END IF;
END $$;

-- depenses
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'depenses' AND column_name = 'tenant_id') THEN
    ALTER TABLE depenses ADD COLUMN tenant_id uuid REFERENCES companies(id) ON DELETE CASCADE;
    UPDATE depenses SET tenant_id = company_id WHERE tenant_id IS NULL;
  END IF;
END $$;

-- retours
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'retours' AND column_name = 'tenant_id') THEN
    ALTER TABLE retours ADD COLUMN tenant_id uuid REFERENCES companies(id) ON DELETE CASCADE;
    UPDATE retours SET tenant_id = company_id WHERE tenant_id IS NULL;
  END IF;
END $$;

-- mouvements_stock
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'mouvements_stock' AND column_name = 'tenant_id') THEN
    ALTER TABLE mouvements_stock ADD COLUMN tenant_id uuid REFERENCES companies(id) ON DELETE CASCADE;
    UPDATE mouvements_stock SET tenant_id = company_id WHERE tenant_id IS NULL;
  END IF;
END $$;

-- categories
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'categories' AND column_name = 'tenant_id') THEN
    ALTER TABLE categories ADD COLUMN tenant_id uuid REFERENCES companies(id) ON DELETE CASCADE;
    UPDATE categories SET tenant_id = company_id WHERE tenant_id IS NULL;
  END IF;
END $$;

-- paiements
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'paiements' AND column_name = 'tenant_id') THEN
    ALTER TABLE paiements ADD COLUMN tenant_id uuid REFERENCES companies(id) ON DELETE CASCADE;
    UPDATE paiements SET tenant_id = company_id WHERE tenant_id IS NULL;
  END IF;
END $$;

-- factures_fournisseurs
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'factures_fournisseurs' AND column_name = 'tenant_id') THEN
    ALTER TABLE factures_fournisseurs ADD COLUMN tenant_id uuid REFERENCES companies(id) ON DELETE CASCADE;
    UPDATE factures_fournisseurs SET tenant_id = company_id WHERE tenant_id IS NULL;
  END IF;
END $$;

-- paiements_fournisseurs
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'paiements_fournisseurs' AND column_name = 'tenant_id') THEN
    ALTER TABLE paiements_fournisseurs ADD COLUMN tenant_id uuid REFERENCES companies(id) ON DELETE CASCADE;
    UPDATE paiements_fournisseurs SET tenant_id = company_id WHERE tenant_id IS NULL;
  END IF;
END $$;

-- =====================
-- INDEXES for tenant_id
-- =====================
CREATE INDEX IF NOT EXISTS idx_clients_tenant ON clients(tenant_id);
CREATE INDEX IF NOT EXISTS idx_fournisseurs_tenant ON fournisseurs(tenant_id);
CREATE INDEX IF NOT EXISTS idx_produits_tenant ON produits(tenant_id);
CREATE INDEX IF NOT EXISTS idx_factures_tenant ON factures(tenant_id);
CREATE INDEX IF NOT EXISTS idx_devis_tenant ON devis(tenant_id);
CREATE INDEX IF NOT EXISTS idx_depenses_tenant ON depenses(tenant_id);
CREATE INDEX IF NOT EXISTS idx_mouvements_tenant ON mouvements_stock(tenant_id);
CREATE INDEX IF NOT EXISTS idx_roles_company ON roles(company_id);

-- =====================
-- INSERT DEFAULT ROLES for existing companies
-- =====================
INSERT INTO roles (company_id, nom, permissions_json)
SELECT id, 'Admin', '{"all": true}'::jsonb
FROM companies
WHERE id NOT IN (SELECT DISTINCT company_id FROM roles WHERE nom = 'Admin');

INSERT INTO roles (company_id, nom, permissions_json)
SELECT id, 'Commercial', '{"factures": true, "clients": true, "devis": true, "produits": true}'::jsonb
FROM companies
WHERE id NOT IN (SELECT DISTINCT company_id FROM roles WHERE nom = 'Commercial');

INSERT INTO roles (company_id, nom, permissions_json)
SELECT id, 'Comptable', '{"factures": true, "depenses": true, "statistiques": true, "paiements": true}'::jsonb
FROM companies
WHERE id NOT IN (SELECT DISTINCT company_id FROM roles WHERE nom = 'Comptable');

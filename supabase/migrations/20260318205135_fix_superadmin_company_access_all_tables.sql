/*
  # Fix superadmin access to all company tables

  ## Problem
  The superadmin user has their own company_id in profiles, but when they access
  another company's data (e.g., viewing/editing a client company), all RLS policies
  using get_my_company_id() fail because it returns the superadmin's own company_id,
  not the target company's id.

  ## Fix
  1. Create a helper function `is_superadmin()` (SECURITY DEFINER)
  2. Update all RLS policies on all business tables to also allow superadmin access
  3. This covers: depenses, produits, clients, factures, devis, pos_ventes, pos_sessions,
     fournisseurs, paiements, mouvements_stock, retours, categories, roles, etc.
*/

-- Helper function for superadmin check
CREATE OR REPLACE FUNCTION public.is_superadmin()
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS(SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'superadmin');
$$;

-- =============================================
-- DEPENSES
-- =============================================
DROP POLICY IF EXISTS "Company members can select depenses" ON depenses;
DROP POLICY IF EXISTS "Company members can insert depenses" ON depenses;
DROP POLICY IF EXISTS "Company members can update depenses" ON depenses;
DROP POLICY IF EXISTS "Company members can delete depenses" ON depenses;

CREATE POLICY "Company members can select depenses"
  ON depenses FOR SELECT TO authenticated
  USING (company_id = get_my_company_id() OR is_superadmin());

CREATE POLICY "Company members can insert depenses"
  ON depenses FOR INSERT TO authenticated
  WITH CHECK (company_id = get_my_company_id() OR is_superadmin());

CREATE POLICY "Company members can update depenses"
  ON depenses FOR UPDATE TO authenticated
  USING (company_id = get_my_company_id() OR is_superadmin())
  WITH CHECK (company_id = get_my_company_id() OR is_superadmin());

CREATE POLICY "Company members can delete depenses"
  ON depenses FOR DELETE TO authenticated
  USING (company_id = get_my_company_id() OR is_superadmin());

-- =============================================
-- PRODUITS
-- =============================================
DROP POLICY IF EXISTS "Company members can select produits" ON produits;
DROP POLICY IF EXISTS "Company members can insert produits" ON produits;
DROP POLICY IF EXISTS "Company members can update produits" ON produits;
DROP POLICY IF EXISTS "Company members can delete produits" ON produits;

CREATE POLICY "Company members can select produits"
  ON produits FOR SELECT TO authenticated
  USING (company_id = get_my_company_id() OR is_superadmin());

CREATE POLICY "Company members can insert produits"
  ON produits FOR INSERT TO authenticated
  WITH CHECK (company_id = get_my_company_id() OR is_superadmin());

CREATE POLICY "Company members can update produits"
  ON produits FOR UPDATE TO authenticated
  USING (company_id = get_my_company_id() OR is_superadmin())
  WITH CHECK (company_id = get_my_company_id() OR is_superadmin());

CREATE POLICY "Company members can delete produits"
  ON produits FOR DELETE TO authenticated
  USING (company_id = get_my_company_id() OR is_superadmin());

-- =============================================
-- CLIENTS
-- =============================================
DROP POLICY IF EXISTS "Company members can select clients" ON clients;
DROP POLICY IF EXISTS "Company members can insert clients" ON clients;
DROP POLICY IF EXISTS "Company members can update clients" ON clients;
DROP POLICY IF EXISTS "Company members can delete clients" ON clients;

CREATE POLICY "Company members can select clients"
  ON clients FOR SELECT TO authenticated
  USING (company_id = get_my_company_id() OR is_superadmin());

CREATE POLICY "Company members can insert clients"
  ON clients FOR INSERT TO authenticated
  WITH CHECK (company_id = get_my_company_id() OR is_superadmin());

CREATE POLICY "Company members can update clients"
  ON clients FOR UPDATE TO authenticated
  USING (company_id = get_my_company_id() OR is_superadmin())
  WITH CHECK (company_id = get_my_company_id() OR is_superadmin());

CREATE POLICY "Company members can delete clients"
  ON clients FOR DELETE TO authenticated
  USING (company_id = get_my_company_id() OR is_superadmin());

-- =============================================
-- FACTURES
-- =============================================
DROP POLICY IF EXISTS "Company members can select factures" ON factures;
DROP POLICY IF EXISTS "Company members can insert factures" ON factures;
DROP POLICY IF EXISTS "Company members can update factures" ON factures;
DROP POLICY IF EXISTS "Company members can delete factures" ON factures;

CREATE POLICY "Company members can select factures"
  ON factures FOR SELECT TO authenticated
  USING (company_id = get_my_company_id() OR is_superadmin());

CREATE POLICY "Company members can insert factures"
  ON factures FOR INSERT TO authenticated
  WITH CHECK (company_id = get_my_company_id() OR is_superadmin());

CREATE POLICY "Company members can update factures"
  ON factures FOR UPDATE TO authenticated
  USING (company_id = get_my_company_id() OR is_superadmin())
  WITH CHECK (company_id = get_my_company_id() OR is_superadmin());

CREATE POLICY "Company members can delete factures"
  ON factures FOR DELETE TO authenticated
  USING (company_id = get_my_company_id() OR is_superadmin());

-- =============================================
-- FACTURE LIGNES
-- =============================================
DROP POLICY IF EXISTS "Company members can select facture_lignes" ON facture_lignes;
DROP POLICY IF EXISTS "Company members can insert facture_lignes" ON facture_lignes;
DROP POLICY IF EXISTS "Company members can update facture_lignes" ON facture_lignes;
DROP POLICY IF EXISTS "Company members can delete facture_lignes" ON facture_lignes;

CREATE POLICY "Company members can select facture_lignes"
  ON facture_lignes FOR SELECT TO authenticated
  USING (
    facture_id IN (SELECT id FROM factures WHERE company_id = get_my_company_id())
    OR is_superadmin()
  );

CREATE POLICY "Company members can insert facture_lignes"
  ON facture_lignes FOR INSERT TO authenticated
  WITH CHECK (
    facture_id IN (SELECT id FROM factures WHERE company_id = get_my_company_id())
    OR is_superadmin()
  );

CREATE POLICY "Company members can update facture_lignes"
  ON facture_lignes FOR UPDATE TO authenticated
  USING (
    facture_id IN (SELECT id FROM factures WHERE company_id = get_my_company_id())
    OR is_superadmin()
  )
  WITH CHECK (
    facture_id IN (SELECT id FROM factures WHERE company_id = get_my_company_id())
    OR is_superadmin()
  );

CREATE POLICY "Company members can delete facture_lignes"
  ON facture_lignes FOR DELETE TO authenticated
  USING (
    facture_id IN (SELECT id FROM factures WHERE company_id = get_my_company_id())
    OR is_superadmin()
  );

-- =============================================
-- DEVIS
-- =============================================
DROP POLICY IF EXISTS "Company members can select devis" ON devis;
DROP POLICY IF EXISTS "Company members can insert devis" ON devis;
DROP POLICY IF EXISTS "Company members can update devis" ON devis;
DROP POLICY IF EXISTS "Company members can delete devis" ON devis;

CREATE POLICY "Company members can select devis"
  ON devis FOR SELECT TO authenticated
  USING (company_id = get_my_company_id() OR is_superadmin());

CREATE POLICY "Company members can insert devis"
  ON devis FOR INSERT TO authenticated
  WITH CHECK (company_id = get_my_company_id() OR is_superadmin());

CREATE POLICY "Company members can update devis"
  ON devis FOR UPDATE TO authenticated
  USING (company_id = get_my_company_id() OR is_superadmin())
  WITH CHECK (company_id = get_my_company_id() OR is_superadmin());

CREATE POLICY "Company members can delete devis"
  ON devis FOR DELETE TO authenticated
  USING (company_id = get_my_company_id() OR is_superadmin());

-- =============================================
-- DEVIS LIGNES
-- =============================================
DROP POLICY IF EXISTS "Company members can select devis_lignes" ON devis_lignes;
DROP POLICY IF EXISTS "Company members can insert devis_lignes" ON devis_lignes;
DROP POLICY IF EXISTS "Company members can update devis_lignes" ON devis_lignes;
DROP POLICY IF EXISTS "Company members can delete devis_lignes" ON devis_lignes;

CREATE POLICY "Company members can select devis_lignes"
  ON devis_lignes FOR SELECT TO authenticated
  USING (
    devis_id IN (SELECT id FROM devis WHERE company_id = get_my_company_id())
    OR is_superadmin()
  );

CREATE POLICY "Company members can insert devis_lignes"
  ON devis_lignes FOR INSERT TO authenticated
  WITH CHECK (
    devis_id IN (SELECT id FROM devis WHERE company_id = get_my_company_id())
    OR is_superadmin()
  );

CREATE POLICY "Company members can update devis_lignes"
  ON devis_lignes FOR UPDATE TO authenticated
  USING (
    devis_id IN (SELECT id FROM devis WHERE company_id = get_my_company_id())
    OR is_superadmin()
  )
  WITH CHECK (
    devis_id IN (SELECT id FROM devis WHERE company_id = get_my_company_id())
    OR is_superadmin()
  );

CREATE POLICY "Company members can delete devis_lignes"
  ON devis_lignes FOR DELETE TO authenticated
  USING (
    devis_id IN (SELECT id FROM devis WHERE company_id = get_my_company_id())
    OR is_superadmin()
  );

-- =============================================
-- FOURNISSEURS
-- =============================================
DROP POLICY IF EXISTS "Company members can select fournisseurs" ON fournisseurs;
DROP POLICY IF EXISTS "Company members can insert fournisseurs" ON fournisseurs;
DROP POLICY IF EXISTS "Company members can update fournisseurs" ON fournisseurs;
DROP POLICY IF EXISTS "Company members can delete fournisseurs" ON fournisseurs;

CREATE POLICY "Company members can select fournisseurs"
  ON fournisseurs FOR SELECT TO authenticated
  USING (company_id = get_my_company_id() OR is_superadmin());

CREATE POLICY "Company members can insert fournisseurs"
  ON fournisseurs FOR INSERT TO authenticated
  WITH CHECK (company_id = get_my_company_id() OR is_superadmin());

CREATE POLICY "Company members can update fournisseurs"
  ON fournisseurs FOR UPDATE TO authenticated
  USING (company_id = get_my_company_id() OR is_superadmin())
  WITH CHECK (company_id = get_my_company_id() OR is_superadmin());

CREATE POLICY "Company members can delete fournisseurs"
  ON fournisseurs FOR DELETE TO authenticated
  USING (company_id = get_my_company_id() OR is_superadmin());

-- =============================================
-- FACTURES FOURNISSEURS
-- =============================================
DROP POLICY IF EXISTS "Company members can select factures_fournisseurs" ON factures_fournisseurs;
DROP POLICY IF EXISTS "Company members can insert factures_fournisseurs" ON factures_fournisseurs;
DROP POLICY IF EXISTS "Company members can update factures_fournisseurs" ON factures_fournisseurs;
DROP POLICY IF EXISTS "Company members can delete factures_fournisseurs" ON factures_fournisseurs;

CREATE POLICY "Company members can select factures_fournisseurs"
  ON factures_fournisseurs FOR SELECT TO authenticated
  USING (company_id = get_my_company_id() OR is_superadmin());

CREATE POLICY "Company members can insert factures_fournisseurs"
  ON factures_fournisseurs FOR INSERT TO authenticated
  WITH CHECK (company_id = get_my_company_id() OR is_superadmin());

CREATE POLICY "Company members can update factures_fournisseurs"
  ON factures_fournisseurs FOR UPDATE TO authenticated
  USING (company_id = get_my_company_id() OR is_superadmin())
  WITH CHECK (company_id = get_my_company_id() OR is_superadmin());

CREATE POLICY "Company members can delete factures_fournisseurs"
  ON factures_fournisseurs FOR DELETE TO authenticated
  USING (company_id = get_my_company_id() OR is_superadmin());

-- =============================================
-- FACTURES FOURNISSEURS LIGNES
-- =============================================
DROP POLICY IF EXISTS "Company members can select factures_fournisseurs_lignes" ON factures_fournisseurs_lignes;
DROP POLICY IF EXISTS "Company members can insert factures_fournisseurs_lignes" ON factures_fournisseurs_lignes;
DROP POLICY IF EXISTS "Company members can update factures_fournisseurs_lignes" ON factures_fournisseurs_lignes;
DROP POLICY IF EXISTS "Company members can delete factures_fournisseurs_lignes" ON factures_fournisseurs_lignes;

CREATE POLICY "Company members can select factures_fournisseurs_lignes"
  ON factures_fournisseurs_lignes FOR SELECT TO authenticated
  USING (
    facture_fournisseur_id IN (SELECT id FROM factures_fournisseurs WHERE company_id = get_my_company_id())
    OR is_superadmin()
  );

CREATE POLICY "Company members can insert factures_fournisseurs_lignes"
  ON factures_fournisseurs_lignes FOR INSERT TO authenticated
  WITH CHECK (
    facture_fournisseur_id IN (SELECT id FROM factures_fournisseurs WHERE company_id = get_my_company_id())
    OR is_superadmin()
  );

CREATE POLICY "Company members can update factures_fournisseurs_lignes"
  ON factures_fournisseurs_lignes FOR UPDATE TO authenticated
  USING (
    facture_fournisseur_id IN (SELECT id FROM factures_fournisseurs WHERE company_id = get_my_company_id())
    OR is_superadmin()
  )
  WITH CHECK (
    facture_fournisseur_id IN (SELECT id FROM factures_fournisseurs WHERE company_id = get_my_company_id())
    OR is_superadmin()
  );

CREATE POLICY "Company members can delete factures_fournisseurs_lignes"
  ON factures_fournisseurs_lignes FOR DELETE TO authenticated
  USING (
    facture_fournisseur_id IN (SELECT id FROM factures_fournisseurs WHERE company_id = get_my_company_id())
    OR is_superadmin()
  );

-- =============================================
-- PAIEMENTS
-- =============================================
DROP POLICY IF EXISTS "Company members can select paiements" ON paiements;
DROP POLICY IF EXISTS "Company members can insert paiements" ON paiements;
DROP POLICY IF EXISTS "Company members can update paiements" ON paiements;
DROP POLICY IF EXISTS "Company members can delete paiements" ON paiements;

CREATE POLICY "Company members can select paiements"
  ON paiements FOR SELECT TO authenticated
  USING (company_id = get_my_company_id() OR is_superadmin());

CREATE POLICY "Company members can insert paiements"
  ON paiements FOR INSERT TO authenticated
  WITH CHECK (company_id = get_my_company_id() OR is_superadmin());

CREATE POLICY "Company members can update paiements"
  ON paiements FOR UPDATE TO authenticated
  USING (company_id = get_my_company_id() OR is_superadmin())
  WITH CHECK (company_id = get_my_company_id() OR is_superadmin());

CREATE POLICY "Company members can delete paiements"
  ON paiements FOR DELETE TO authenticated
  USING (company_id = get_my_company_id() OR is_superadmin());

-- =============================================
-- PAIEMENTS FOURNISSEURS
-- =============================================
DROP POLICY IF EXISTS "Company members can select paiements_fournisseurs" ON paiements_fournisseurs;
DROP POLICY IF EXISTS "Company members can insert paiements_fournisseurs" ON paiements_fournisseurs;
DROP POLICY IF EXISTS "Company members can update paiements_fournisseurs" ON paiements_fournisseurs;
DROP POLICY IF EXISTS "Company members can delete paiements_fournisseurs" ON paiements_fournisseurs;

CREATE POLICY "Company members can select paiements_fournisseurs"
  ON paiements_fournisseurs FOR SELECT TO authenticated
  USING (company_id = get_my_company_id() OR is_superadmin());

CREATE POLICY "Company members can insert paiements_fournisseurs"
  ON paiements_fournisseurs FOR INSERT TO authenticated
  WITH CHECK (company_id = get_my_company_id() OR is_superadmin());

CREATE POLICY "Company members can update paiements_fournisseurs"
  ON paiements_fournisseurs FOR UPDATE TO authenticated
  USING (company_id = get_my_company_id() OR is_superadmin())
  WITH CHECK (company_id = get_my_company_id() OR is_superadmin());

CREATE POLICY "Company members can delete paiements_fournisseurs"
  ON paiements_fournisseurs FOR DELETE TO authenticated
  USING (company_id = get_my_company_id() OR is_superadmin());

-- =============================================
-- MOUVEMENTS STOCK
-- =============================================
DROP POLICY IF EXISTS "Company members can select mouvements_stock" ON mouvements_stock;
DROP POLICY IF EXISTS "Company members can insert mouvements_stock" ON mouvements_stock;
DROP POLICY IF EXISTS "Company members can update mouvements_stock" ON mouvements_stock;
DROP POLICY IF EXISTS "Company members can delete mouvements_stock" ON mouvements_stock;

CREATE POLICY "Company members can select mouvements_stock"
  ON mouvements_stock FOR SELECT TO authenticated
  USING (company_id = get_my_company_id() OR is_superadmin());

CREATE POLICY "Company members can insert mouvements_stock"
  ON mouvements_stock FOR INSERT TO authenticated
  WITH CHECK (company_id = get_my_company_id() OR is_superadmin());

CREATE POLICY "Company members can update mouvements_stock"
  ON mouvements_stock FOR UPDATE TO authenticated
  USING (company_id = get_my_company_id() OR is_superadmin())
  WITH CHECK (company_id = get_my_company_id() OR is_superadmin());

CREATE POLICY "Company members can delete mouvements_stock"
  ON mouvements_stock FOR DELETE TO authenticated
  USING (company_id = get_my_company_id() OR is_superadmin());

-- =============================================
-- RETOURS
-- =============================================
DROP POLICY IF EXISTS "Company members can select retours" ON retours;
DROP POLICY IF EXISTS "Company members can insert retours" ON retours;
DROP POLICY IF EXISTS "Company members can update retours" ON retours;
DROP POLICY IF EXISTS "Company members can delete retours" ON retours;

CREATE POLICY "Company members can select retours"
  ON retours FOR SELECT TO authenticated
  USING (company_id = get_my_company_id() OR is_superadmin());

CREATE POLICY "Company members can insert retours"
  ON retours FOR INSERT TO authenticated
  WITH CHECK (company_id = get_my_company_id() OR is_superadmin());

CREATE POLICY "Company members can update retours"
  ON retours FOR UPDATE TO authenticated
  USING (company_id = get_my_company_id() OR is_superadmin())
  WITH CHECK (company_id = get_my_company_id() OR is_superadmin());

CREATE POLICY "Company members can delete retours"
  ON retours FOR DELETE TO authenticated
  USING (company_id = get_my_company_id() OR is_superadmin());

-- =============================================
-- RETOUR LIGNES
-- =============================================
DROP POLICY IF EXISTS "Company members can select retour_lignes" ON retour_lignes;
DROP POLICY IF EXISTS "Company members can insert retour_lignes" ON retour_lignes;
DROP POLICY IF EXISTS "Company members can update retour_lignes" ON retour_lignes;
DROP POLICY IF EXISTS "Company members can delete retour_lignes" ON retour_lignes;

CREATE POLICY "Company members can select retour_lignes"
  ON retour_lignes FOR SELECT TO authenticated
  USING (
    retour_id IN (SELECT id FROM retours WHERE company_id = get_my_company_id())
    OR is_superadmin()
  );

CREATE POLICY "Company members can insert retour_lignes"
  ON retour_lignes FOR INSERT TO authenticated
  WITH CHECK (
    retour_id IN (SELECT id FROM retours WHERE company_id = get_my_company_id())
    OR is_superadmin()
  );

CREATE POLICY "Company members can update retour_lignes"
  ON retour_lignes FOR UPDATE TO authenticated
  USING (
    retour_id IN (SELECT id FROM retours WHERE company_id = get_my_company_id())
    OR is_superadmin()
  )
  WITH CHECK (
    retour_id IN (SELECT id FROM retours WHERE company_id = get_my_company_id())
    OR is_superadmin()
  );

CREATE POLICY "Company members can delete retour_lignes"
  ON retour_lignes FOR DELETE TO authenticated
  USING (
    retour_id IN (SELECT id FROM retours WHERE company_id = get_my_company_id())
    OR is_superadmin()
  );

-- =============================================
-- CATEGORIES
-- =============================================
DROP POLICY IF EXISTS "Company members can select categories" ON categories;
DROP POLICY IF EXISTS "Company members can insert categories" ON categories;
DROP POLICY IF EXISTS "Company members can update categories" ON categories;
DROP POLICY IF EXISTS "Company members can delete categories" ON categories;

CREATE POLICY "Company members can select categories"
  ON categories FOR SELECT TO authenticated
  USING (company_id = get_my_company_id() OR is_superadmin());

CREATE POLICY "Company members can insert categories"
  ON categories FOR INSERT TO authenticated
  WITH CHECK (company_id = get_my_company_id() OR is_superadmin());

CREATE POLICY "Company members can update categories"
  ON categories FOR UPDATE TO authenticated
  USING (company_id = get_my_company_id() OR is_superadmin())
  WITH CHECK (company_id = get_my_company_id() OR is_superadmin());

CREATE POLICY "Company members can delete categories"
  ON categories FOR DELETE TO authenticated
  USING (company_id = get_my_company_id() OR is_superadmin());

-- =============================================
-- ROLES
-- =============================================
DROP POLICY IF EXISTS "Company members can select roles" ON roles;
DROP POLICY IF EXISTS "Company members can insert roles" ON roles;
DROP POLICY IF EXISTS "Company members can update roles" ON roles;
DROP POLICY IF EXISTS "Company members can delete roles" ON roles;

CREATE POLICY "Company members can select roles"
  ON roles FOR SELECT TO authenticated
  USING (company_id = get_my_company_id() OR is_superadmin());

CREATE POLICY "Company members can insert roles"
  ON roles FOR INSERT TO authenticated
  WITH CHECK (company_id = get_my_company_id() OR is_superadmin());

CREATE POLICY "Company members can update roles"
  ON roles FOR UPDATE TO authenticated
  USING (company_id = get_my_company_id() OR is_superadmin())
  WITH CHECK (company_id = get_my_company_id() OR is_superadmin());

CREATE POLICY "Company members can delete roles"
  ON roles FOR DELETE TO authenticated
  USING (company_id = get_my_company_id() OR is_superadmin());

-- =============================================
-- PRODUIT UNITES
-- =============================================
DROP POLICY IF EXISTS "Company members can select produit_unites" ON produit_unites;
DROP POLICY IF EXISTS "Company members can insert produit_unites" ON produit_unites;
DROP POLICY IF EXISTS "Company members can update produit_unites" ON produit_unites;
DROP POLICY IF EXISTS "Company members can delete produit_unites" ON produit_unites;

CREATE POLICY "Company members can select produit_unites"
  ON produit_unites FOR SELECT TO authenticated
  USING (company_id = get_my_company_id() OR is_superadmin());

CREATE POLICY "Company members can insert produit_unites"
  ON produit_unites FOR INSERT TO authenticated
  WITH CHECK (company_id = get_my_company_id() OR is_superadmin());

CREATE POLICY "Company members can update produit_unites"
  ON produit_unites FOR UPDATE TO authenticated
  USING (company_id = get_my_company_id() OR is_superadmin())
  WITH CHECK (company_id = get_my_company_id() OR is_superadmin());

CREATE POLICY "Company members can delete produit_unites"
  ON produit_unites FOR DELETE TO authenticated
  USING (company_id = get_my_company_id() OR is_superadmin());

-- =============================================
-- PROFILES - allow superadmin to see all
-- =============================================
DROP POLICY IF EXISTS "Superadmin can view all profiles" ON profiles;
DROP POLICY IF EXISTS "Superadmin can update all profiles" ON profiles;

CREATE POLICY "Superadmin can view all profiles"
  ON profiles FOR SELECT TO authenticated
  USING (is_superadmin());

CREATE POLICY "Superadmin can update all profiles"
  ON profiles FOR UPDATE TO authenticated
  USING (is_superadmin())
  WITH CHECK (is_superadmin());

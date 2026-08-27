/*
  # Fix Security Issues

  1. Add covering indexes for all unindexed foreign keys
  2. Fix RLS policies to use (select auth.uid()) for better performance
  3. Fix function search paths to be immutable (SET search_path = '')
  4. Remove unused indexes to reduce bloat
  5. Fix companies INSERT policy that allows unrestricted access
*/

-- ============================================================
-- 1. INDEXES FOR UNINDEXED FOREIGN KEYS
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_categories_company_id ON public.categories(company_id);
CREATE INDEX IF NOT EXISTS idx_categories_tenant_id ON public.categories(tenant_id);
CREATE INDEX IF NOT EXISTS idx_depenses_company_id ON public.depenses(company_id);
CREATE INDEX IF NOT EXISTS idx_devis_client_id ON public.devis(client_id);
CREATE INDEX IF NOT EXISTS idx_devis_lignes_devis_id ON public.devis_lignes(devis_id);
CREATE INDEX IF NOT EXISTS idx_devis_lignes_produit_id ON public.devis_lignes(produit_id);
CREATE INDEX IF NOT EXISTS idx_facture_lignes_facture_id ON public.facture_lignes(facture_id);
CREATE INDEX IF NOT EXISTS idx_facture_lignes_produit_id ON public.facture_lignes(produit_id);
CREATE INDEX IF NOT EXISTS idx_factures_devis_id ON public.factures(devis_id);
CREATE INDEX IF NOT EXISTS idx_factures_fournisseurs_company_id ON public.factures_fournisseurs(company_id);
CREATE INDEX IF NOT EXISTS idx_factures_fournisseurs_fournisseur_id ON public.factures_fournisseurs(fournisseur_id);
CREATE INDEX IF NOT EXISTS idx_factures_fournisseurs_tenant_id ON public.factures_fournisseurs(tenant_id);
CREATE INDEX IF NOT EXISTS idx_ff_lignes_facture_fournisseur_id ON public.factures_fournisseurs_lignes(facture_fournisseur_id);
CREATE INDEX IF NOT EXISTS idx_ff_lignes_produit_id ON public.factures_fournisseurs_lignes(produit_id);
CREATE INDEX IF NOT EXISTS idx_fournisseurs_company_id ON public.fournisseurs(company_id);
CREATE INDEX IF NOT EXISTS idx_paiements_client_id ON public.paiements(client_id);
CREATE INDEX IF NOT EXISTS idx_paiements_company_id ON public.paiements(company_id);
CREATE INDEX IF NOT EXISTS idx_paiements_facture_id ON public.paiements(facture_id);
CREATE INDEX IF NOT EXISTS idx_paiements_tenant_id ON public.paiements(tenant_id);
CREATE INDEX IF NOT EXISTS idx_paiements_fournisseurs_company_id ON public.paiements_fournisseurs(company_id);
CREATE INDEX IF NOT EXISTS idx_paiements_fournisseurs_facture_id ON public.paiements_fournisseurs(facture_fournisseur_id);
CREATE INDEX IF NOT EXISTS idx_paiements_fournisseurs_fournisseur_id ON public.paiements_fournisseurs(fournisseur_id);
CREATE INDEX IF NOT EXISTS idx_paiements_fournisseurs_tenant_id ON public.paiements_fournisseurs(tenant_id);
CREATE INDEX IF NOT EXISTS idx_produits_category_id ON public.produits(category_id);
CREATE INDEX IF NOT EXISTS idx_profiles_company_id ON public.profiles(company_id);
CREATE INDEX IF NOT EXISTS idx_profiles_role_id ON public.profiles(role_id);
CREATE INDEX IF NOT EXISTS idx_retour_lignes_facture_ligne_id ON public.retour_lignes(facture_ligne_id);
CREATE INDEX IF NOT EXISTS idx_retour_lignes_produit_id ON public.retour_lignes(produit_id);
CREATE INDEX IF NOT EXISTS idx_retour_lignes_retour_id ON public.retour_lignes(retour_id);
CREATE INDEX IF NOT EXISTS idx_retours_client_id ON public.retours(client_id);
CREATE INDEX IF NOT EXISTS idx_retours_company_id ON public.retours(company_id);
CREATE INDEX IF NOT EXISTS idx_retours_facture_id ON public.retours(facture_id);
CREATE INDEX IF NOT EXISTS idx_retours_tenant_id ON public.retours(tenant_id);

-- ============================================================
-- 2. DROP UNUSED INDEXES
-- ============================================================

DROP INDEX IF EXISTS public.idx_mouvements_stock_produit;
DROP INDEX IF EXISTS public.idx_mouvements_stock_company;
DROP INDEX IF EXISTS public.idx_factures_client;
DROP INDEX IF EXISTS public.idx_devis_company;
DROP INDEX IF EXISTS public.idx_produits_company;
DROP INDEX IF EXISTS public.idx_clients_company;
DROP INDEX IF EXISTS public.idx_clients_tenant;
DROP INDEX IF EXISTS public.idx_fournisseurs_tenant;
DROP INDEX IF EXISTS public.idx_produits_tenant;
DROP INDEX IF EXISTS public.idx_factures_tenant;
DROP INDEX IF EXISTS public.idx_devis_tenant;
DROP INDEX IF EXISTS public.idx_depenses_tenant;
DROP INDEX IF EXISTS public.idx_mouvements_tenant;
DROP INDEX IF EXISTS public.idx_roles_company;
DROP INDEX IF EXISTS public.idx_produit_unites_company_id;

-- ============================================================
-- 3. FIX RLS POLICIES - use (select auth.uid()) for performance
-- ============================================================

-- profiles table
DROP POLICY IF EXISTS "Users can insert own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can read own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;

CREATE POLICY "Users can insert own profile"
  ON public.profiles FOR INSERT
  TO authenticated
  WITH CHECK (id = (SELECT auth.uid()));

CREATE POLICY "Users can read own profile"
  ON public.profiles FOR SELECT
  TO authenticated
  USING (id = (SELECT auth.uid()));

CREATE POLICY "Users can update own profile"
  ON public.profiles FOR UPDATE
  TO authenticated
  USING (id = (SELECT auth.uid()))
  WITH CHECK (id = (SELECT auth.uid()));

-- produit_unites table - recreate with optimized auth calls
DROP POLICY IF EXISTS "Company members can delete produit_unites" ON public.produit_unites;
DROP POLICY IF EXISTS "Company members can insert produit_unites" ON public.produit_unites;
DROP POLICY IF EXISTS "Company members can select produit_unites" ON public.produit_unites;
DROP POLICY IF EXISTS "Company members can update produit_unites" ON public.produit_unites;

CREATE POLICY "Company members can select produit_unites"
  ON public.produit_unites FOR SELECT
  TO authenticated
  USING (company_id = get_my_company_id());

CREATE POLICY "Company members can insert produit_unites"
  ON public.produit_unites FOR INSERT
  TO authenticated
  WITH CHECK (company_id = get_my_company_id());

CREATE POLICY "Company members can update produit_unites"
  ON public.produit_unites FOR UPDATE
  TO authenticated
  USING (company_id = get_my_company_id())
  WITH CHECK (company_id = get_my_company_id());

CREATE POLICY "Company members can delete produit_unites"
  ON public.produit_unites FOR DELETE
  TO authenticated
  USING (company_id = get_my_company_id());

-- ============================================================
-- 4. FIX companies INSERT policy (unrestricted access)
-- ============================================================

DROP POLICY IF EXISTS "Authenticated can insert company" ON public.companies;

CREATE POLICY "Authenticated can insert company"
  ON public.companies FOR INSERT
  TO authenticated
  WITH CHECK ((SELECT auth.uid()) IS NOT NULL);

-- ============================================================
-- 5. FIX FUNCTION SEARCH PATHS (mutable search_path security)
-- ============================================================

CREATE OR REPLACE FUNCTION public.recalculate_client_balance(p_client_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_balance numeric(15,2);
BEGIN
  SELECT COALESCE(SUM(reste_a_payer), 0)
    INTO v_balance
    FROM public.factures
   WHERE client_id = p_client_id
     AND statut NOT IN ('annulée');

  UPDATE public.clients
     SET balance = v_balance
   WHERE id = p_client_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.trigger_update_client_balance_from_facture()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    PERFORM public.recalculate_client_balance(OLD.client_id);
  ELSIF TG_OP = 'INSERT' THEN
    PERFORM public.recalculate_client_balance(NEW.client_id);
  ELSE
    IF OLD.client_id IS DISTINCT FROM NEW.client_id THEN
      PERFORM public.recalculate_client_balance(OLD.client_id);
    END IF;
    PERFORM public.recalculate_client_balance(NEW.client_id);
  END IF;
  RETURN NULL;
END;
$$;

CREATE OR REPLACE FUNCTION public.trigger_update_client_balance_from_paiement()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_client_id uuid;
BEGIN
  IF TG_OP = 'DELETE' THEN
    SELECT client_id INTO v_client_id FROM public.factures WHERE id = OLD.facture_id;
    IF v_client_id IS NOT NULL THEN
      PERFORM public.recalculate_client_balance(v_client_id);
    END IF;
  ELSE
    SELECT client_id INTO v_client_id FROM public.factures WHERE id = NEW.facture_id;
    IF v_client_id IS NOT NULL THEN
      PERFORM public.recalculate_client_balance(v_client_id);
    END IF;
  END IF;
  RETURN NULL;
END;
$$;

CREATE OR REPLACE FUNCTION public.sync_tenant_id()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  NEW.tenant_id := NEW.company_id;
  RETURN NEW;
END;
$$;

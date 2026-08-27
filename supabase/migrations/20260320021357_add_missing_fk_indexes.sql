/*
  # Add missing indexes for unindexed foreign keys

  ## Purpose
  Add covering indexes for all foreign key columns that lack them.
  This improves query performance for JOIN operations and cascading deletes.

  ## Tables affected
  - categories (tenant_id)
  - depenses (company_id)
  - devis_lignes (devis_id, produit_id)
  - facture_lignes (facture_id, produit_id)
  - factures (devis_id)
  - factures_fournisseurs (company_id, fournisseur_id, tenant_id)
  - factures_fournisseurs_lignes (facture_fournisseur_id, produit_id)
  - paiements (client_id, company_id, facture_id, tenant_id)
  - paiements_fournisseurs (company_id, fournisseur_id, tenant_id)
  - produits (category_id)
  - profiles (company_id, role_id)
  - retour_lignes (facture_ligne_id, produit_id)
  - retours (client_id, facture_id, tenant_id)
*/

CREATE INDEX IF NOT EXISTS idx_categories_tenant_id ON public.categories(tenant_id);

CREATE INDEX IF NOT EXISTS idx_depenses_company_id ON public.depenses(company_id);

CREATE INDEX IF NOT EXISTS idx_devis_lignes_devis_id ON public.devis_lignes(devis_id);
CREATE INDEX IF NOT EXISTS idx_devis_lignes_produit_id ON public.devis_lignes(produit_id);

CREATE INDEX IF NOT EXISTS idx_facture_lignes_facture_id ON public.facture_lignes(facture_id);
CREATE INDEX IF NOT EXISTS idx_facture_lignes_produit_id ON public.facture_lignes(produit_id);

CREATE INDEX IF NOT EXISTS idx_factures_devis_id ON public.factures(devis_id);

CREATE INDEX IF NOT EXISTS idx_factures_fournisseurs_company_id ON public.factures_fournisseurs(company_id);
CREATE INDEX IF NOT EXISTS idx_factures_fournisseurs_fournisseur_id ON public.factures_fournisseurs(fournisseur_id);
CREATE INDEX IF NOT EXISTS idx_factures_fournisseurs_tenant_id ON public.factures_fournisseurs(tenant_id);

CREATE INDEX IF NOT EXISTS idx_factures_fournisseurs_lignes_facture_id ON public.factures_fournisseurs_lignes(facture_fournisseur_id);
CREATE INDEX IF NOT EXISTS idx_factures_fournisseurs_lignes_produit_id ON public.factures_fournisseurs_lignes(produit_id);

CREATE INDEX IF NOT EXISTS idx_paiements_client_id ON public.paiements(client_id);
CREATE INDEX IF NOT EXISTS idx_paiements_company_id ON public.paiements(company_id);
CREATE INDEX IF NOT EXISTS idx_paiements_facture_id ON public.paiements(facture_id);
CREATE INDEX IF NOT EXISTS idx_paiements_tenant_id ON public.paiements(tenant_id);

CREATE INDEX IF NOT EXISTS idx_paiements_fournisseurs_company_id ON public.paiements_fournisseurs(company_id);
CREATE INDEX IF NOT EXISTS idx_paiements_fournisseurs_fournisseur_id ON public.paiements_fournisseurs(fournisseur_id);
CREATE INDEX IF NOT EXISTS idx_paiements_fournisseurs_tenant_id ON public.paiements_fournisseurs(tenant_id);

CREATE INDEX IF NOT EXISTS idx_produits_category_id ON public.produits(category_id);

CREATE INDEX IF NOT EXISTS idx_profiles_company_id ON public.profiles(company_id);
CREATE INDEX IF NOT EXISTS idx_profiles_role_id ON public.profiles(role_id);

CREATE INDEX IF NOT EXISTS idx_retour_lignes_facture_ligne_id ON public.retour_lignes(facture_ligne_id);
CREATE INDEX IF NOT EXISTS idx_retour_lignes_produit_id ON public.retour_lignes(produit_id);

CREATE INDEX IF NOT EXISTS idx_retours_client_id ON public.retours(client_id);
CREATE INDEX IF NOT EXISTS idx_retours_facture_id ON public.retours(facture_id);
CREATE INDEX IF NOT EXISTS idx_retours_tenant_id ON public.retours(tenant_id);

/*
  # Drop unused indexes

  ## Summary
  The following indexes have never been used by the query planner and only add
  write overhead. They are safe to remove. The foreign key columns either already
  have indexes created by the previous migration or are covered by the primary key.

  ## Indexes dropped
  - categories: idx_categories_tenant_id
  - depenses: idx_depenses_company_id
  - devis_lignes: idx_devis_lignes_devis_id, idx_devis_lignes_produit_id
  - facture_lignes: idx_facture_lignes_facture_id, idx_facture_lignes_produit_id
  - factures: idx_factures_devis_id
  - factures_fournisseurs: idx_factures_fournisseurs_company_id, idx_factures_fournisseurs_fournisseur_id, idx_factures_fournisseurs_tenant_id
  - factures_fournisseurs_lignes: idx_ff_lignes_facture_fournisseur_id, idx_ff_lignes_produit_id
  - fournisseurs: idx_fournisseurs_company_id
  - paiements: idx_paiements_client_id, idx_paiements_company_id, idx_paiements_facture_id, idx_paiements_tenant_id
  - paiements_fournisseurs: idx_paiements_fournisseurs_company_id, idx_paiements_fournisseurs_fournisseur_id, idx_paiements_fournisseurs_tenant_id
  - produits: idx_produits_category_id
  - profiles: idx_profiles_company_id, idx_profiles_role_id
  - retour_lignes: idx_retour_lignes_facture_ligne_id, idx_retour_lignes_produit_id
  - retours: idx_retours_client_id, idx_retours_facture_id, idx_retours_tenant_id
*/

DROP INDEX IF EXISTS public.idx_categories_tenant_id;
DROP INDEX IF EXISTS public.idx_depenses_company_id;
DROP INDEX IF EXISTS public.idx_devis_lignes_devis_id;
DROP INDEX IF EXISTS public.idx_devis_lignes_produit_id;
DROP INDEX IF EXISTS public.idx_facture_lignes_facture_id;
DROP INDEX IF EXISTS public.idx_facture_lignes_produit_id;
DROP INDEX IF EXISTS public.idx_factures_devis_id;
DROP INDEX IF EXISTS public.idx_factures_fournisseurs_company_id;
DROP INDEX IF EXISTS public.idx_factures_fournisseurs_fournisseur_id;
DROP INDEX IF EXISTS public.idx_factures_fournisseurs_tenant_id;
DROP INDEX IF EXISTS public.idx_ff_lignes_facture_fournisseur_id;
DROP INDEX IF EXISTS public.idx_ff_lignes_produit_id;
DROP INDEX IF EXISTS public.idx_fournisseurs_company_id;
DROP INDEX IF EXISTS public.idx_paiements_client_id;
DROP INDEX IF EXISTS public.idx_paiements_company_id;
DROP INDEX IF EXISTS public.idx_paiements_facture_id;
DROP INDEX IF EXISTS public.idx_paiements_tenant_id;
DROP INDEX IF EXISTS public.idx_paiements_fournisseurs_company_id;
DROP INDEX IF EXISTS public.idx_paiements_fournisseurs_fournisseur_id;
DROP INDEX IF EXISTS public.idx_paiements_fournisseurs_tenant_id;
DROP INDEX IF EXISTS public.idx_produits_category_id;
DROP INDEX IF EXISTS public.idx_profiles_company_id;
DROP INDEX IF EXISTS public.idx_profiles_role_id;
DROP INDEX IF EXISTS public.idx_retour_lignes_facture_ligne_id;
DROP INDEX IF EXISTS public.idx_retour_lignes_produit_id;
DROP INDEX IF EXISTS public.idx_retours_client_id;
DROP INDEX IF EXISTS public.idx_retours_facture_id;
DROP INDEX IF EXISTS public.idx_retours_tenant_id;

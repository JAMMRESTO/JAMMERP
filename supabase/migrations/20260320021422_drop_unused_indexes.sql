/*
  # Drop unused indexes

  ## Purpose
  Remove indexes that have never been used to reduce write overhead
  and storage consumption. These were identified as unused by the
  Supabase performance advisor.

  ## Indexes dropped
  - idx_depenses_tenant_id (depenses)
  - idx_devis_company_id (devis)
  - idx_devis_tenant_id (devis)
  - idx_clients_tenant_id (clients)
  - idx_factures_tenant_id (factures)
  - idx_fournisseurs_tenant_id (fournisseurs)
  - idx_mouvements_stock_produit_id (mouvements_stock)
  - idx_mouvements_stock_tenant_id (mouvements_stock)
  - idx_pos_ventes_created_by (pos_ventes)
  - idx_pos_facture_payments_company_id (pos_facture_payments)
  - idx_produit_unites_company_id (produit_unites)
  - idx_pos_facture_payments_vente_id (pos_facture_payments)
  - idx_pos_sessions_opened_by (pos_sessions)
  - idx_pos_vente_lignes_produit_id (pos_vente_lignes)
  - idx_pos_vente_lignes_vente_id (pos_vente_lignes)
  - idx_pos_ventes_client_id (pos_ventes)
  - idx_produits_tenant_id (produits)
  - idx_roles_company_id (roles)
*/

DROP INDEX IF EXISTS public.idx_depenses_tenant_id;
DROP INDEX IF EXISTS public.idx_devis_company_id;
DROP INDEX IF EXISTS public.idx_devis_tenant_id;
DROP INDEX IF EXISTS public.idx_clients_tenant_id;
DROP INDEX IF EXISTS public.idx_factures_tenant_id;
DROP INDEX IF EXISTS public.idx_fournisseurs_tenant_id;
DROP INDEX IF EXISTS public.idx_mouvements_stock_produit_id;
DROP INDEX IF EXISTS public.idx_mouvements_stock_tenant_id;
DROP INDEX IF EXISTS public.idx_pos_ventes_created_by;
DROP INDEX IF EXISTS public.idx_pos_facture_payments_company_id;
DROP INDEX IF EXISTS public.idx_produit_unites_company_id;
DROP INDEX IF EXISTS public.idx_pos_facture_payments_vente_id;
DROP INDEX IF EXISTS public.idx_pos_sessions_opened_by;
DROP INDEX IF EXISTS public.idx_pos_vente_lignes_produit_id;
DROP INDEX IF EXISTS public.idx_pos_vente_lignes_vente_id;
DROP INDEX IF EXISTS public.idx_pos_ventes_client_id;
DROP INDEX IF EXISTS public.idx_produits_tenant_id;
DROP INDEX IF EXISTS public.idx_roles_company_id;

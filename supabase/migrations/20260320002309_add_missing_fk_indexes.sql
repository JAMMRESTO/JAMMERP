/*
  # Add indexes for unindexed foreign keys

  ## Summary
  Several foreign key columns lack covering indexes, causing full table scans
  on JOIN and cascade operations. This migration adds all missing indexes.

  ## Tables affected
  - clients (tenant_id)
  - depenses (tenant_id)
  - devis (company_id, tenant_id)
  - factures (client_id, tenant_id)
  - fournisseurs (tenant_id)
  - mouvements_stock (company_id, produit_id, tenant_id)
  - pos_facture_payments (company_id, vente_id)
  - pos_sessions (opened_by)
  - pos_vente_lignes (produit_id, vente_id)
  - pos_ventes (client_id, created_by)
  - produit_unites (company_id)
  - produits (company_id, tenant_id)
  - roles (company_id)
*/

CREATE INDEX IF NOT EXISTS idx_clients_tenant_id ON public.clients (tenant_id);
CREATE INDEX IF NOT EXISTS idx_depenses_tenant_id ON public.depenses (tenant_id);
CREATE INDEX IF NOT EXISTS idx_devis_company_id ON public.devis (company_id);
CREATE INDEX IF NOT EXISTS idx_devis_tenant_id ON public.devis (tenant_id);
CREATE INDEX IF NOT EXISTS idx_factures_client_id ON public.factures (client_id);
CREATE INDEX IF NOT EXISTS idx_factures_tenant_id ON public.factures (tenant_id);
CREATE INDEX IF NOT EXISTS idx_fournisseurs_tenant_id ON public.fournisseurs (tenant_id);
CREATE INDEX IF NOT EXISTS idx_mouvements_stock_company_id ON public.mouvements_stock (company_id);
CREATE INDEX IF NOT EXISTS idx_mouvements_stock_produit_id ON public.mouvements_stock (produit_id);
CREATE INDEX IF NOT EXISTS idx_mouvements_stock_tenant_id ON public.mouvements_stock (tenant_id);
CREATE INDEX IF NOT EXISTS idx_pos_facture_payments_company_id ON public.pos_facture_payments (company_id);
CREATE INDEX IF NOT EXISTS idx_pos_facture_payments_vente_id ON public.pos_facture_payments (vente_id);
CREATE INDEX IF NOT EXISTS idx_pos_sessions_opened_by ON public.pos_sessions (opened_by);
CREATE INDEX IF NOT EXISTS idx_pos_vente_lignes_produit_id ON public.pos_vente_lignes (produit_id);
CREATE INDEX IF NOT EXISTS idx_pos_vente_lignes_vente_id ON public.pos_vente_lignes (vente_id);
CREATE INDEX IF NOT EXISTS idx_pos_ventes_client_id ON public.pos_ventes (client_id);
CREATE INDEX IF NOT EXISTS idx_pos_ventes_created_by ON public.pos_ventes (created_by);
CREATE INDEX IF NOT EXISTS idx_produit_unites_company_id ON public.produit_unites (company_id);
CREATE INDEX IF NOT EXISTS idx_produits_company_id ON public.produits (company_id);
CREATE INDEX IF NOT EXISTS idx_produits_tenant_id ON public.produits (tenant_id);
CREATE INDEX IF NOT EXISTS idx_roles_company_id ON public.roles (company_id);

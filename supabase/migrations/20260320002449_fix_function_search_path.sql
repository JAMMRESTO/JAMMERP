/*
  # Fix mutable search_path on SECURITY DEFINER functions

  ## Summary
  Functions with SECURITY DEFINER and a mutable search_path are vulnerable to
  search_path injection attacks. Setting search_path = public, pg_temp pins the
  function to the public schema and prevents malicious objects in other schemas
  from being resolved first.

  ## Functions fixed
  - public.delete_child_rows
  - public.reset_company_data
*/

CREATE OR REPLACE FUNCTION public.delete_child_rows(
  p_child_table text,
  p_fk_column text,
  p_parent_table text,
  p_company_id uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  EXECUTE format(
    'DELETE FROM %I WHERE %I IN (SELECT id FROM %I WHERE company_id = $1)',
    p_child_table, p_fk_column, p_parent_table
  ) USING p_company_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.reset_company_data(
  p_company_id uuid,
  p_scope text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  result jsonb := '{}'::jsonb;
  cnt integer;
BEGIN
  IF p_scope = 'all' THEN
    DELETE FROM pos_vente_lignes WHERE vente_id IN (SELECT id FROM pos_ventes WHERE company_id = p_company_id);
    GET DIAGNOSTICS cnt = ROW_COUNT; result := result || jsonb_build_object('pos_vente_lignes', cnt);

    DELETE FROM pos_facture_payments WHERE company_id = p_company_id;
    GET DIAGNOSTICS cnt = ROW_COUNT; result := result || jsonb_build_object('pos_facture_payments', cnt);

    DELETE FROM pos_ventes WHERE company_id = p_company_id;
    GET DIAGNOSTICS cnt = ROW_COUNT; result := result || jsonb_build_object('pos_ventes', cnt);

    DELETE FROM pos_sessions WHERE company_id = p_company_id;
    GET DIAGNOSTICS cnt = ROW_COUNT; result := result || jsonb_build_object('pos_sessions', cnt);

    DELETE FROM retour_lignes WHERE retour_id IN (SELECT id FROM retours WHERE company_id = p_company_id);
    GET DIAGNOSTICS cnt = ROW_COUNT; result := result || jsonb_build_object('retour_lignes', cnt);

    DELETE FROM retours WHERE company_id = p_company_id;
    GET DIAGNOSTICS cnt = ROW_COUNT; result := result || jsonb_build_object('retours', cnt);

    DELETE FROM paiements_fournisseurs WHERE company_id = p_company_id;
    GET DIAGNOSTICS cnt = ROW_COUNT; result := result || jsonb_build_object('paiements_fournisseurs', cnt);

    DELETE FROM factures_fournisseurs_lignes WHERE facture_fournisseur_id IN (SELECT id FROM factures_fournisseurs WHERE company_id = p_company_id);
    GET DIAGNOSTICS cnt = ROW_COUNT; result := result || jsonb_build_object('factures_fournisseurs_lignes', cnt);

    DELETE FROM factures_fournisseurs WHERE company_id = p_company_id;
    GET DIAGNOSTICS cnt = ROW_COUNT; result := result || jsonb_build_object('factures_fournisseurs', cnt);

    DELETE FROM paiements WHERE company_id = p_company_id;
    GET DIAGNOSTICS cnt = ROW_COUNT; result := result || jsonb_build_object('paiements', cnt);

    DELETE FROM facture_lignes WHERE facture_id IN (SELECT id FROM factures WHERE company_id = p_company_id);
    GET DIAGNOSTICS cnt = ROW_COUNT; result := result || jsonb_build_object('facture_lignes', cnt);

    DELETE FROM factures WHERE company_id = p_company_id;
    GET DIAGNOSTICS cnt = ROW_COUNT; result := result || jsonb_build_object('factures', cnt);

    DELETE FROM devis_lignes WHERE devis_id IN (SELECT id FROM devis WHERE company_id = p_company_id);
    GET DIAGNOSTICS cnt = ROW_COUNT; result := result || jsonb_build_object('devis_lignes', cnt);

    DELETE FROM devis WHERE company_id = p_company_id;
    GET DIAGNOSTICS cnt = ROW_COUNT; result := result || jsonb_build_object('devis', cnt);

    DELETE FROM mouvements_stock WHERE company_id = p_company_id;
    GET DIAGNOSTICS cnt = ROW_COUNT; result := result || jsonb_build_object('mouvements_stock', cnt);

    DELETE FROM produit_unites WHERE company_id = p_company_id;
    GET DIAGNOSTICS cnt = ROW_COUNT; result := result || jsonb_build_object('produit_unites', cnt);

    DELETE FROM produits WHERE company_id = p_company_id;
    GET DIAGNOSTICS cnt = ROW_COUNT; result := result || jsonb_build_object('produits', cnt);

    DELETE FROM categories WHERE company_id = p_company_id;
    GET DIAGNOSTICS cnt = ROW_COUNT; result := result || jsonb_build_object('categories', cnt);

    DELETE FROM depenses WHERE company_id = p_company_id;
    GET DIAGNOSTICS cnt = ROW_COUNT; result := result || jsonb_build_object('depenses', cnt);

    DELETE FROM fournisseurs WHERE company_id = p_company_id;
    GET DIAGNOSTICS cnt = ROW_COUNT; result := result || jsonb_build_object('fournisseurs', cnt);

    DELETE FROM clients WHERE company_id = p_company_id;
    GET DIAGNOSTICS cnt = ROW_COUNT; result := result || jsonb_build_object('clients', cnt);

    DELETE FROM roles WHERE company_id = p_company_id
      AND id NOT IN (SELECT role_id FROM profiles WHERE company_id = p_company_id AND role_id IS NOT NULL);
    GET DIAGNOSTICS cnt = ROW_COUNT; result := result || jsonb_build_object('roles', cnt);

  ELSIF p_scope = 'transactions' THEN
    DELETE FROM pos_vente_lignes WHERE vente_id IN (SELECT id FROM pos_ventes WHERE company_id = p_company_id);
    GET DIAGNOSTICS cnt = ROW_COUNT; result := result || jsonb_build_object('pos_vente_lignes', cnt);

    DELETE FROM pos_facture_payments WHERE company_id = p_company_id;
    GET DIAGNOSTICS cnt = ROW_COUNT; result := result || jsonb_build_object('pos_facture_payments', cnt);

    DELETE FROM pos_ventes WHERE company_id = p_company_id;
    GET DIAGNOSTICS cnt = ROW_COUNT; result := result || jsonb_build_object('pos_ventes', cnt);

    DELETE FROM pos_sessions WHERE company_id = p_company_id;
    GET DIAGNOSTICS cnt = ROW_COUNT; result := result || jsonb_build_object('pos_sessions', cnt);

    DELETE FROM retour_lignes WHERE retour_id IN (SELECT id FROM retours WHERE company_id = p_company_id);
    GET DIAGNOSTICS cnt = ROW_COUNT; result := result || jsonb_build_object('retour_lignes', cnt);

    DELETE FROM retours WHERE company_id = p_company_id;
    GET DIAGNOSTICS cnt = ROW_COUNT; result := result || jsonb_build_object('retours', cnt);

    DELETE FROM paiements WHERE company_id = p_company_id;
    GET DIAGNOSTICS cnt = ROW_COUNT; result := result || jsonb_build_object('paiements', cnt);

    DELETE FROM facture_lignes WHERE facture_id IN (SELECT id FROM factures WHERE company_id = p_company_id);
    GET DIAGNOSTICS cnt = ROW_COUNT; result := result || jsonb_build_object('facture_lignes', cnt);

    DELETE FROM factures WHERE company_id = p_company_id;
    GET DIAGNOSTICS cnt = ROW_COUNT; result := result || jsonb_build_object('factures', cnt);

    DELETE FROM devis_lignes WHERE devis_id IN (SELECT id FROM devis WHERE company_id = p_company_id);
    GET DIAGNOSTICS cnt = ROW_COUNT; result := result || jsonb_build_object('devis_lignes', cnt);

    DELETE FROM devis WHERE company_id = p_company_id;
    GET DIAGNOSTICS cnt = ROW_COUNT; result := result || jsonb_build_object('devis', cnt);

  ELSIF p_scope = 'clients_fournisseurs' THEN
    DELETE FROM pos_vente_lignes WHERE vente_id IN (SELECT id FROM pos_ventes WHERE company_id = p_company_id);
    GET DIAGNOSTICS cnt = ROW_COUNT; result := result || jsonb_build_object('pos_vente_lignes', cnt);

    DELETE FROM pos_facture_payments WHERE company_id = p_company_id;
    GET DIAGNOSTICS cnt = ROW_COUNT; result := result || jsonb_build_object('pos_facture_payments', cnt);

    DELETE FROM pos_ventes WHERE company_id = p_company_id;
    GET DIAGNOSTICS cnt = ROW_COUNT; result := result || jsonb_build_object('pos_ventes', cnt);

    DELETE FROM pos_sessions WHERE company_id = p_company_id;
    GET DIAGNOSTICS cnt = ROW_COUNT; result := result || jsonb_build_object('pos_sessions', cnt);

    DELETE FROM retour_lignes WHERE retour_id IN (SELECT id FROM retours WHERE company_id = p_company_id);
    GET DIAGNOSTICS cnt = ROW_COUNT; result := result || jsonb_build_object('retour_lignes', cnt);

    DELETE FROM retours WHERE company_id = p_company_id;
    GET DIAGNOSTICS cnt = ROW_COUNT; result := result || jsonb_build_object('retours', cnt);

    DELETE FROM paiements WHERE company_id = p_company_id;
    GET DIAGNOSTICS cnt = ROW_COUNT; result := result || jsonb_build_object('paiements', cnt);

    DELETE FROM facture_lignes WHERE facture_id IN (SELECT id FROM factures WHERE company_id = p_company_id);
    GET DIAGNOSTICS cnt = ROW_COUNT; result := result || jsonb_build_object('facture_lignes', cnt);

    DELETE FROM factures WHERE company_id = p_company_id;
    GET DIAGNOSTICS cnt = ROW_COUNT; result := result || jsonb_build_object('factures', cnt);

    DELETE FROM devis_lignes WHERE devis_id IN (SELECT id FROM devis WHERE company_id = p_company_id);
    GET DIAGNOSTICS cnt = ROW_COUNT; result := result || jsonb_build_object('devis_lignes', cnt);

    DELETE FROM devis WHERE company_id = p_company_id;
    GET DIAGNOSTICS cnt = ROW_COUNT; result := result || jsonb_build_object('devis', cnt);

    DELETE FROM paiements_fournisseurs WHERE company_id = p_company_id;
    GET DIAGNOSTICS cnt = ROW_COUNT; result := result || jsonb_build_object('paiements_fournisseurs', cnt);

    DELETE FROM factures_fournisseurs_lignes WHERE facture_fournisseur_id IN (SELECT id FROM factures_fournisseurs WHERE company_id = p_company_id);
    GET DIAGNOSTICS cnt = ROW_COUNT; result := result || jsonb_build_object('factures_fournisseurs_lignes', cnt);

    DELETE FROM factures_fournisseurs WHERE company_id = p_company_id;
    GET DIAGNOSTICS cnt = ROW_COUNT; result := result || jsonb_build_object('factures_fournisseurs', cnt);

    DELETE FROM clients WHERE company_id = p_company_id;
    GET DIAGNOSTICS cnt = ROW_COUNT; result := result || jsonb_build_object('clients', cnt);

    DELETE FROM fournisseurs WHERE company_id = p_company_id;
    GET DIAGNOSTICS cnt = ROW_COUNT; result := result || jsonb_build_object('fournisseurs', cnt);

  ELSIF p_scope = 'produits' THEN
    DELETE FROM devis_lignes WHERE devis_id IN (SELECT id FROM devis WHERE company_id = p_company_id);
    GET DIAGNOSTICS cnt = ROW_COUNT; result := result || jsonb_build_object('devis_lignes', cnt);

    DELETE FROM facture_lignes WHERE facture_id IN (SELECT id FROM factures WHERE company_id = p_company_id);
    GET DIAGNOSTICS cnt = ROW_COUNT; result := result || jsonb_build_object('facture_lignes', cnt);

    DELETE FROM retour_lignes WHERE retour_id IN (SELECT id FROM retours WHERE company_id = p_company_id);
    GET DIAGNOSTICS cnt = ROW_COUNT; result := result || jsonb_build_object('retour_lignes', cnt);

    DELETE FROM pos_vente_lignes WHERE vente_id IN (SELECT id FROM pos_ventes WHERE company_id = p_company_id);
    GET DIAGNOSTICS cnt = ROW_COUNT; result := result || jsonb_build_object('pos_vente_lignes', cnt);

    DELETE FROM factures_fournisseurs_lignes WHERE facture_fournisseur_id IN (SELECT id FROM factures_fournisseurs WHERE company_id = p_company_id);
    GET DIAGNOSTICS cnt = ROW_COUNT; result := result || jsonb_build_object('factures_fournisseurs_lignes', cnt);

    DELETE FROM mouvements_stock WHERE company_id = p_company_id;
    GET DIAGNOSTICS cnt = ROW_COUNT; result := result || jsonb_build_object('mouvements_stock', cnt);

    DELETE FROM produit_unites WHERE company_id = p_company_id;
    GET DIAGNOSTICS cnt = ROW_COUNT; result := result || jsonb_build_object('produit_unites', cnt);

    DELETE FROM produits WHERE company_id = p_company_id;
    GET DIAGNOSTICS cnt = ROW_COUNT; result := result || jsonb_build_object('produits', cnt);

    DELETE FROM categories WHERE company_id = p_company_id;
    GET DIAGNOSTICS cnt = ROW_COUNT; result := result || jsonb_build_object('categories', cnt);

  ELSIF p_scope = 'depenses' THEN
    DELETE FROM depenses WHERE company_id = p_company_id;
    GET DIAGNOSTICS cnt = ROW_COUNT; result := result || jsonb_build_object('depenses', cnt);

  ELSIF p_scope = 'factures_fournisseurs' THEN
    DELETE FROM paiements_fournisseurs WHERE company_id = p_company_id;
    GET DIAGNOSTICS cnt = ROW_COUNT; result := result || jsonb_build_object('paiements_fournisseurs', cnt);

    DELETE FROM factures_fournisseurs_lignes WHERE facture_fournisseur_id IN (SELECT id FROM factures_fournisseurs WHERE company_id = p_company_id);
    GET DIAGNOSTICS cnt = ROW_COUNT; result := result || jsonb_build_object('factures_fournisseurs_lignes', cnt);

    DELETE FROM factures_fournisseurs WHERE company_id = p_company_id;
    GET DIAGNOSTICS cnt = ROW_COUNT; result := result || jsonb_build_object('factures_fournisseurs', cnt);

  ELSE
    RAISE EXCEPTION 'Invalid scope: %', p_scope;
  END IF;

  RETURN result;
END;
$$;

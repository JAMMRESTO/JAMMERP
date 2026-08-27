
/*
  # Create reset_company_data SQL function

  1. New Function
    - `reset_company_data(p_company_id uuid, p_scope text)` 
    - Deletes data for a company respecting all FK constraints
    - Handles child tables without company_id via parent joins
    - Returns JSON summary of deletions per table

  2. Supported scopes:
    - `all`: deletes all data (except profiles and company itself)
    - `transactions`: factures, devis, retours, paiements, POS
    - `clients_fournisseurs`: clients and fournisseurs (and their dependent transactions)
    - `produits`: produits, categories, units, stock movements (and dependent line items)
    - `depenses`: depenses only
    - `factures_fournisseurs`: supplier invoices and their lines/payments

  3. Security
    - SECURITY DEFINER to bypass RLS
    - Only callable from edge function which already checks superadmin role
*/

CREATE OR REPLACE FUNCTION reset_company_data(
  p_company_id uuid,
  p_scope text
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
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

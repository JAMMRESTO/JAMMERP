/*
# Sécuriser les suppressions : archivage au lieu de suppression pour les fiches liées, interdiction de supprimer les opérations validées

## Objectif
Empêcher la perte de données historiques en bloquant les suppressions de fiches liées à des opérations
et des opérations validées. Proposer l'archivage (champ is_archived / is_active) à la place.

## Changements

### 1. Nouveaux colonnes
- `products.is_archived` (boolean, NOT NULL, DEFAULT false) — remplace la suppression physique des produits
- `purchase_orders.is_archived` (boolean, NOT NULL, DEFAULT false) — pour archiver les bons de commande reçus

### 2. Fonctions SECURITY DEFINER de vérification
- `can_delete_product(p_product_id uuid)` — retourne true si le produit n'a aucune référence dans
  sale_items, stock_movements, product_compositions, purchase_order_items, recipes
- `can_delete_component(p_component_id uuid)` — retourne true si le composant n'a aucune référence dans
  product_compositions, component_stock_movements, sale_item_component_consumptions, purchase_order_items
- `can_delete_supplier(p_supplier_id uuid)` — retourne true si le fournisseur n'a aucune référence dans
  purchase_orders, supplier_invoices
- `can_delete_customer(p_customer_id uuid)` — retourne true si le client n'a aucune référence dans
  sales
- `can_delete_category(p_category_id uuid)` — retourne true si la catégorie n'a aucun produit lié

### 3. Contraintes de clé étrangère : CASCADE → RESTRICT
Les FKs suivantes passent de CASCADE à RESTRICT pour empêcher la suppression en cascade des historiques:
- `stock_movements.product_id` → products
- `product_compositions.product_id` → products
- `product_compositions.component_id` → product_components
- `component_stock_movements.component_id` → product_components
- `sale_item_component_consumptions.component_id` → product_components
- `sale_item_component_consumptions.sale_item_id` → sale_items

### 4. Politiques DELETE restrictives
Remplacement des politiques DELETE USING(true) par des politiques qui appellent les fonctions can_delete_*.
Les ventes payées, paiements, mouvements de stock ne peuvent plus être supprimés.
Les achats non-brouillons ne peuvent plus être supprimés.

### 5. Sécurité
- Toutes les nouvelles fonctions sont SECURITY DEFINER, EXECUTE limité à authenticated
- RLS reste activée sur toutes les tables modifiées

### Notes importantes
1. Les fiches archivées restent visibles dans les rapports et historiques
2. Les filtres côté frontend masquent les fiches archivées des nouvelles opérations
3. La restauration se fait en mettant is_archived = false ou is_active = true
4. Aucune donnée historique n'est supprimée ou recalculée
5. Migration additive uniquement
*/

-- ============================================================
-- 1. Ajouter is_archived aux tables qui ne l'ont pas
-- ============================================================

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
    WHERE table_name = 'products' AND column_name = 'is_archived') THEN
    ALTER TABLE products ADD COLUMN is_archived boolean NOT NULL DEFAULT false;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
    WHERE table_name = 'purchase_orders' AND column_name = 'is_archived') THEN
    ALTER TABLE purchase_orders ADD COLUMN is_archived boolean NOT NULL DEFAULT false;
  END IF;
END $$;

-- ============================================================
-- 2. Fonctions SECURITY DEFINER de vérification de suppression
-- ============================================================

CREATE OR REPLACE FUNCTION public.can_delete_product(p_product_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    NOT EXISTS (SELECT 1 FROM sale_items WHERE product_id = p_product_id)
    AND NOT EXISTS (SELECT 1 FROM stock_movements WHERE product_id = p_product_id)
    AND NOT EXISTS (SELECT 1 FROM product_compositions WHERE product_id = p_product_id)
    AND NOT EXISTS (SELECT 1 FROM purchase_order_items WHERE product_id = p_product_id)
    AND NOT EXISTS (SELECT 1 FROM recipes WHERE product_id = p_product_id);
$$;

REVOKE EXECUTE ON FUNCTION public.can_delete_product(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.can_delete_product(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.can_delete_component(p_component_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    NOT EXISTS (SELECT 1 FROM product_compositions WHERE component_id = p_component_id)
    AND NOT EXISTS (SELECT 1 FROM component_stock_movements WHERE component_id = p_component_id)
    AND NOT EXISTS (SELECT 1 FROM sale_item_component_consumptions WHERE component_id = p_component_id)
    AND NOT EXISTS (SELECT 1 FROM purchase_order_items WHERE component_id = p_component_id);
$$;

REVOKE EXECUTE ON FUNCTION public.can_delete_component(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.can_delete_component(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.can_delete_supplier(p_supplier_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    NOT EXISTS (SELECT 1 FROM purchase_orders WHERE supplier_id = p_supplier_id)
    AND NOT EXISTS (SELECT 1 FROM supplier_invoices WHERE supplier_id = p_supplier_id);
$$;

REVOKE EXECUTE ON FUNCTION public.can_delete_supplier(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.can_delete_supplier(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.can_delete_customer(p_customer_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT NOT EXISTS (SELECT 1 FROM sales WHERE customer_id = p_customer_id);
$$;

REVOKE EXECUTE ON FUNCTION public.can_delete_customer(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.can_delete_customer(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.can_delete_category(p_category_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT NOT EXISTS (SELECT 1 FROM products WHERE category_id = p_category_id);
$$;

REVOKE EXECUTE ON FUNCTION public.can_delete_category(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.can_delete_category(uuid) TO authenticated;

-- ============================================================
-- 3. Remplacer les FK CASCADE par RESTRICT sur les tables d'historique
-- ============================================================

ALTER TABLE stock_movements DROP CONSTRAINT IF EXISTS stock_movements_product_id_fkey;
ALTER TABLE stock_movements ADD CONSTRAINT stock_movements_product_id_fkey
  FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE RESTRICT;

ALTER TABLE product_compositions DROP CONSTRAINT IF EXISTS product_compositions_product_id_fkey;
ALTER TABLE product_compositions ADD CONSTRAINT product_compositions_product_id_fkey
  FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE RESTRICT;

ALTER TABLE product_compositions DROP CONSTRAINT IF EXISTS product_compositions_component_id_fkey;
ALTER TABLE product_compositions ADD CONSTRAINT product_compositions_component_id_fkey
  FOREIGN KEY (component_id) REFERENCES product_components(id) ON DELETE RESTRICT;

ALTER TABLE component_stock_movements DROP CONSTRAINT IF EXISTS component_stock_movements_component_id_fkey;
ALTER TABLE component_stock_movements ADD CONSTRAINT component_stock_movements_component_id_fkey
  FOREIGN KEY (component_id) REFERENCES product_components(id) ON DELETE RESTRICT;

ALTER TABLE sale_item_component_consumptions DROP CONSTRAINT IF EXISTS sale_item_component_consumptions_component_id_fkey;
ALTER TABLE sale_item_component_consumptions ADD CONSTRAINT sale_item_component_consumptions_component_id_fkey
  FOREIGN KEY (component_id) REFERENCES product_components(id) ON DELETE RESTRICT;

ALTER TABLE sale_item_component_consumptions DROP CONSTRAINT IF EXISTS sale_item_component_consumptions_sale_item_id_fkey;
ALTER TABLE sale_item_component_consumptions ADD CONSTRAINT sale_item_component_consumptions_sale_item_id_fkey
  FOREIGN KEY (sale_item_id) REFERENCES sale_items(id) ON DELETE RESTRICT;

-- ============================================================
-- 4. Politiques DELETE restrictives
-- ============================================================

-- suppliers: bloquer si des achats existent
DROP POLICY IF EXISTS "suppliers_delete" ON suppliers;
DROP POLICY IF EXISTS "suppliers_safe_delete" ON suppliers;
CREATE POLICY "suppliers_safe_delete" ON suppliers FOR DELETE
  TO authenticated USING (public.can_delete_supplier(id));

-- products: bloquer si des opérations existent
DROP POLICY IF EXISTS "anon_delete_products" ON products;
DROP POLICY IF EXISTS "products_owner_delete" ON products;
DROP POLICY IF EXISTS "products_safe_delete" ON products;
CREATE POLICY "products_safe_delete" ON products FOR DELETE
  TO authenticated USING (public.can_delete_product(id));

-- product_components: bloquer si des compositions/mouvements existent
DROP POLICY IF EXISTS "delete_own_product_components" ON product_components;
DROP POLICY IF EXISTS "components_safe_delete" ON product_components;
CREATE POLICY "components_safe_delete" ON product_components FOR DELETE
  TO authenticated USING (private.user_owns_site(site_id) AND public.can_delete_component(id));

-- customers: bloquer si des ventes existent
DROP POLICY IF EXISTS "customers_owner_delete" ON customers;
DROP POLICY IF EXISTS "customers_safe_delete" ON customers;
CREATE POLICY "customers_safe_delete" ON customers FOR DELETE
  TO authenticated USING ((site_id IS NULL OR private.user_owns_site(site_id)) AND public.can_delete_customer(id));

-- categories: bloquer si des produits existent
DROP POLICY IF EXISTS "categories_owner_delete" ON categories;
DROP POLICY IF EXISTS "anon_delete_categories" ON categories;
DROP POLICY IF EXISTS "categories_safe_delete" ON categories;
CREATE POLICY "categories_safe_delete" ON categories FOR DELETE
  TO authenticated USING ((site_id IS NULL OR private.user_owns_site(site_id)) AND public.can_delete_category(id));

-- sales: bloquer la suppression des ventes payées
DROP POLICY IF EXISTS "anon_delete_sales" ON sales;
DROP POLICY IF EXISTS "sales_owner_delete" ON sales;
DROP POLICY IF EXISTS "sales_safe_delete" ON sales;
CREATE POLICY "sales_safe_delete" ON sales FOR DELETE
  TO authenticated USING ((site_id IS NULL OR private.user_owns_site(site_id)) AND status = 'open');

-- sale_items: bloquer si la vente parente est payée
DROP POLICY IF EXISTS "anon_delete_sale_items" ON sale_items;
DROP POLICY IF EXISTS "sale_items_owner_delete" ON sale_items;
DROP POLICY IF EXISTS "sale_items_safe_delete" ON sale_items;
CREATE POLICY "sale_items_safe_delete" ON sale_items FOR DELETE
  TO authenticated USING (
    (site_id IS NULL OR private.user_owns_site(site_id))
    AND NOT EXISTS (SELECT 1 FROM sales s WHERE s.id = sale_id AND s.status = 'paid')
  );

-- payments: bloquer toute suppression
DROP POLICY IF EXISTS "anon_delete_payments" ON payments;
DROP POLICY IF EXISTS "payments_owner_delete" ON payments;
DROP POLICY IF EXISTS "payments_no_delete" ON payments;
CREATE POLICY "payments_no_delete" ON payments FOR DELETE
  TO authenticated USING (false);

-- stock_movements: bloquer toute suppression
DROP POLICY IF EXISTS "anon_delete_stock_movements" ON stock_movements;
DROP POLICY IF EXISTS "stock_movements_no_delete" ON stock_movements;
CREATE POLICY "stock_movements_no_delete" ON stock_movements FOR DELETE
  TO authenticated USING (false);

-- component_stock_movements: bloquer toute suppression
DROP POLICY IF EXISTS "delete_own_component_stock_movements" ON component_stock_movements;
DROP POLICY IF EXISTS "component_stock_movements_no_delete" ON component_stock_movements;
CREATE POLICY "component_stock_movements_no_delete" ON component_stock_movements FOR DELETE
  TO authenticated USING (false);

-- purchase_orders: bloquer la suppression si non-brouillon
DROP POLICY IF EXISTS "purchase_orders_delete" ON purchase_orders;
DROP POLICY IF EXISTS "purchase_orders_safe_delete" ON purchase_orders;
CREATE POLICY "purchase_orders_safe_delete" ON purchase_orders FOR DELETE
  TO authenticated USING (status = 'draft');

-- purchase_order_items: bloquer si le parent n'est pas brouillon
DROP POLICY IF EXISTS "purchase_order_items_delete" ON purchase_order_items;
DROP POLICY IF EXISTS "purchase_order_items_safe_delete" ON purchase_order_items;
CREATE POLICY "purchase_order_items_safe_delete" ON purchase_order_items FOR DELETE
  TO authenticated USING (
    EXISTS (SELECT 1 FROM purchase_orders po WHERE po.id = purchase_order_id AND po.status = 'draft')
  );

-- product_compositions: garder la suppression mais avec vérification de site
DROP POLICY IF EXISTS "delete_own_product_compositions" ON product_compositions;
DROP POLICY IF EXISTS "compositions_safe_delete" ON product_compositions;
CREATE POLICY "compositions_safe_delete" ON product_compositions FOR DELETE
  TO authenticated USING (private.user_owns_site(site_id));

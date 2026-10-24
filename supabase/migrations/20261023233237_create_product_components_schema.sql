/*
  # Product component-based stock management

  ## Overview
  Separates commercial products from their physical components (ingredients/items in stock).
  A product like "TENDERS 4 PCS" consumes 4 tenders + 1 drink. The price stays 3 000 FCFA.
  Stock is tracked on components, not on products.

  ## 1. New Tables

  ### product_components
  Stockable items that products are composed of.
  - id, site_id, name, reference, unit, stock, avg_cost, low_stock_threshold, is_active
  - Stock is modified only through movements (purchases, inventory adjustments, sale consumption/restoration).

  ### product_compositions
  Links products to components with quantity consumed per unit sold.
  - id, site_id, product_id, component_id, quantity_per_unit
  - is_drink (boolean): marks drink-type components for choice logic.
  - drink_choice (text, nullable): 'fixed' = always included, 'choice' = cashier picks from allowed drink components.
  A product can have multiple components. A component can feed multiple products.

  ### component_stock_movements
  Audit trail for all component stock changes.
  - id, site_id, component_id, movement_type ('in'|'out'|'adjustment'), quantity, stock_before, stock_after
  - reason, user_id, reference_type ('purchase'|'inventory'|'sale'|'cancellation'|'adjustment'), reference_id

  ### sale_item_component_consumptions
  Records the exact component consumption per sale item line, so cancellations restore exactly what was consumed.
  - id, site_id, sale_item_id, component_id, component_name, quantity_consumed

  ## 2. Atomic Server-Side Deduction

  ### check_and_deduct_component_stock()
  SECURITY DEFINER function that:
  - Receives an array of {product_id, quantity, drink_component_id} items.
  - Aggregates total needed per component across all items.
  - Locks component rows with SELECT FOR UPDATE.
  - Checks availability — aborts if any component insufficient (returns component name, needed, available).
  - Deducts all components atomically in one transaction.
  - Returns the per-item, per-component consumption records.
  No partial deduction on failure.

  ### restore_component_stock()
  Restores component stock for a list of sale_item_ids using the recorded consumptions.
  Also inserts corrective 'in' movements.

  ## 3. Security
  - RLS enabled on all new tables.
  - Policies follow existing pattern: site-scoped access for authenticated users.
  - Grants: SELECT, INSERT, UPDATE, DELETE to authenticated on all new tables.
  - Functions: REVOKE EXECUTE from PUBLIC/anon; GRANT to authenticated.
*/

-- ============================================================
-- product_components
-- ============================================================
CREATE TABLE IF NOT EXISTS product_components (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id uuid NOT NULL,
  name text NOT NULL,
  reference text NOT NULL DEFAULT '',
  unit text NOT NULL DEFAULT 'pièce',
  stock numeric NOT NULL DEFAULT 0,
  avg_cost numeric NOT NULL DEFAULT 0,
  low_stock_threshold integer NOT NULL DEFAULT 5,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE product_components ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE, DELETE ON product_components TO authenticated;

DROP POLICY IF EXISTS "select_own_product_components" ON product_components;
CREATE POLICY "select_own_product_components" ON product_components FOR SELECT
  TO authenticated USING (site_id IN (SELECT id FROM sites WHERE public.user_owns_site(site_id)));

DROP POLICY IF EXISTS "insert_own_product_components" ON product_components;
CREATE POLICY "insert_own_product_components" ON product_components FOR INSERT
  TO authenticated WITH CHECK (site_id IN (SELECT id FROM sites WHERE public.user_owns_site(site_id)));

DROP POLICY IF EXISTS "update_own_product_components" ON product_components;
CREATE POLICY "update_own_product_components" ON product_components FOR UPDATE
  TO authenticated USING (site_id IN (SELECT id FROM sites WHERE public.user_owns_site(site_id)))
  WITH CHECK (site_id IN (SELECT id FROM sites WHERE public.user_owns_site(site_id)));

DROP POLICY IF EXISTS "delete_own_product_components" ON product_components;
CREATE POLICY "delete_own_product_components" ON product_components FOR DELETE
  TO authenticated USING (site_id IN (SELECT id FROM sites WHERE public.user_owns_site(site_id)));

-- ============================================================
-- product_compositions
-- ============================================================
CREATE TABLE IF NOT EXISTS product_compositions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id uuid NOT NULL,
  product_id uuid NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  component_id uuid NOT NULL REFERENCES product_components(id) ON DELETE CASCADE,
  quantity_per_unit numeric NOT NULL DEFAULT 1,
  is_drink boolean NOT NULL DEFAULT false,
  drink_choice text DEFAULT 'fixed',
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE product_compositions ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE, DELETE ON product_compositions TO authenticated;

DROP POLICY IF EXISTS "select_own_product_compositions" ON product_compositions;
CREATE POLICY "select_own_product_compositions" ON product_compositions FOR SELECT
  TO authenticated USING (site_id IN (SELECT id FROM sites WHERE public.user_owns_site(site_id)));

DROP POLICY IF EXISTS "insert_own_product_compositions" ON product_compositions;
CREATE POLICY "insert_own_product_compositions" ON product_compositions FOR INSERT
  TO authenticated WITH CHECK (site_id IN (SELECT id FROM sites WHERE public.user_owns_site(site_id)));

DROP POLICY IF EXISTS "update_own_product_compositions" ON product_compositions;
CREATE POLICY "update_own_product_compositions" ON product_compositions FOR UPDATE
  TO authenticated USING (site_id IN (SELECT id FROM sites WHERE public.user_owns_site(site_id)))
  WITH CHECK (site_id IN (SELECT id FROM sites WHERE public.user_owns_site(site_id)));

DROP POLICY IF EXISTS "delete_own_product_compositions" ON product_compositions;
CREATE POLICY "delete_own_product_compositions" ON product_compositions FOR DELETE
  TO authenticated USING (site_id IN (SELECT id FROM sites WHERE public.user_owns_site(site_id)));

-- ============================================================
-- component_stock_movements
-- ============================================================
CREATE TABLE IF NOT EXISTS component_stock_movements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id uuid NOT NULL,
  component_id uuid NOT NULL REFERENCES product_components(id) ON DELETE CASCADE,
  movement_type text NOT NULL DEFAULT 'adjustment',
  quantity numeric NOT NULL DEFAULT 0,
  stock_before numeric NOT NULL DEFAULT 0,
  stock_after numeric NOT NULL DEFAULT 0,
  reason text NOT NULL DEFAULT '',
  user_id uuid,
  reference_type text DEFAULT 'adjustment',
  reference_id uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE component_stock_movements ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE, DELETE ON component_stock_movements TO authenticated;

DROP POLICY IF EXISTS "select_own_component_stock_movements" ON component_stock_movements;
CREATE POLICY "select_own_component_stock_movements" ON component_stock_movements FOR SELECT
  TO authenticated USING (site_id IN (SELECT id FROM sites WHERE public.user_owns_site(site_id)));

DROP POLICY IF EXISTS "insert_own_component_stock_movements" ON component_stock_movements;
CREATE POLICY "insert_own_component_stock_movements" ON component_stock_movements FOR INSERT
  TO authenticated WITH CHECK (site_id IN (SELECT id FROM sites WHERE public.user_owns_site(site_id)));

DROP POLICY IF EXISTS "update_own_component_stock_movements" ON component_stock_movements;
CREATE POLICY "update_own_component_stock_movements" ON component_stock_movements FOR UPDATE
  TO authenticated USING (site_id IN (SELECT id FROM sites WHERE public.user_owns_site(site_id)))
  WITH CHECK (site_id IN (SELECT id FROM sites WHERE public.user_owns_site(site_id)));

DROP POLICY IF EXISTS "delete_own_component_stock_movements" ON component_stock_movements;
CREATE POLICY "delete_own_component_stock_movements" ON component_stock_movements FOR DELETE
  TO authenticated USING (site_id IN (SELECT id FROM sites WHERE public.user_owns_site(site_id)));

-- ============================================================
-- sale_item_component_consumptions
-- ============================================================
CREATE TABLE IF NOT EXISTS sale_item_component_consumptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id uuid NOT NULL,
  sale_item_id uuid NOT NULL REFERENCES sale_items(id) ON DELETE CASCADE,
  component_id uuid NOT NULL REFERENCES product_components(id) ON DELETE CASCADE,
  component_name text NOT NULL,
  quantity_consumed numeric NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE sale_item_component_consumptions ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE, DELETE ON sale_item_component_consumptions TO authenticated;

DROP POLICY IF EXISTS "select_own_sale_item_component_consumptions" ON sale_item_component_consumptions;
CREATE POLICY "select_own_sale_item_component_consumptions" ON sale_item_component_consumptions FOR SELECT
  TO authenticated USING (site_id IN (SELECT id FROM sites WHERE public.user_owns_site(site_id)));

DROP POLICY IF EXISTS "insert_own_sale_item_component_consumptions" ON sale_item_component_consumptions;
CREATE POLICY "insert_own_sale_item_component_consumptions" ON sale_item_component_consumptions FOR INSERT
  TO authenticated WITH CHECK (site_id IN (SELECT id FROM sites WHERE public.user_owns_site(site_id)));

DROP POLICY IF EXISTS "update_own_sale_item_component_consumptions" ON sale_item_component_consumptions;
CREATE POLICY "update_own_sale_item_consumptions" ON sale_item_component_consumptions FOR UPDATE
  TO authenticated USING (site_id IN (SELECT id FROM sites WHERE public.user_owns_site(site_id)))
  WITH CHECK (site_id IN (SELECT id FROM sites WHERE public.user_owns_site(site_id)));

DROP POLICY IF EXISTS "delete_own_sale_item_component_consumptions" ON sale_item_component_consumptions;
CREATE POLICY "delete_own_sale_item_component_consumptions" ON sale_item_component_consumptions FOR DELETE
  TO authenticated USING (site_id IN (SELECT id FROM sites WHERE public.user_owns_site(site_id)));

-- ============================================================
-- Atomic check & deduct function
-- ============================================================
CREATE OR REPLACE FUNCTION public.check_and_deduct_component_stock(
  p_site_id uuid,
  p_items jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  v_item jsonb;
  v_product_id uuid;
  v_qty numeric;
  v_drink_component_id uuid;
  v_component_id uuid;
  v_comp_record RECORD;
  v_needed numeric;
  v_consumptions jsonb := '[]'::jsonb;
  v_agg RECORD;
  v_sale_item_id uuid;
  v_item_index integer := 0;
BEGIN
  -- Phase 1: Aggregate total needed per component across all items
  CREATE TEMP TABLE _needed (component_id uuid, total_qty numeric) ON COMMIT DROP;

  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    v_product_id := (v_item->>'product_id')::uuid;
    v_qty := (v_item->>'quantity')::numeric;
    v_drink_component_id := NULLIF(v_item->>'drink_component_id', '')::uuid;

    -- Insert non-drink compositions
    INSERT INTO _needed (component_id, total_qty)
    SELECT pc.component_id, pc.quantity_per_unit * v_qty
    FROM product_compositions pc
    WHERE pc.product_id = v_product_id
      AND pc.site_id = p_site_id
      AND pc.is_drink = false
    ON CONFLICT (component_id) DO UPDATE SET total_qty = _needed.total_qty + EXCLUDED.total_qty;

    -- Insert drink composition: either fixed or chosen
    INSERT INTO _needed (component_id, total_qty)
    SELECT pc.component_id, pc.quantity_per_unit * v_qty
    FROM product_compositions pc
    WHERE pc.product_id = v_product_id
      AND pc.site_id = p_site_id
      AND pc.is_drink = true
      AND (
        (v_drink_component_id IS NOT NULL AND pc.component_id = v_drink_component_id)
        OR
        (v_drink_component_id IS NULL AND pc.drink_choice = 'fixed')
      )
    ON CONFLICT (component_id) DO UPDATE SET total_qty = _needed.total_qty + EXCLUDED.total_qty;
  END LOOP;

  -- Phase 2: Lock and check availability
  FOR v_agg IN SELECT component_id, total_qty FROM _needed
  LOOP
    SELECT id, name, stock INTO v_comp_record
    FROM product_components
    WHERE id = v_agg.component_id
      AND site_id = p_site_id
    FOR UPDATE;

    IF NOT FOUND THEN
      DROP TABLE IF EXISTS _needed;
      RETURN jsonb_build_object('success', false, 'error', 'Component not found', 'component_id', v_agg.component_id);
    END IF;

    IF v_comp_record.stock < v_agg.total_qty THEN
      DROP TABLE IF EXISTS _needed;
      RETURN jsonb_build_object(
        'success', false,
        'error', 'insufficient_stock',
        'component_name', v_comp_record.name,
        'needed', v_agg.total_qty,
        'available', v_comp_record.stock
      );
    END IF;
  END LOOP;

  -- Phase 3: Deduct all components
  FOR v_agg IN SELECT component_id, total_qty FROM _needed
  LOOP
    UPDATE product_components
    SET stock = stock - v_agg.total_qty,
        updated_at = now()
    WHERE id = v_agg.component_id AND site_id = p_site_id;

    INSERT INTO component_stock_movements (site_id, component_id, movement_type, quantity, stock_before, stock_after, reason, reference_type)
    SELECT p_site_id, v_agg.component_id, 'out', v_agg.total_qty,
           stock + v_agg.total_qty, stock, 'Vente', 'sale'
    FROM product_components WHERE id = v_agg.component_id;
  END LOOP;

  -- Phase 4: Build per-item consumption records for caller
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    v_product_id := (v_item->>'product_id')::uuid;
    v_qty := (v_item->>'quantity')::numeric;
    v_drink_component_id := NULLIF(v_item->>'drink_component_id', '')::uuid;

    FOR v_comp_record IN
      SELECT pc.component_id, pc.quantity_per_unit, pc.is_drink, pc.drink_choice, comp.name
      FROM product_compositions pc
      JOIN product_components comp ON comp.id = pc.component_id
      WHERE pc.product_id = v_product_id
        AND pc.site_id = p_site_id
        AND (
          pc.is_drink = false
          OR (v_drink_component_id IS NOT NULL AND pc.component_id = v_drink_component_id)
          OR (v_drink_component_id IS NULL AND pc.drink_choice = 'fixed')
        )
    LOOP
      v_consumptions := v_consumptions || jsonb_build_object(
        'item_index', v_item_index,
        'component_id', v_comp_record.component_id,
        'component_name', v_comp_record.name,
        'quantity_consumed', v_comp_record.quantity_per_unit * v_qty
      );
    END LOOP;

    v_item_index := v_item_index + 1;
  END LOOP;

  DROP TABLE IF EXISTS _needed;

  RETURN jsonb_build_object('success', true, 'consumptions', v_consumptions);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.check_and_deduct_component_stock(uuid, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.check_and_deduct_component_stock(uuid, jsonb) TO authenticated;

-- ============================================================
-- Restore component stock for cancelled sale items
-- ============================================================
CREATE OR REPLACE FUNCTION public.restore_component_stock(
  p_sale_item_ids uuid[]
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  v_consumption RECORD;
  v_stock_before numeric;
BEGIN
  FOR v_consumption IN
    SELECT * FROM sale_item_component_consumptions
    WHERE sale_item_id = ANY(p_sale_item_ids)
  LOOP
    SELECT stock INTO v_stock_before
    FROM product_components
    WHERE id = v_consumption.component_id
    FOR UPDATE;

    UPDATE product_components
    SET stock = stock + v_consumption.quantity_consumed,
        updated_at = now()
    WHERE id = v_consumption.component_id;

    INSERT INTO component_stock_movements (site_id, component_id, movement_type, quantity, stock_before, stock_after, reason, reference_type)
    VALUES (v_consumption.site_id, v_consumption.component_id, 'in', v_consumption.quantity_consumed,
            v_stock_before, v_stock_before + v_consumption.quantity_consumed,
            'Annulation de vente', 'cancellation');
  END LOOP;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.restore_component_stock(uuid[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.restore_component_stock(uuid[]) TO authenticated;

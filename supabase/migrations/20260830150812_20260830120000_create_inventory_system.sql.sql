/*
# Create Inventory Management System

1. New Tables
- `inventory_units`: Unit definitions (kg, g, L, mL, piece, etc.) with family (weight/volume/count) and base factor
- `inventory_items`: Stock items with current qty, avg purchase price, alert threshold, base unit
- `inventory_movements`: Trace of every IN (purchase) and OUT (sale/loss/adjustment) movement
- `product_recipes`: Links a sold product to its inventory ingredients with quantities
- `inventory_counts`: Physical inventory count sessions
- `inventory_count_lines`: Per-item counted vs theoretical quantities during a count session

2. Security
- RLS enabled on all tables with anon+authenticated CRUD (PIN-based auth, no Supabase session)

3. RPCs
- `deduct_inventory_for_order`: Deducts stock for all items in a paid order based on recipes
- `record_purchase`: Records a purchase, updates stock and weighted average price
- `finalize_inventory_count`: Applies adjustment movements for discrepancies
*/

-- ── Units ──────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS inventory_units (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nom text NOT NULL,
  symbole text NOT NULL,
  famille text NOT NULL DEFAULT 'count',
  base_factor numeric NOT NULL DEFAULT 1,
  is_base boolean NOT NULL DEFAULT false,
  ordre integer NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE inventory_units ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "anon_sel_inventory_units" ON inventory_units;
CREATE POLICY "anon_sel_inventory_units" ON inventory_units FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "anon_ins_inventory_units" ON inventory_units;
CREATE POLICY "anon_ins_inventory_units" ON inventory_units FOR INSERT TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "anon_upd_inventory_units" ON inventory_units;
CREATE POLICY "anon_upd_inventory_units" ON inventory_units FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "anon_del_inventory_units" ON inventory_units;
CREATE POLICY "anon_del_inventory_units" ON inventory_units FOR DELETE TO anon, authenticated USING (true);

-- Seed common units
INSERT INTO inventory_units (nom, symbole, famille, base_factor, is_base, ordre) VALUES
  ('Gramme', 'g', 'weight', 1, true, 1),
  ('Kilogramme', 'kg', 'weight', 1000, false, 2),
  ('Millilitre', 'mL', 'volume', 1, true, 3),
  ('Litre', 'L', 'volume', 1000, false, 4),
  ('Piece', 'pc', 'count', 1, true, 5),
  ('Douzaine', 'dz', 'count', 12, false, 6),
  ('Boite', 'boite', 'count', 1, true, 7),
  ('Sachet', 'sachet', 'count', 1, true, 8),
  ('Pack', 'pack', 'count', 6, false, 9),
  ('Carton', 'carton', 'count', 24, false, 10)
ON CONFLICT DO NOTHING;

-- ── Inventory Items ────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS inventory_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nom text NOT NULL,
  category text NOT NULL DEFAULT 'General',
  unit_id uuid NOT NULL REFERENCES inventory_units(id),
  stock_qty numeric NOT NULL DEFAULT 0,
  avg_purchase_price numeric NOT NULL DEFAULT 0,
  alert_threshold numeric NOT NULL DEFAULT 0,
  actif boolean NOT NULL DEFAULT true,
  restaurant_id uuid NOT NULL DEFAULT '00000000-0000-0000-0000-000000000001',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE inventory_items ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "anon_sel_inventory_items" ON inventory_items;
CREATE POLICY "anon_sel_inventory_items" ON inventory_items FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "anon_ins_inventory_items" ON inventory_items;
CREATE POLICY "anon_ins_inventory_items" ON inventory_items FOR INSERT TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "anon_upd_inventory_items" ON inventory_items;
CREATE POLICY "anon_upd_inventory_items" ON inventory_items FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "anon_del_inventory_items" ON inventory_items;
CREATE POLICY "anon_del_inventory_items" ON inventory_items FOR DELETE TO anon, authenticated USING (true);

CREATE INDEX IF NOT EXISTS idx_inventory_items_nom ON inventory_items(nom);
CREATE INDEX IF NOT EXISTS idx_inventory_items_actif ON inventory_items(actif);

-- ── Inventory Movements ───────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS inventory_movements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id uuid NOT NULL REFERENCES inventory_items(id) ON DELETE CASCADE,
  type text NOT NULL DEFAULT 'IN',
  qty numeric NOT NULL,
  unit_cost numeric NOT NULL DEFAULT 0,
  total_cost numeric NOT NULL DEFAULT 0,
  order_id uuid,
  order_item_id uuid,
  reference text,
  notes text DEFAULT '',
  created_by uuid,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE inventory_movements ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "anon_sel_inventory_movements" ON inventory_movements;
CREATE POLICY "anon_sel_inventory_movements" ON inventory_movements FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "anon_ins_inventory_movements" ON inventory_movements;
CREATE POLICY "anon_ins_inventory_movements" ON inventory_movements FOR INSERT TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "anon_upd_inventory_movements" ON inventory_movements;
CREATE POLICY "anon_upd_inventory_movements" ON inventory_movements FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "anon_del_inventory_movements" ON inventory_movements;
CREATE POLICY "anon_del_inventory_movements" ON inventory_movements FOR DELETE TO anon, authenticated USING (true);

CREATE INDEX IF NOT EXISTS idx_inv_mov_item ON inventory_movements(item_id);
CREATE INDEX IF NOT EXISTS idx_inv_mov_type ON inventory_movements(type);
CREATE INDEX IF NOT EXISTS idx_inv_mov_created ON inventory_movements(created_at);
CREATE INDEX IF NOT EXISTS idx_inv_mov_order ON inventory_movements(order_id);

-- ── Product Recipes ───────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS product_recipes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  item_id uuid NOT NULL REFERENCES inventory_items(id) ON DELETE CASCADE,
  qty numeric NOT NULL DEFAULT 1,
  unit_id uuid NOT NULL REFERENCES inventory_units(id),
  ordre integer NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE product_recipes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "anon_sel_product_recipes" ON product_recipes;
CREATE POLICY "anon_sel_product_recipes" ON product_recipes FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "anon_ins_product_recipes" ON product_recipes;
CREATE POLICY "anon_ins_product_recipes" ON product_recipes FOR INSERT TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "anon_upd_product_recipes" ON product_recipes;
CREATE POLICY "anon_upd_product_recipes" ON product_recipes FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "anon_del_product_recipes" ON product_recipes;
CREATE POLICY "anon_del_product_recipes" ON product_recipes FOR DELETE TO anon, authenticated USING (true);

CREATE INDEX IF NOT EXISTS idx_product_recipes_product ON product_recipes(product_id);
CREATE INDEX IF NOT EXISTS idx_product_recipes_item ON product_recipes(item_id);

-- ── Inventory Counts (physical inventory) ─────────────────────────────────────

CREATE TABLE IF NOT EXISTS inventory_counts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  status text NOT NULL DEFAULT 'in_progress',
  notes text DEFAULT '',
  created_by uuid,
  created_at timestamptz DEFAULT now(),
  finalized_at timestamptz
);

ALTER TABLE inventory_counts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "anon_sel_inventory_counts" ON inventory_counts;
CREATE POLICY "anon_sel_inventory_counts" ON inventory_counts FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "anon_ins_inventory_counts" ON inventory_counts;
CREATE POLICY "anon_ins_inventory_counts" ON inventory_counts FOR INSERT TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "anon_upd_inventory_counts" ON inventory_counts;
CREATE POLICY "anon_upd_inventory_counts" ON inventory_counts FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "anon_del_inventory_counts" ON inventory_counts;
CREATE POLICY "anon_del_inventory_counts" ON inventory_counts FOR DELETE TO anon, authenticated USING (true);

CREATE TABLE IF NOT EXISTS inventory_count_lines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  count_id uuid NOT NULL REFERENCES inventory_counts(id) ON DELETE CASCADE,
  item_id uuid NOT NULL REFERENCES inventory_items(id) ON DELETE CASCADE,
  theoretical_qty numeric NOT NULL DEFAULT 0,
  counted_qty numeric,
  difference numeric NOT NULL DEFAULT 0,
  applied boolean NOT NULL DEFAULT false,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE inventory_count_lines ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "anon_sel_inv_count_lines" ON inventory_count_lines;
CREATE POLICY "anon_sel_inv_count_lines" ON inventory_count_lines FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "anon_ins_inv_count_lines" ON inventory_count_lines;
CREATE POLICY "anon_ins_inv_count_lines" ON inventory_count_lines FOR INSERT TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "anon_upd_inv_count_lines" ON inventory_count_lines;
CREATE POLICY "anon_upd_inv_count_lines" ON inventory_count_lines FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "anon_del_inv_count_lines" ON inventory_count_lines;
CREATE POLICY "anon_del_inv_count_lines" ON inventory_count_lines FOR DELETE TO anon, authenticated USING (true);

CREATE INDEX IF NOT EXISTS idx_inv_count_lines_count ON inventory_count_lines(count_id);
CREATE INDEX IF NOT EXISTS idx_inv_count_lines_item ON inventory_count_lines(item_id);

-- ── RPC: deduct_inventory_for_order ────────────────────────────────────────────

CREATE OR REPLACE FUNCTION deduct_inventory_for_order(p_order_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_recipe record;
  v_item record;
  v_base_qty numeric;
  v_unit_factor numeric;
  v_line_cost numeric;
BEGIN
  FOR v_item IN
    SELECT oi.id, oi.product_id, oi.qty
    FROM order_items oi
    WHERE oi.order_id = p_order_id
  LOOP
    FOR v_recipe IN
      SELECT pr.item_id, pr.qty AS recipe_qty, pr.unit_id
      FROM product_recipes pr
      WHERE pr.product_id = v_item.product_id
    LOOP
      SELECT base_factor INTO v_unit_factor FROM inventory_units WHERE id = v_recipe.unit_id;
      v_base_qty := v_recipe.recipe_qty * v_unit_factor * v_item.qty;

      UPDATE inventory_items
      SET stock_qty = stock_qty - v_base_qty,
          updated_at = now()
      WHERE id = v_recipe.item_id;

      SELECT avg_purchase_price INTO v_line_cost FROM inventory_items WHERE id = v_recipe.item_id;
      v_line_cost := COALESCE(v_line_cost, 0) * v_base_qty;

      INSERT INTO inventory_movements (item_id, type, qty, unit_cost, total_cost, order_id, order_item_id, reference)
      VALUES (v_recipe.item_id, 'OUT', v_base_qty, COALESCE(
        (SELECT avg_purchase_price FROM inventory_items WHERE id = v_recipe.item_id), 0
      ), v_line_cost, p_order_id, v_item.id, 'Vente #' || v_item.qty);
    END LOOP;
  END LOOP;
END;
$$;

-- ── RPC: record_purchase ───────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION record_purchase(
  p_item_id uuid,
  p_qty numeric,
  p_unit_id uuid,
  p_unit_cost numeric,
  p_supplier text DEFAULT '',
  p_notes text DEFAULT '',
  p_created_by uuid DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_base_qty numeric;
  v_unit_factor numeric;
  v_new_total_value numeric;
  v_new_total_qty numeric;
  v_new_avg numeric;
  v_movement_id uuid;
BEGIN
  SELECT base_factor INTO v_unit_factor FROM inventory_units WHERE id = p_unit_id;
  v_base_qty := p_qty * v_unit_factor;

  SELECT stock_qty, avg_purchase_price INTO v_new_total_qty, v_new_avg
    FROM inventory_items WHERE id = p_item_id FOR UPDATE;

  v_new_total_value := (v_new_total_qty * v_new_avg) + (v_base_qty * p_unit_cost);
  v_new_total_qty := v_new_total_qty + v_base_qty;
  v_new_avg := CASE WHEN v_new_total_qty > 0 THEN v_new_total_value / v_new_total_qty ELSE 0 END;

  UPDATE inventory_items
  SET stock_qty = v_new_total_qty,
      avg_purchase_price = v_new_avg,
      updated_at = now()
  WHERE id = p_item_id;

  INSERT INTO inventory_movements (item_id, type, qty, unit_cost, total_cost, reference, notes, created_by)
  VALUES (p_item_id, 'IN', v_base_qty, p_unit_cost, v_base_qty * p_unit_cost,
          COALESCE(p_supplier, ''), COALESCE(p_notes, ''), p_created_by)
  RETURNING id INTO v_movement_id;

  RETURN v_movement_id;
END;
$$;

-- ── RPC: finalize_inventory_count ─────────────────────────────────────────────

CREATE OR REPLACE FUNCTION finalize_inventory_count(p_count_id uuid, p_created_by uuid DEFAULT NULL)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_line record;
  v_adjusted integer := 0;
BEGIN
  FOR v_line IN
    SELECT id, item_id, theoretical_qty, counted_qty, difference
    FROM inventory_count_lines
    WHERE count_id = p_count_id AND counted_qty IS NOT NULL AND difference <> 0
  LOOP
    UPDATE inventory_items
    SET stock_qty = counted_qty,
        updated_at = now()
    WHERE id = v_line.item_id;

    INSERT INTO inventory_movements (item_id, type, qty, unit_cost, total_cost, reference, notes, created_by)
    VALUES (
      v_line.item_id,
      'ADJUSTMENT',
      v_line.difference,
      COALESCE((SELECT avg_purchase_price FROM inventory_items WHERE id = v_line.item_id), 0),
      ABS(v_line.difference) * COALESCE((SELECT avg_purchase_price FROM inventory_items WHERE id = v_line.item_id), 0),
      'Inventaire physique',
      'Ajustement: theorique=' || v_line.theoretical_qty || ', compte=' || v_line.counted_qty,
      p_created_by
    );

    UPDATE inventory_count_lines SET applied = true WHERE id = v_line.id;
    v_adjusted := v_adjusted + 1;
  END LOOP;

  UPDATE inventory_counts
  SET status = 'finalized', finalized_at = now()
  WHERE id = p_count_id;

  RETURN v_adjusted;
END;
$$;

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE inventory_items;
ALTER PUBLICATION supabase_realtime ADD TABLE inventory_movements;
ALTER PUBLICATION supabase_realtime ADD TABLE inventory_counts;

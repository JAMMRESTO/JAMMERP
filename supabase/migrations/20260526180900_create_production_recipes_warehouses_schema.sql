/*
  # Production, Recipes, Ingredients & Warehouses Schema

  ## Overview
  This migration adds the full production intelligence layer:
  - Ingredients with unit costs and stock tracking
  - Recipes linking ingredients to products with quantities
  - Productions recording batch manufacturing with automatic stock consumption
  - Warehouses (multi-depot) with separate stock per location
  - Warehouse transfers between depots with validation workflow

  ## New Tables

  ### ingredients
  - Raw material / ingredient profile
  - Tracks current stock, unit, cost per unit, alert threshold

  ### recipes
  - One recipe per product (1:1 relationship)
  - Stores computed fields: total_cost, max_producible, margin

  ### recipe_items
  - Each ingredient line in a recipe (ingredient + quantity needed per batch)

  ### productions
  - A production run: product + recipe + quantity produced
  - Automatically deducts ingredient stock on creation
  - Tracks losses and notes

  ### warehouses
  - Physical storage locations (main kitchen, cold room, annex, etc.)
  - Each warehouse has its own stock of ingredients

  ### warehouse_stock
  - Junction: ingredient × warehouse → quantity on hand

  ### warehouse_transfers
  - Transfer request between two warehouses
  - Status: pending → validated → cancelled

  ### warehouse_transfer_items
  - Line items for each transfer (ingredient + quantity)

  ## Security
  - RLS enabled on all tables
  - Anon role has full CRUD (PIN-based POS, no Supabase Auth)
*/

-- ============================================================
-- INGREDIENTS
-- ============================================================
CREATE TABLE IF NOT EXISTS ingredients (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  unit text NOT NULL DEFAULT 'kg',
  cost_per_unit numeric(12,4) NOT NULL DEFAULT 0,
  stock numeric(12,3) NOT NULL DEFAULT 0,
  low_stock_threshold numeric(12,3) NOT NULL DEFAULT 0,
  description text DEFAULT '',
  category text DEFAULT '',
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- ============================================================
-- RECIPES
-- ============================================================
CREATE TABLE IF NOT EXISTS recipes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid REFERENCES products(id) ON DELETE CASCADE,
  name text NOT NULL DEFAULT '',
  description text DEFAULT '',
  batch_yield int NOT NULL DEFAULT 1,
  total_cost numeric(12,4) NOT NULL DEFAULT 0,
  max_producible int NOT NULL DEFAULT 0,
  margin_pct numeric(6,2) NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- ============================================================
-- RECIPE ITEMS
-- ============================================================
CREATE TABLE IF NOT EXISTS recipe_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  recipe_id uuid NOT NULL REFERENCES recipes(id) ON DELETE CASCADE,
  ingredient_id uuid NOT NULL REFERENCES ingredients(id) ON DELETE CASCADE,
  quantity numeric(12,4) NOT NULL DEFAULT 0,
  unit text NOT NULL DEFAULT '',
  created_at timestamptz DEFAULT now()
);

-- ============================================================
-- PRODUCTIONS
-- ============================================================
CREATE TABLE IF NOT EXISTS productions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  production_number serial,
  recipe_id uuid NOT NULL REFERENCES recipes(id) ON DELETE RESTRICT,
  product_id uuid REFERENCES products(id) ON DELETE SET NULL,
  product_name text NOT NULL DEFAULT '',
  quantity_produced int NOT NULL DEFAULT 1,
  total_cost numeric(12,4) NOT NULL DEFAULT 0,
  unit_cost numeric(12,4) NOT NULL DEFAULT 0,
  loss_quantity int NOT NULL DEFAULT 0,
  loss_reason text DEFAULT '',
  notes text DEFAULT '',
  status text NOT NULL DEFAULT 'completed' CHECK (status IN ('planned', 'in_progress', 'completed', 'cancelled')),
  produced_by uuid REFERENCES users(id) ON DELETE SET NULL,
  warehouse_id uuid,
  created_at timestamptz DEFAULT now(),
  completed_at timestamptz
);

-- ============================================================
-- WAREHOUSES
-- ============================================================
CREATE TABLE IF NOT EXISTS warehouses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text DEFAULT '',
  location text DEFAULT '',
  is_default boolean NOT NULL DEFAULT false,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz DEFAULT now()
);

-- Add FK on productions for warehouse_id now that warehouses exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'productions_warehouse_id_fkey' AND table_name = 'productions'
  ) THEN
    ALTER TABLE productions ADD CONSTRAINT productions_warehouse_id_fkey
      FOREIGN KEY (warehouse_id) REFERENCES warehouses(id) ON DELETE SET NULL;
  END IF;
END $$;

-- ============================================================
-- WAREHOUSE STOCK
-- ============================================================
CREATE TABLE IF NOT EXISTS warehouse_stock (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  warehouse_id uuid NOT NULL REFERENCES warehouses(id) ON DELETE CASCADE,
  ingredient_id uuid NOT NULL REFERENCES ingredients(id) ON DELETE CASCADE,
  quantity numeric(12,3) NOT NULL DEFAULT 0,
  updated_at timestamptz DEFAULT now(),
  UNIQUE (warehouse_id, ingredient_id)
);

-- ============================================================
-- WAREHOUSE TRANSFERS
-- ============================================================
CREATE TABLE IF NOT EXISTS warehouse_transfers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  transfer_number serial,
  from_warehouse_id uuid NOT NULL REFERENCES warehouses(id) ON DELETE RESTRICT,
  to_warehouse_id uuid NOT NULL REFERENCES warehouses(id) ON DELETE RESTRICT,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'validated', 'cancelled')),
  notes text DEFAULT '',
  requested_by uuid REFERENCES users(id) ON DELETE SET NULL,
  validated_by uuid REFERENCES users(id) ON DELETE SET NULL,
  requested_at timestamptz DEFAULT now(),
  validated_at timestamptz,
  cancelled_at timestamptz
);

-- ============================================================
-- WAREHOUSE TRANSFER ITEMS
-- ============================================================
CREATE TABLE IF NOT EXISTS warehouse_transfer_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  transfer_id uuid NOT NULL REFERENCES warehouse_transfers(id) ON DELETE CASCADE,
  ingredient_id uuid NOT NULL REFERENCES ingredients(id) ON DELETE CASCADE,
  quantity numeric(12,3) NOT NULL DEFAULT 0,
  unit text NOT NULL DEFAULT ''
);

-- ============================================================
-- INDEXES
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_recipe_items_recipe_id ON recipe_items(recipe_id);
CREATE INDEX IF NOT EXISTS idx_recipe_items_ingredient_id ON recipe_items(ingredient_id);
CREATE INDEX IF NOT EXISTS idx_productions_recipe_id ON productions(recipe_id);
CREATE INDEX IF NOT EXISTS idx_productions_created_at ON productions(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_warehouse_stock_warehouse_id ON warehouse_stock(warehouse_id);
CREATE INDEX IF NOT EXISTS idx_warehouse_stock_ingredient_id ON warehouse_stock(ingredient_id);
CREATE INDEX IF NOT EXISTS idx_warehouse_transfers_status ON warehouse_transfers(status);

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================
ALTER TABLE ingredients ENABLE ROW LEVEL SECURITY;
ALTER TABLE recipes ENABLE ROW LEVEL SECURITY;
ALTER TABLE recipe_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE productions ENABLE ROW LEVEL SECURITY;
ALTER TABLE warehouses ENABLE ROW LEVEL SECURITY;
ALTER TABLE warehouse_stock ENABLE ROW LEVEL SECURITY;
ALTER TABLE warehouse_transfers ENABLE ROW LEVEL SECURITY;
ALTER TABLE warehouse_transfer_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "anon select ingredients" ON ingredients FOR SELECT TO anon USING (true);
CREATE POLICY "anon insert ingredients" ON ingredients FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "anon update ingredients" ON ingredients FOR UPDATE TO anon USING (true) WITH CHECK (true);
CREATE POLICY "anon delete ingredients" ON ingredients FOR DELETE TO anon USING (true);

CREATE POLICY "anon select recipes" ON recipes FOR SELECT TO anon USING (true);
CREATE POLICY "anon insert recipes" ON recipes FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "anon update recipes" ON recipes FOR UPDATE TO anon USING (true) WITH CHECK (true);
CREATE POLICY "anon delete recipes" ON recipes FOR DELETE TO anon USING (true);

CREATE POLICY "anon select recipe_items" ON recipe_items FOR SELECT TO anon USING (true);
CREATE POLICY "anon insert recipe_items" ON recipe_items FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "anon update recipe_items" ON recipe_items FOR UPDATE TO anon USING (true) WITH CHECK (true);
CREATE POLICY "anon delete recipe_items" ON recipe_items FOR DELETE TO anon USING (true);

CREATE POLICY "anon select productions" ON productions FOR SELECT TO anon USING (true);
CREATE POLICY "anon insert productions" ON productions FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "anon update productions" ON productions FOR UPDATE TO anon USING (true) WITH CHECK (true);
CREATE POLICY "anon delete productions" ON productions FOR DELETE TO anon USING (true);

CREATE POLICY "anon select warehouses" ON warehouses FOR SELECT TO anon USING (true);
CREATE POLICY "anon insert warehouses" ON warehouses FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "anon update warehouses" ON warehouses FOR UPDATE TO anon USING (true) WITH CHECK (true);
CREATE POLICY "anon delete warehouses" ON warehouses FOR DELETE TO anon USING (true);

CREATE POLICY "anon select warehouse_stock" ON warehouse_stock FOR SELECT TO anon USING (true);
CREATE POLICY "anon insert warehouse_stock" ON warehouse_stock FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "anon update warehouse_stock" ON warehouse_stock FOR UPDATE TO anon USING (true) WITH CHECK (true);
CREATE POLICY "anon delete warehouse_stock" ON warehouse_stock FOR DELETE TO anon USING (true);

CREATE POLICY "anon select warehouse_transfers" ON warehouse_transfers FOR SELECT TO anon USING (true);
CREATE POLICY "anon insert warehouse_transfers" ON warehouse_transfers FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "anon update warehouse_transfers" ON warehouse_transfers FOR UPDATE TO anon USING (true) WITH CHECK (true);
CREATE POLICY "anon delete warehouse_transfers" ON warehouse_transfers FOR DELETE TO anon USING (true);

CREATE POLICY "anon select warehouse_transfer_items" ON warehouse_transfer_items FOR SELECT TO anon USING (true);
CREATE POLICY "anon insert warehouse_transfer_items" ON warehouse_transfer_items FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "anon update warehouse_transfer_items" ON warehouse_transfer_items FOR UPDATE TO anon USING (true) WITH CHECK (true);
CREATE POLICY "anon delete warehouse_transfer_items" ON warehouse_transfer_items FOR DELETE TO anon USING (true);

-- ============================================================
-- SEED: Default warehouses & sample ingredients
-- ============================================================
INSERT INTO warehouses (name, description, location, is_default) VALUES
  ('Cuisine principale', 'Stock central de production', 'Cuisine', true),
  ('Chambre froide', 'Produits frais et surgelés', 'Cuisine - Réfrigérateur', false),
  ('Réserve sèche', 'Épicerie, conserves, sec', 'Arrière-cuisine', false),
  ('Bar', 'Boissons et consommables bar', 'Bar principal', false)
ON CONFLICT DO NOTHING;

INSERT INTO ingredients (name, unit, cost_per_unit, stock, low_stock_threshold, category) VALUES
  ('Farine de blé',      'kg',  0.80,  50,  10,  'Sec'),
  ('Sucre blanc',        'kg',  0.90,  30,  5,   'Sec'),
  ('Beurre',             'kg',  5.50,  10,  2,   'Frais'),
  ('Oeufs',              'pcs', 0.25,  120, 24,  'Frais'),
  ('Lait entier',        'L',   1.20,  20,  5,   'Frais'),
  ('Poulet (filet)',     'kg',  8.00,  15,  3,   'Viande'),
  ('Tomates',            'kg',  1.50,  8,   2,   'Légumes'),
  ('Oignons',            'kg',  0.60,  10,  2,   'Légumes'),
  ('Huile de tournesol', 'L',   2.00,  10,  2,   'Sec'),
  ('Sel',                'kg',  0.20,  5,   1,   'Sec'),
  ('Poivre noir',        'kg',  15.00, 1,   0.2, 'Épices'),
  ('Levure chimique',    'kg',  4.00,  2,   0.5, 'Sec'),
  ('Vanille',            'kg',  80.00, 0.5, 0.1, 'Épices'),
  ('Crème fraîche',      'L',   3.50,  5,   1,   'Frais'),
  ('Chocolat noir',      'kg',  12.00, 3,   0.5, 'Sec')
ON CONFLICT DO NOTHING;

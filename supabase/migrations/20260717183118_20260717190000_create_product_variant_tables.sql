-- Create product_variant_groups and product_variants tables
-- These tables were defined in migration 20260316153159 but never applied.
-- Without them, the MenuView query that joins variant_groups/variants fails entirely,
-- causing the server to see zero products after selecting a table.

-- 1. product_variant_groups
CREATE TABLE IF NOT EXISTS product_variant_groups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  nom text NOT NULL DEFAULT '',
  required boolean NOT NULL DEFAULT false,
  ordre integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_product_variant_groups_product_id ON product_variant_groups(product_id);

ALTER TABLE product_variant_groups ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon can select product_variant_groups" ON product_variant_groups;
CREATE POLICY "anon can select product_variant_groups"
  ON product_variant_groups FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon can insert product_variant_groups" ON product_variant_groups;
CREATE POLICY "anon can insert product_variant_groups"
  ON product_variant_groups FOR INSERT TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "anon can update product_variant_groups" ON product_variant_groups;
CREATE POLICY "anon can update product_variant_groups"
  ON product_variant_groups FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "anon can delete product_variant_groups" ON product_variant_groups;
CREATE POLICY "anon can delete product_variant_groups"
  ON product_variant_groups FOR DELETE TO anon, authenticated USING (true);

-- 2. product_variants
CREATE TABLE IF NOT EXISTS product_variants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id uuid NOT NULL REFERENCES product_variant_groups(id) ON DELETE CASCADE,
  nom text NOT NULL DEFAULT '',
  prix_delta integer NOT NULL DEFAULT 0,
  default_selected boolean NOT NULL DEFAULT false,
  actif boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_product_variants_group_id ON product_variants(group_id);

ALTER TABLE product_variants ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon can select product_variants" ON product_variants;
CREATE POLICY "anon can select product_variants"
  ON product_variants FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon can insert product_variants" ON product_variants;
CREATE POLICY "anon can insert product_variants"
  ON product_variants FOR INSERT TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "anon can update product_variants" ON product_variants;
CREATE POLICY "anon can update product_variants"
  ON product_variants FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "anon can delete product_variants" ON product_variants;
CREATE POLICY "anon can delete product_variants"
  ON product_variants FOR DELETE TO anon, authenticated USING (true);

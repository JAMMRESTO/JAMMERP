/*
  # Add Subcategories and Product Variants

  ## Summary
  This migration adds two major features to the restaurant system:

  ### 1. Subcategories
  - Adds `parent_id` column to `categories` table (self-referential FK)
  - Categories with `parent_id = NULL` are top-level (parent) categories
  - Categories with a `parent_id` are subcategories of that parent
  - Subcategories inherit the printer assignment from their parent if not explicitly set

  ### 2. Product Variants
  - New `product_variant_groups` table: defines groups of mutually exclusive choices (e.g., "Taille", "Cuisson")
  - New `product_variants` table: individual variant options within a group (e.g., "Petit", "Grand")
  - Each variant has a `prix_delta` (price adjustment) and can be marked as `default_selected`
  - Variants are different from options: only one variant per group can be selected (radio), while options are multi-select (checkbox)

  ### Tables Modified
  - `categories`: added `parent_id` (uuid, nullable, FK to categories.id)

  ### New Tables
  - `product_variant_groups`: id, product_id, nom, required, ordre
  - `product_variants`: id, group_id, nom, prix_delta, default_selected, actif

  ### Security
  - RLS enabled on all new tables
  - anon role has full CRUD access (consistent with existing tables)
*/

-- 1. Add parent_id to categories
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'categories' AND column_name = 'parent_id'
  ) THEN
    ALTER TABLE categories ADD COLUMN parent_id uuid REFERENCES categories(id) ON DELETE SET NULL;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_categories_parent_id ON categories(parent_id);

-- 2. Product variant groups table
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

CREATE POLICY "anon can select product_variant_groups"
  ON product_variant_groups FOR SELECT TO anon USING (true);

CREATE POLICY "anon can insert product_variant_groups"
  ON product_variant_groups FOR INSERT TO anon WITH CHECK (true);

CREATE POLICY "anon can update product_variant_groups"
  ON product_variant_groups FOR UPDATE TO anon USING (true) WITH CHECK (true);

CREATE POLICY "anon can delete product_variant_groups"
  ON product_variant_groups FOR DELETE TO anon USING (true);

-- 3. Product variants table
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

CREATE POLICY "anon can select product_variants"
  ON product_variants FOR SELECT TO anon USING (true);

CREATE POLICY "anon can insert product_variants"
  ON product_variants FOR INSERT TO anon WITH CHECK (true);

CREATE POLICY "anon can update product_variants"
  ON product_variants FOR UPDATE TO anon USING (true) WITH CHECK (true);

CREATE POLICY "anon can delete product_variants"
  ON product_variants FOR DELETE TO anon USING (true);

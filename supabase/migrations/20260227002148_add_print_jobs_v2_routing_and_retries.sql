/*
  # Print Jobs V2 — Routing par produit + colonnes fiabilité

  ## Résumé
  Amélioration de la file d'impression pour une gestion fiable et traçable des jobs.

  ## Nouvelles Tables

  ### product_print_routing
  Routing d'impression au niveau produit (écrase le routing par catégorie).
  - `id` — clé primaire
  - `product_id` — produit ciblé (nullable si routing catégorie uniquement)
  - `category_id` — catégorie ciblée (nullable si routing produit uniquement)
  - `printer_id` — imprimante de destination
  - `station` — station logique : kitchen | bar | cashier | other
  - `priority` — ordre de priorité (plus grand = plus prioritaire)
  - `created_at`

  ## Modifications Tables Existantes

  ### print_jobs
  - Ajout `retries` (integer, default 0) — nombre de tentatives d'envoi
  - Ajout `printed_at` (timestamptz) — horodatage de l'impression effective
  - Ajout `station` (text) — station logique cible : kitchen | bar | cashier | other
  - Modification du CHECK status pour inclure PRINTING

  ## Sécurité
  - RLS activé sur product_print_routing
  - Policies anon permissives (application interne PIN-based)
*/

-- =====================
-- ALTER print_jobs : ajouter retries, printed_at, station
-- =====================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'print_jobs' AND column_name = 'retries'
  ) THEN
    ALTER TABLE print_jobs ADD COLUMN retries integer DEFAULT 0;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'print_jobs' AND column_name = 'printed_at'
  ) THEN
    ALTER TABLE print_jobs ADD COLUMN printed_at timestamptz DEFAULT NULL;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'print_jobs' AND column_name = 'station'
  ) THEN
    ALTER TABLE print_jobs ADD COLUMN station text DEFAULT 'kitchen';
  END IF;
END $$;

-- Étendre le CHECK de status pour inclure PRINTING (état intermédiaire)
ALTER TABLE print_jobs DROP CONSTRAINT IF EXISTS print_jobs_status_check;
ALTER TABLE print_jobs ADD CONSTRAINT print_jobs_status_check
  CHECK (status IN ('PENDING', 'PRINTING', 'SUCCESS', 'FAILED'));

-- Index pour performance queue polling
CREATE INDEX IF NOT EXISTS idx_print_jobs_status_created ON print_jobs(status, created_at);
CREATE INDEX IF NOT EXISTS idx_print_jobs_order_station ON print_jobs(order_id, station);

-- =====================
-- TABLE: product_print_routing
-- =====================
CREATE TABLE IF NOT EXISTS product_print_routing (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid REFERENCES products(id) ON DELETE CASCADE,
  category_id uuid REFERENCES categories(id) ON DELETE CASCADE,
  printer_id uuid NOT NULL REFERENCES printers(id) ON DELETE CASCADE,
  station text NOT NULL DEFAULT 'kitchen' CHECK (station IN ('kitchen', 'bar', 'cashier', 'other')),
  priority integer NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  CONSTRAINT product_print_routing_target_check CHECK (
    (product_id IS NOT NULL AND category_id IS NULL)
    OR (product_id IS NULL AND category_id IS NOT NULL)
  )
);

ALTER TABLE product_print_routing ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow anon select on product_print_routing"
  ON product_print_routing FOR SELECT TO anon USING (true);

CREATE POLICY "Allow anon insert on product_print_routing"
  ON product_print_routing FOR INSERT TO anon WITH CHECK (true);

CREATE POLICY "Allow anon update on product_print_routing"
  ON product_print_routing FOR UPDATE TO anon USING (true) WITH CHECK (true);

CREATE POLICY "Allow anon delete on product_print_routing"
  ON product_print_routing FOR DELETE TO anon USING (true);

-- Auth policies for product_print_routing
CREATE POLICY "Allow authenticated select on product_print_routing"
  ON product_print_routing FOR SELECT TO authenticated USING (true);

CREATE POLICY "Allow authenticated insert on product_print_routing"
  ON product_print_routing FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Allow authenticated update on product_print_routing"
  ON product_print_routing FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Allow authenticated delete on product_print_routing"
  ON product_print_routing FOR DELETE TO authenticated USING (true);

-- Index
CREATE INDEX IF NOT EXISTS idx_ppr_product_id ON product_print_routing(product_id);
CREATE INDEX IF NOT EXISTS idx_ppr_category_id ON product_print_routing(category_id);
CREATE INDEX IF NOT EXISTS idx_ppr_printer_id ON product_print_routing(printer_id);

-- =====================
-- Seed: backfill station sur print_jobs existants
-- =====================
UPDATE print_jobs pj
SET station = CASE
  WHEN p.type = 'CUISINE' THEN 'kitchen'
  WHEN p.type = 'BAR' THEN 'bar'
  WHEN p.type = 'CAISSE' THEN 'cashier'
  ELSE 'other'
END
FROM printers p
WHERE pj.printer_id = p.id
  AND pj.station IS NULL OR pj.station = 'kitchen';

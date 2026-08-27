
/*
  # Module Imprimantes et Historique d'impressions

  ## Résumé
  Ajout de la gestion complète des imprimantes multiples et du traçage des impressions.

  ## Nouvelles Tables

  ### 1. printers
  - Gestion des imprimantes réseau du restaurant
  - Types : CUISINE | BAR | CAISSE | AUTRE
  - Champs : id, nom, type, ip_address, port, active, created_at

  ### 2. print_jobs
  - Historique de toutes les impressions effectuées
  - Types d'impression : INITIAL (nouvelle commande), ADDONS (ajouts), BILL (addition)
  - Statuts : SUCCESS | FAILED
  - Champs : id, order_id, printer_id, table_id, type, content_summary, status, created_at, created_by

  ## Modifications Tables Existantes

  ### categories
  - Ajout de la colonne `printer_id` (référence vers printers)
  - Chaque catégorie peut être associée à une imprimante

  ## Sécurité
  - RLS activé sur toutes les nouvelles tables
  - Accès permissif pour le rôle anon (application interne)

  ## Données de départ
  - Imprimantes types CUISINE, BAR et CAISSE par défaut
*/

-- =====================
-- TABLE: printers
-- =====================
CREATE TABLE IF NOT EXISTS printers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nom text NOT NULL,
  type text NOT NULL CHECK (type IN ('CUISINE', 'BAR', 'CAISSE', 'AUTRE')),
  ip_address text DEFAULT '',
  port integer DEFAULT 9100,
  active boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE printers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow anon full access on printers"
  ON printers FOR SELECT TO anon USING (true);

CREATE POLICY "Allow anon insert on printers"
  ON printers FOR INSERT TO anon WITH CHECK (true);

CREATE POLICY "Allow anon update on printers"
  ON printers FOR UPDATE TO anon USING (true) WITH CHECK (true);

CREATE POLICY "Allow anon delete on printers"
  ON printers FOR DELETE TO anon USING (true);

-- =====================
-- TABLE: print_jobs
-- =====================
CREATE TABLE IF NOT EXISTS print_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid REFERENCES orders(id) ON DELETE SET NULL,
  printer_id uuid REFERENCES printers(id) ON DELETE SET NULL,
  table_id uuid REFERENCES tables(id) ON DELETE SET NULL,
  type text NOT NULL CHECK (type IN ('INITIAL', 'ADDONS', 'BILL')),
  content_summary text DEFAULT '',
  status text DEFAULT 'SUCCESS' CHECK (status IN ('SUCCESS', 'FAILED')),
  created_at timestamptz DEFAULT now(),
  created_by uuid REFERENCES users(id) ON DELETE SET NULL
);

ALTER TABLE print_jobs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow anon full access on print_jobs"
  ON print_jobs FOR SELECT TO anon USING (true);

CREATE POLICY "Allow anon insert on print_jobs"
  ON print_jobs FOR INSERT TO anon WITH CHECK (true);

CREATE POLICY "Allow anon update on print_jobs"
  ON print_jobs FOR UPDATE TO anon USING (true) WITH CHECK (true);

CREATE POLICY "Allow anon delete on print_jobs"
  ON print_jobs FOR DELETE TO anon USING (true);

-- =====================
-- ALTER categories: add printer_id
-- =====================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'categories' AND column_name = 'printer_id'
  ) THEN
    ALTER TABLE categories ADD COLUMN printer_id uuid REFERENCES printers(id) ON DELETE SET NULL;
  END IF;
END $$;

-- =====================
-- SEED: Imprimantes par défaut
-- =====================
INSERT INTO printers (nom, type, ip_address, port, active) VALUES
  ('Imprimante Cuisine', 'CUISINE', '192.168.1.101', 9100, true),
  ('Imprimante Bar', 'BAR', '192.168.1.102', 9100, true),
  ('Imprimante Caisse', 'CAISSE', '192.168.1.100', 9100, true)
ON CONFLICT DO NOTHING;

-- =====================
-- ASSOCIATE categories → printers
-- =====================
DO $$
DECLARE
  p_cuisine uuid;
  p_bar uuid;
  p_caisse uuid;
BEGIN
  SELECT id INTO p_cuisine FROM printers WHERE type = 'CUISINE' LIMIT 1;
  SELECT id INTO p_bar FROM printers WHERE type = 'BAR' LIMIT 1;
  SELECT id INTO p_caisse FROM printers WHERE type = 'CAISSE' LIMIT 1;

  IF p_cuisine IS NOT NULL THEN
    UPDATE categories SET printer_id = p_cuisine WHERE nom IN ('Entrées', 'Plats Principaux', 'Grillades', 'Poissons & Fruits de mer', 'Desserts') AND printer_id IS NULL;
  END IF;

  IF p_bar IS NOT NULL THEN
    UPDATE categories SET printer_id = p_bar WHERE nom = 'Boissons' AND printer_id IS NULL;
  END IF;
END $$;

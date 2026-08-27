
/*
  # Restobar 4 - Schéma complet de base de données

  ## Résumé
  Ce fichier crée l'intégralité du schéma de la base de données pour l'application
  de gestion de restaurant Restobar 4, incluant les utilisateurs, les zones, les tables,
  le menu, les commandes et les paiements.

  ## Nouvelles Tables

  ### 1. users
  - Gestion des utilisateurs internes (Admin, Serveur, Caissier)
  - Authentification par PIN ou mot de passe
  - Champs : id, nom, pin, role, actif, created_at

  ### 2. zones
  - Zones de la salle (ex: Salle principale, Terrasse, Bar)
  - Champs : id, nom, ordre, created_at

  ### 3. tables
  - Tables du restaurant avec statut
  - Statuts : LIBRE, OCCUPEE, SERVIE, A_ENCAISSER
  - Champs : id, zone_id, nom, statut, created_at

  ### 4. categories
  - Catégories du menu (ex: Entrées, Plats, Boissons)
  - Champs : id, nom, ordre, actif, created_at

  ### 5. products
  - Produits/plats du menu
  - Champs : id, category_id, nom, prix, image_url, actif, created_at

  ### 6. product_options
  - Suppléments et variantes des produits
  - Champs : id, product_id, nom, prix_delta, created_at

  ### 7. orders
  - Commandes des tables
  - Statuts : BROUILLON, VALIDE, PAYEE, ANNULEE
  - Champs : id, table_id, serveur_id, statut, total, ticket_number, created_at, updated_at

  ### 8. order_items
  - Lignes de commande
  - Champs : id, order_id, product_id, nom_snapshot, prix_snapshot, qty, printed_qty, notes, created_at

  ### 9. order_item_options
  - Options sélectionnées par ligne de commande
  - Champs : id, order_item_id, nom_snapshot, prix_delta_snapshot, created_at

  ### 10. payments
  - Enregistrements de paiements
  - Modes : ESPECES, AUTRE
  - Champs : id, order_id, mode, montant, reference, caissier_id, created_at

  ### 11. cash_sessions
  - Sessions de caisse
  - Champs : id, caissier_id, ouverture, fermeture, total_especes, notes, created_at

  ## Sécurité
  - RLS activé sur toutes les tables
  - Accès permissif pour le rôle anon (application interne avec auth par PIN)

  ## Données de départ
  - Utilisateur Admin avec PIN 1234
  - Zones et tables de démonstration
  - Catégories et produits de démonstration
*/

-- =====================
-- TABLE: users
-- =====================
CREATE TABLE IF NOT EXISTS users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nom text NOT NULL,
  pin text,
  role text NOT NULL CHECK (role IN ('ADMIN', 'SERVEUR', 'CAISSIER')),
  actif boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE users ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow anon full access on users"
  ON users FOR SELECT TO anon USING (true);

CREATE POLICY "Allow anon insert on users"
  ON users FOR INSERT TO anon WITH CHECK (true);

CREATE POLICY "Allow anon update on users"
  ON users FOR UPDATE TO anon USING (true) WITH CHECK (true);

CREATE POLICY "Allow anon delete on users"
  ON users FOR DELETE TO anon USING (true);

-- =====================
-- TABLE: zones
-- =====================
CREATE TABLE IF NOT EXISTS zones (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nom text NOT NULL,
  ordre integer DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE zones ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow anon full access on zones"
  ON zones FOR SELECT TO anon USING (true);

CREATE POLICY "Allow anon insert on zones"
  ON zones FOR INSERT TO anon WITH CHECK (true);

CREATE POLICY "Allow anon update on zones"
  ON zones FOR UPDATE TO anon USING (true) WITH CHECK (true);

CREATE POLICY "Allow anon delete on zones"
  ON zones FOR DELETE TO anon USING (true);

-- =====================
-- TABLE: tables
-- =====================
CREATE TABLE IF NOT EXISTS tables (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  zone_id uuid REFERENCES zones(id) ON DELETE CASCADE,
  nom text NOT NULL,
  statut text NOT NULL DEFAULT 'LIBRE' CHECK (statut IN ('LIBRE', 'OCCUPEE', 'SERVIE', 'A_ENCAISSER')),
  created_at timestamptz DEFAULT now()
);

ALTER TABLE tables ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow anon full access on tables"
  ON tables FOR SELECT TO anon USING (true);

CREATE POLICY "Allow anon insert on tables"
  ON tables FOR INSERT TO anon WITH CHECK (true);

CREATE POLICY "Allow anon update on tables"
  ON tables FOR UPDATE TO anon USING (true) WITH CHECK (true);

CREATE POLICY "Allow anon delete on tables"
  ON tables FOR DELETE TO anon USING (true);

-- =====================
-- TABLE: categories
-- =====================
CREATE TABLE IF NOT EXISTS categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nom text NOT NULL,
  ordre integer DEFAULT 0,
  actif boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE categories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow anon full access on categories"
  ON categories FOR SELECT TO anon USING (true);

CREATE POLICY "Allow anon insert on categories"
  ON categories FOR INSERT TO anon WITH CHECK (true);

CREATE POLICY "Allow anon update on categories"
  ON categories FOR UPDATE TO anon USING (true) WITH CHECK (true);

CREATE POLICY "Allow anon delete on categories"
  ON categories FOR DELETE TO anon USING (true);

-- =====================
-- TABLE: products
-- =====================
CREATE TABLE IF NOT EXISTS products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  category_id uuid REFERENCES categories(id) ON DELETE SET NULL,
  nom text NOT NULL,
  prix integer NOT NULL DEFAULT 0,
  image_url text DEFAULT '',
  actif boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE products ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow anon full access on products"
  ON products FOR SELECT TO anon USING (true);

CREATE POLICY "Allow anon insert on products"
  ON products FOR INSERT TO anon WITH CHECK (true);

CREATE POLICY "Allow anon update on products"
  ON products FOR UPDATE TO anon USING (true) WITH CHECK (true);

CREATE POLICY "Allow anon delete on products"
  ON products FOR DELETE TO anon USING (true);

-- =====================
-- TABLE: product_options
-- =====================
CREATE TABLE IF NOT EXISTS product_options (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid REFERENCES products(id) ON DELETE CASCADE,
  nom text NOT NULL,
  prix_delta integer DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE product_options ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow anon full access on product_options"
  ON product_options FOR SELECT TO anon USING (true);

CREATE POLICY "Allow anon insert on product_options"
  ON product_options FOR INSERT TO anon WITH CHECK (true);

CREATE POLICY "Allow anon update on product_options"
  ON product_options FOR UPDATE TO anon USING (true) WITH CHECK (true);

CREATE POLICY "Allow anon delete on product_options"
  ON product_options FOR DELETE TO anon USING (true);

-- =====================
-- TABLE: orders
-- =====================
CREATE TABLE IF NOT EXISTS orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  table_id uuid REFERENCES tables(id) ON DELETE SET NULL,
  serveur_id uuid REFERENCES users(id) ON DELETE SET NULL,
  statut text NOT NULL DEFAULT 'BROUILLON' CHECK (statut IN ('BROUILLON', 'VALIDE', 'PAYEE', 'ANNULEE')),
  total integer DEFAULT 0,
  ticket_number text DEFAULT '',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE orders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow anon full access on orders"
  ON orders FOR SELECT TO anon USING (true);

CREATE POLICY "Allow anon insert on orders"
  ON orders FOR INSERT TO anon WITH CHECK (true);

CREATE POLICY "Allow anon update on orders"
  ON orders FOR UPDATE TO anon USING (true) WITH CHECK (true);

CREATE POLICY "Allow anon delete on orders"
  ON orders FOR DELETE TO anon USING (true);

-- =====================
-- TABLE: order_items
-- =====================
CREATE TABLE IF NOT EXISTS order_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid REFERENCES orders(id) ON DELETE CASCADE,
  product_id uuid REFERENCES products(id) ON DELETE SET NULL,
  nom_snapshot text NOT NULL,
  prix_snapshot integer NOT NULL,
  qty integer NOT NULL DEFAULT 1,
  printed_qty integer DEFAULT 0,
  notes text DEFAULT '',
  created_at timestamptz DEFAULT now()
);

ALTER TABLE order_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow anon full access on order_items"
  ON order_items FOR SELECT TO anon USING (true);

CREATE POLICY "Allow anon insert on order_items"
  ON order_items FOR INSERT TO anon WITH CHECK (true);

CREATE POLICY "Allow anon update on order_items"
  ON order_items FOR UPDATE TO anon USING (true) WITH CHECK (true);

CREATE POLICY "Allow anon delete on order_items"
  ON order_items FOR DELETE TO anon USING (true);

-- =====================
-- TABLE: order_item_options
-- =====================
CREATE TABLE IF NOT EXISTS order_item_options (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_item_id uuid REFERENCES order_items(id) ON DELETE CASCADE,
  nom_snapshot text NOT NULL,
  prix_delta_snapshot integer DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE order_item_options ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow anon full access on order_item_options"
  ON order_item_options FOR SELECT TO anon USING (true);

CREATE POLICY "Allow anon insert on order_item_options"
  ON order_item_options FOR INSERT TO anon WITH CHECK (true);

CREATE POLICY "Allow anon update on order_item_options"
  ON order_item_options FOR UPDATE TO anon USING (true) WITH CHECK (true);

CREATE POLICY "Allow anon delete on order_item_options"
  ON order_item_options FOR DELETE TO anon USING (true);

-- =====================
-- TABLE: payments
-- =====================
CREATE TABLE IF NOT EXISTS payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid REFERENCES orders(id) ON DELETE SET NULL,
  mode text NOT NULL DEFAULT 'ESPECES' CHECK (mode IN ('ESPECES', 'AUTRE')),
  montant integer NOT NULL DEFAULT 0,
  reference text DEFAULT '',
  caissier_id uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE payments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow anon full access on payments"
  ON payments FOR SELECT TO anon USING (true);

CREATE POLICY "Allow anon insert on payments"
  ON payments FOR INSERT TO anon WITH CHECK (true);

CREATE POLICY "Allow anon update on payments"
  ON payments FOR UPDATE TO anon USING (true) WITH CHECK (true);

CREATE POLICY "Allow anon delete on payments"
  ON payments FOR DELETE TO anon USING (true);

-- =====================
-- TABLE: cash_sessions
-- =====================
CREATE TABLE IF NOT EXISTS cash_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  caissier_id uuid REFERENCES users(id) ON DELETE SET NULL,
  ouverture timestamptz DEFAULT now(),
  fermeture timestamptz,
  total_especes integer DEFAULT 0,
  notes text DEFAULT '',
  created_at timestamptz DEFAULT now()
);

ALTER TABLE cash_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow anon full access on cash_sessions"
  ON cash_sessions FOR SELECT TO anon USING (true);

CREATE POLICY "Allow anon insert on cash_sessions"
  ON cash_sessions FOR INSERT TO anon WITH CHECK (true);

CREATE POLICY "Allow anon update on cash_sessions"
  ON cash_sessions FOR UPDATE TO anon USING (true) WITH CHECK (true);

CREATE POLICY "Allow anon delete on cash_sessions"
  ON cash_sessions FOR DELETE TO anon USING (true);

-- =====================
-- FUNCTION: auto ticket number
-- =====================
CREATE OR REPLACE FUNCTION generate_ticket_number()
RETURNS TRIGGER AS $$
DECLARE
  current_year text;
  counter integer;
  ticket text;
BEGIN
  current_year := to_char(now(), 'YYYY');
  SELECT COUNT(*) + 1 INTO counter
  FROM orders
  WHERE to_char(created_at, 'YYYY') = current_year;
  
  ticket := 'RST-' || current_year || '-' || lpad(counter::text, 4, '0');
  NEW.ticket_number := ticket;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE TRIGGER set_ticket_number
  BEFORE INSERT ON orders
  FOR EACH ROW
  WHEN (NEW.ticket_number = '' OR NEW.ticket_number IS NULL)
  EXECUTE FUNCTION generate_ticket_number();

-- =====================
-- SEED DATA
-- =====================

-- Admin user (PIN: 1234)
INSERT INTO users (nom, pin, role, actif) VALUES
  ('Admin', '1234', 'ADMIN', true),
  ('Marie Serveur', '1111', 'SERVEUR', true),
  ('Paul Caissier', '2222', 'CAISSIER', true)
ON CONFLICT DO NOTHING;

-- Zones
INSERT INTO zones (nom, ordre) VALUES
  ('Salle Principale', 1),
  ('Terrasse', 2),
  ('Bar', 3)
ON CONFLICT DO NOTHING;

-- Tables
DO $$
DECLARE
  zone1_id uuid;
  zone2_id uuid;
  zone3_id uuid;
BEGIN
  SELECT id INTO zone1_id FROM zones WHERE nom = 'Salle Principale' LIMIT 1;
  SELECT id INTO zone2_id FROM zones WHERE nom = 'Terrasse' LIMIT 1;
  SELECT id INTO zone3_id FROM zones WHERE nom = 'Bar' LIMIT 1;

  IF zone1_id IS NOT NULL THEN
    INSERT INTO tables (zone_id, nom, statut) VALUES
      (zone1_id, 'Table 1', 'LIBRE'),
      (zone1_id, 'Table 2', 'LIBRE'),
      (zone1_id, 'Table 3', 'LIBRE'),
      (zone1_id, 'Table 4', 'LIBRE'),
      (zone1_id, 'Table 5', 'LIBRE'),
      (zone1_id, 'Table 6', 'LIBRE')
    ON CONFLICT DO NOTHING;
  END IF;

  IF zone2_id IS NOT NULL THEN
    INSERT INTO tables (zone_id, nom, statut) VALUES
      (zone2_id, 'Terrasse 1', 'LIBRE'),
      (zone2_id, 'Terrasse 2', 'LIBRE'),
      (zone2_id, 'Terrasse 3', 'LIBRE'),
      (zone2_id, 'Terrasse 4', 'LIBRE')
    ON CONFLICT DO NOTHING;
  END IF;

  IF zone3_id IS NOT NULL THEN
    INSERT INTO tables (zone_id, nom, statut) VALUES
      (zone3_id, 'Bar 1', 'LIBRE'),
      (zone3_id, 'Bar 2', 'LIBRE'),
      (zone3_id, 'Bar 3', 'LIBRE')
    ON CONFLICT DO NOTHING;
  END IF;
END $$;

-- Categories
INSERT INTO categories (nom, ordre, actif) VALUES
  ('Entrées', 1, true),
  ('Plats Principaux', 2, true),
  ('Grillades', 3, true),
  ('Poissons & Fruits de mer', 4, true),
  ('Boissons', 5, true),
  ('Desserts', 6, true)
ON CONFLICT DO NOTHING;

-- Products
DO $$
DECLARE
  cat_entrees uuid;
  cat_plats uuid;
  cat_grillades uuid;
  cat_poissons uuid;
  cat_boissons uuid;
  cat_desserts uuid;
BEGIN
  SELECT id INTO cat_entrees FROM categories WHERE nom = 'Entrées' LIMIT 1;
  SELECT id INTO cat_plats FROM categories WHERE nom = 'Plats Principaux' LIMIT 1;
  SELECT id INTO cat_grillades FROM categories WHERE nom = 'Grillades' LIMIT 1;
  SELECT id INTO cat_poissons FROM categories WHERE nom = 'Poissons & Fruits de mer' LIMIT 1;
  SELECT id INTO cat_boissons FROM categories WHERE nom = 'Boissons' LIMIT 1;
  SELECT id INTO cat_desserts FROM categories WHERE nom = 'Desserts' LIMIT 1;

  IF cat_entrees IS NOT NULL THEN
    INSERT INTO products (category_id, nom, prix, image_url, actif) VALUES
      (cat_entrees, 'Salade Niçoise', 2500, 'https://images.pexels.com/photos/1640777/pexels-photo-1640777.jpeg?auto=compress&cs=tinysrgb&w=400', true),
      (cat_entrees, 'Soupe du jour', 1500, 'https://images.pexels.com/photos/539451/pexels-photo-539451.jpeg?auto=compress&cs=tinysrgb&w=400', true),
      (cat_entrees, 'Accras de morue', 3000, 'https://images.pexels.com/photos/1199957/pexels-photo-1199957.jpeg?auto=compress&cs=tinysrgb&w=400', true)
    ON CONFLICT DO NOTHING;
  END IF;

  IF cat_plats IS NOT NULL THEN
    INSERT INTO products (category_id, nom, prix, image_url, actif) VALUES
      (cat_plats, 'Riz au poulet', 4500, 'https://images.pexels.com/photos/2338407/pexels-photo-2338407.jpeg?auto=compress&cs=tinysrgb&w=400', true),
      (cat_plats, 'Thiéboudienne', 5000, 'https://images.pexels.com/photos/1640772/pexels-photo-1640772.jpeg?auto=compress&cs=tinysrgb&w=400', true),
      (cat_plats, 'Mafé de boeuf', 5500, 'https://images.pexels.com/photos/1640774/pexels-photo-1640774.jpeg?auto=compress&cs=tinysrgb&w=400', true),
      (cat_plats, 'Yassa poulet', 4800, 'https://images.pexels.com/photos/2673353/pexels-photo-2673353.jpeg?auto=compress&cs=tinysrgb&w=400', true)
    ON CONFLICT DO NOTHING;
  END IF;

  IF cat_grillades IS NOT NULL THEN
    INSERT INTO products (category_id, nom, prix, image_url, actif) VALUES
      (cat_grillades, 'Côte de boeuf', 8000, 'https://images.pexels.com/photos/1633578/pexels-photo-1633578.jpeg?auto=compress&cs=tinysrgb&w=400', true),
      (cat_grillades, 'Brochettes de poulet', 4000, 'https://images.pexels.com/photos/1882361/pexels-photo-1882361.jpeg?auto=compress&cs=tinysrgb&w=400', true),
      (cat_grillades, 'Poisson grillé entier', 6000, 'https://images.pexels.com/photos/3655916/pexels-photo-3655916.jpeg?auto=compress&cs=tinysrgb&w=400', true)
    ON CONFLICT DO NOTHING;
  END IF;

  IF cat_poissons IS NOT NULL THEN
    INSERT INTO products (category_id, nom, prix, image_url, actif) VALUES
      (cat_poissons, 'Crevettes sautées', 7500, 'https://images.pexels.com/photos/1537635/pexels-photo-1537635.jpeg?auto=compress&cs=tinysrgb&w=400', true),
      (cat_poissons, 'Calamars frits', 5500, 'https://images.pexels.com/photos/262959/pexels-photo-262959.jpeg?auto=compress&cs=tinysrgb&w=400', true)
    ON CONFLICT DO NOTHING;
  END IF;

  IF cat_boissons IS NOT NULL THEN
    INSERT INTO products (category_id, nom, prix, image_url, actif) VALUES
      (cat_boissons, 'Eau minérale', 500, 'https://images.pexels.com/photos/1000084/pexels-photo-1000084.jpeg?auto=compress&cs=tinysrgb&w=400', true),
      (cat_boissons, 'Jus de bissap', 800, 'https://images.pexels.com/photos/3696170/pexels-photo-3696170.jpeg?auto=compress&cs=tinysrgb&w=400', true),
      (cat_boissons, 'Bière locale', 1200, 'https://images.pexels.com/photos/1552630/pexels-photo-1552630.jpeg?auto=compress&cs=tinysrgb&w=400', true),
      (cat_boissons, 'Coca-Cola', 700, 'https://images.pexels.com/photos/50593/coca-cola-cold-drink-soft-drink-coke-50593.jpeg?auto=compress&cs=tinysrgb&w=400', true),
      (cat_boissons, 'Jus de gingembre', 800, 'https://images.pexels.com/photos/3671089/pexels-photo-3671089.jpeg?auto=compress&cs=tinysrgb&w=400', true)
    ON CONFLICT DO NOTHING;
  END IF;

  IF cat_desserts IS NOT NULL THEN
    INSERT INTO products (category_id, nom, prix, image_url, actif) VALUES
      (cat_desserts, 'Fondant au chocolat', 2500, 'https://images.pexels.com/photos/3026804/pexels-photo-3026804.jpeg?auto=compress&cs=tinysrgb&w=400', true),
      (cat_desserts, 'Tarte aux fruits', 2000, 'https://images.pexels.com/photos/1092730/pexels-photo-1092730.jpeg?auto=compress&cs=tinysrgb&w=400', true),
      (cat_desserts, 'Glace 2 boules', 1500, 'https://images.pexels.com/photos/1352281/pexels-photo-1352281.jpeg?auto=compress&cs=tinysrgb&w=400', true)
    ON CONFLICT DO NOTHING;
  END IF;
END $$;

-- Product options (for some products)
DO $$
DECLARE
  prod_yassa uuid;
  prod_cote uuid;
BEGIN
  SELECT id INTO prod_yassa FROM products WHERE nom = 'Yassa poulet' LIMIT 1;
  SELECT id INTO prod_cote FROM products WHERE nom = 'Côte de boeuf' LIMIT 1;

  IF prod_yassa IS NOT NULL THEN
    INSERT INTO product_options (product_id, nom, prix_delta) VALUES
      (prod_yassa, 'Sauce extra', 500),
      (prod_yassa, 'Sans oignon', 0),
      (prod_yassa, 'Portion double', 4800)
    ON CONFLICT DO NOTHING;
  END IF;

  IF prod_cote IS NOT NULL THEN
    INSERT INTO product_options (product_id, nom, prix_delta) VALUES
      (prod_cote, 'Saignant', 0),
      (prod_cote, 'À point', 0),
      (prod_cote, 'Bien cuit', 0),
      (prod_cote, 'Sauce béarnaise', 1000),
      (prod_cote, 'Sauce poivre', 1000)
    ON CONFLICT DO NOTHING;
  END IF;
END $$;

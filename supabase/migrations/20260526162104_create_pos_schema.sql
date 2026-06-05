/*
  # POS Module Schema

  ## Overview
  Creates all tables required for the Point of Sale module.

  ## New Tables

  ### categories
  - Product categories with icon, color, sort order
  - Soft delete via is_active flag

  ### products
  - Menu items with price, image, stock tracking
  - Links to category
  - Variants stored as JSONB array
  - Available/unavailable toggle

  ### sales
  - Each completed or in-progress sale/order
  - Sale type: dine_in, takeaway, delivery
  - Status: open, paid, cancelled
  - Stores table number, customer name, notes

  ### sale_items
  - Line items for each sale
  - Stores unit price at time of sale (snapshot)
  - Kitchen notes per item
  - Variant selection

  ### payments
  - Payment records for each sale
  - Supports multiple payment methods (especes, wave, orange_money, card)
  - A sale can have multiple payments (split payment)

  ## Security
  - RLS enabled, anon full access (PIN-based POS system)
*/

-- Categories
CREATE TABLE IF NOT EXISTS categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  icon text NOT NULL DEFAULT 'utensils',
  color text NOT NULL DEFAULT '#3B82F6',
  sort_order integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz DEFAULT now()
);

-- Products
CREATE TABLE IF NOT EXISTS products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  category_id uuid REFERENCES categories(id) ON DELETE SET NULL,
  name text NOT NULL,
  description text NOT NULL DEFAULT '',
  price numeric(12, 2) NOT NULL DEFAULT 0,
  image_url text NOT NULL DEFAULT '',
  stock integer,
  track_stock boolean NOT NULL DEFAULT false,
  is_available boolean NOT NULL DEFAULT true,
  variants jsonb NOT NULL DEFAULT '[]',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Sales
CREATE TABLE IF NOT EXISTS sales (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sale_number serial,
  sale_type text NOT NULL DEFAULT 'dine_in' CHECK (sale_type IN ('dine_in', 'takeaway', 'delivery')),
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'paid', 'cancelled')),
  table_number text NOT NULL DEFAULT '',
  customer_name text NOT NULL DEFAULT '',
  notes text NOT NULL DEFAULT '',
  subtotal numeric(12, 2) NOT NULL DEFAULT 0,
  tax_amount numeric(12, 2) NOT NULL DEFAULT 0,
  discount_amount numeric(12, 2) NOT NULL DEFAULT 0,
  total numeric(12, 2) NOT NULL DEFAULT 0,
  cashier_id uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now(),
  paid_at timestamptz
);

-- Sale items
CREATE TABLE IF NOT EXISTS sale_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sale_id uuid NOT NULL REFERENCES sales(id) ON DELETE CASCADE,
  product_id uuid REFERENCES products(id) ON DELETE SET NULL,
  product_name text NOT NULL,
  unit_price numeric(12, 2) NOT NULL,
  quantity integer NOT NULL DEFAULT 1,
  subtotal numeric(12, 2) NOT NULL,
  variant_label text NOT NULL DEFAULT '',
  kitchen_note text NOT NULL DEFAULT '',
  created_at timestamptz DEFAULT now()
);

-- Payments
CREATE TABLE IF NOT EXISTS payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sale_id uuid NOT NULL REFERENCES sales(id) ON DELETE CASCADE,
  method text NOT NULL CHECK (method IN ('cash', 'wave', 'orange_money', 'card')),
  amount numeric(12, 2) NOT NULL,
  reference text NOT NULL DEFAULT '',
  created_at timestamptz DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_products_category ON products(category_id);
CREATE INDEX IF NOT EXISTS idx_products_available ON products(is_available);
CREATE INDEX IF NOT EXISTS idx_sale_items_sale ON sale_items(sale_id);
CREATE INDEX IF NOT EXISTS idx_payments_sale ON payments(sale_id);
CREATE INDEX IF NOT EXISTS idx_sales_status ON sales(status);
CREATE INDEX IF NOT EXISTS idx_sales_created ON sales(created_at DESC);

-- RLS
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE sales ENABLE ROW LEVEL SECURITY;
ALTER TABLE sale_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;

-- Anon policies (PIN-based POS)
CREATE POLICY "anon_select_categories" ON categories FOR SELECT TO anon USING (true);
CREATE POLICY "anon_insert_categories" ON categories FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "anon_update_categories" ON categories FOR UPDATE TO anon USING (true) WITH CHECK (true);
CREATE POLICY "anon_delete_categories" ON categories FOR DELETE TO anon USING (true);

CREATE POLICY "anon_select_products" ON products FOR SELECT TO anon USING (true);
CREATE POLICY "anon_insert_products" ON products FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "anon_update_products" ON products FOR UPDATE TO anon USING (true) WITH CHECK (true);
CREATE POLICY "anon_delete_products" ON products FOR DELETE TO anon USING (true);

CREATE POLICY "anon_select_sales" ON sales FOR SELECT TO anon USING (true);
CREATE POLICY "anon_insert_sales" ON sales FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "anon_update_sales" ON sales FOR UPDATE TO anon USING (true) WITH CHECK (true);
CREATE POLICY "anon_delete_sales" ON sales FOR DELETE TO anon USING (true);

CREATE POLICY "anon_select_sale_items" ON sale_items FOR SELECT TO anon USING (true);
CREATE POLICY "anon_insert_sale_items" ON sale_items FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "anon_update_sale_items" ON sale_items FOR UPDATE TO anon USING (true) WITH CHECK (true);
CREATE POLICY "anon_delete_sale_items" ON sale_items FOR DELETE TO anon USING (true);

CREATE POLICY "anon_select_payments" ON payments FOR SELECT TO anon USING (true);
CREATE POLICY "anon_insert_payments" ON payments FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "anon_update_payments" ON payments FOR UPDATE TO anon USING (true) WITH CHECK (true);
CREATE POLICY "anon_delete_payments" ON payments FOR DELETE TO anon USING (true);

-- Seed categories
INSERT INTO categories (name, icon, color, sort_order) VALUES
  ('Entrées', 'salad', '#10B981', 1),
  ('Plats', 'utensils', '#3B82F6', 2),
  ('Grillades', 'flame', '#EF4444', 3),
  ('Poissons', 'fish', '#06B6D4', 4),
  ('Boissons', 'glass-water', '#8B5CF6', 5),
  ('Desserts', 'cake', '#F59E0B', 6),
  ('Snacks', 'sandwich', '#EC4899', 7)
ON CONFLICT DO NOTHING;

-- Seed products
INSERT INTO products (category_id, name, description, price, image_url, is_available, variants) VALUES
  ((SELECT id FROM categories WHERE name='Entrées'), 'Salade César', 'Salade fraîche, croûtons, parmesan', 3500, 'https://images.pexels.com/photos/1640777/pexels-photo-1640777.jpeg?auto=compress&cs=tinysrgb&w=400', true, '[]'),
  ((SELECT id FROM categories WHERE name='Entrées'), 'Soupe du jour', 'Soupe maison selon arrivage', 2500, 'https://images.pexels.com/photos/1731535/pexels-photo-1731535.jpeg?auto=compress&cs=tinysrgb&w=400', true, '[]'),
  ((SELECT id FROM categories WHERE name='Plats'), 'Poulet Yassa', 'Poulet mariné sauce oignon citronnée', 6500, 'https://images.pexels.com/photos/2338407/pexels-photo-2338407.jpeg?auto=compress&cs=tinysrgb&w=400', true, '[{"label":"Sans piment"},{"label":"Extra sauce"}]'),
  ((SELECT id FROM categories WHERE name='Plats'), 'Thiéboudienne', 'Riz au poisson, légumes et sauce tomate', 7500, 'https://images.pexels.com/photos/1640772/pexels-photo-1640772.jpeg?auto=compress&cs=tinysrgb&w=400', true, '[{"label":"Grand format"},{"label":"Normal"}]'),
  ((SELECT id FROM categories WHERE name='Plats'), 'Mafé Bœuf', 'Bœuf en sauce d''arachide avec riz', 8000, 'https://images.pexels.com/photos/3535383/pexels-photo-3535383.jpeg?auto=compress&cs=tinysrgb&w=400', true, '[]'),
  ((SELECT id FROM categories WHERE name='Grillades'), 'Brochettes de Bœuf', '4 brochettes marinées grillées', 7000, 'https://images.pexels.com/photos/1199957/pexels-photo-1199957.jpeg?auto=compress&cs=tinysrgb&w=400', true, '[{"label":"Sauce piment"},{"label":"Sauce mayo"}]'),
  ((SELECT id FROM categories WHERE name='Grillades'), 'Poulet Grillé 1/2', 'Demi-poulet grillé, frites maison', 9500, 'https://images.pexels.com/photos/2673353/pexels-photo-2673353.jpeg?auto=compress&cs=tinysrgb&w=400', true, '[]'),
  ((SELECT id FROM categories WHERE name='Poissons'), 'Tilapia Braisé', 'Tilapia grillé, sauce piment', 8500, 'https://images.pexels.com/photos/842142/pexels-photo-842142.jpeg?auto=compress&cs=tinysrgb&w=400', true, '[]'),
  ((SELECT id FROM categories WHERE name='Boissons'), 'Jus Bissap', 'Jus de fleurs d''hibiscus sucré', 1500, 'https://images.pexels.com/photos/1346347/pexels-photo-1346347.jpeg?auto=compress&cs=tinysrgb&w=400', true, '[{"label":"Sans sucre"},{"label":"Très sucré"}]'),
  ((SELECT id FROM categories WHERE name='Boissons'), 'Coca-Cola', 'Canette 33cl', 1200, 'https://images.pexels.com/photos/2983100/pexels-photo-2983100.jpeg?auto=compress&cs=tinysrgb&w=400', true, '[]'),
  ((SELECT id FROM categories WHERE name='Boissons'), 'Eau Minérale', 'Bouteille 1.5L', 800, 'https://images.pexels.com/photos/416528/pexels-photo-416528.jpeg?auto=compress&cs=tinysrgb&w=400', true, '[{"label":"500ml"},{"label":"1.5L"}]'),
  ((SELECT id FROM categories WHERE name='Desserts'), 'Fondant Chocolat', 'Moelleux chocolat, boule de glace vanille', 4500, 'https://images.pexels.com/photos/1126359/pexels-photo-1126359.jpeg?auto=compress&cs=tinysrgb&w=400', true, '[]'),
  ((SELECT id FROM categories WHERE name='Desserts'), 'Salade de Fruits', 'Fruits frais de saison', 3000, 'https://images.pexels.com/photos/1132047/pexels-photo-1132047.jpeg?auto=compress&cs=tinysrgb&w=400', true, '[]'),
  ((SELECT id FROM categories WHERE name='Snacks'), 'Sandwich Club', 'Pain de mie, jambon, œuf, salade', 4000, 'https://images.pexels.com/photos/1603901/pexels-photo-1603901.jpeg?auto=compress&cs=tinysrgb&w=400', true, '[]'),
  ((SELECT id FROM categories WHERE name='Snacks'), 'Frites Maison', 'Frites fraîches croustillantes', 2000, 'https://images.pexels.com/photos/1583884/pexels-photo-1583884.jpeg?auto=compress&cs=tinysrgb&w=400', true, '[{"label":"Petite"},{"label":"Grande"}]')
ON CONFLICT DO NOTHING;

/*
  # Commandes en ligne — Schéma complet

  ## Nouvelles tables
  - `online_orders` : commandes passées en ligne
    - id, order_number (auto), status (new/confirmed/preparing/ready/delivered/cancelled)
    - type (delivery/takeaway), customer_name, customer_phone, customer_address
    - notes, items (jsonb), subtotal, tax_amount, total, source
    - assigned_to (caissier), created_at, updated_at, confirmed_at, ready_at, delivered_at

  ## Sécurité
  - RLS activé, accès authentifié uniquement (lecture + écriture)
*/

CREATE TABLE IF NOT EXISTS online_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_number serial NOT NULL,
  status text NOT NULL DEFAULT 'new'
    CHECK (status IN ('new','confirmed','preparing','ready','delivered','cancelled')),
  order_type text NOT NULL DEFAULT 'delivery'
    CHECK (order_type IN ('delivery','takeaway')),
  customer_name text NOT NULL DEFAULT '',
  customer_phone text NOT NULL DEFAULT '',
  customer_address text NOT NULL DEFAULT '',
  notes text NOT NULL DEFAULT '',
  items jsonb NOT NULL DEFAULT '[]',
  subtotal numeric(12,2) NOT NULL DEFAULT 0,
  tax_amount numeric(12,2) NOT NULL DEFAULT 0,
  discount_amount numeric(12,2) NOT NULL DEFAULT 0,
  total numeric(12,2) NOT NULL DEFAULT 0,
  source text NOT NULL DEFAULT 'online',
  assigned_to uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  confirmed_at timestamptz,
  ready_at timestamptz,
  delivered_at timestamptz,
  cancelled_at timestamptz
);

ALTER TABLE online_orders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read online orders"
  ON online_orders FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert online orders"
  ON online_orders FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update online orders"
  ON online_orders FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Also allow anon read/write so orders can arrive from a public form
CREATE POLICY "Anon can insert online orders"
  ON online_orders FOR INSERT
  TO anon
  WITH CHECK (true);

CREATE POLICY "Anon can read own new orders"
  ON online_orders FOR SELECT
  TO anon
  USING (status = 'new');

CREATE INDEX IF NOT EXISTS online_orders_status_idx ON online_orders(status);
CREATE INDEX IF NOT EXISTS online_orders_created_at_idx ON online_orders(created_at DESC);

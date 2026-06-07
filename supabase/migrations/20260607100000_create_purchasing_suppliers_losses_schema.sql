/*
# Create Purchasing, Suppliers, and Losses Schema

## Summary
Adds complete purchasing/supplier management, loss tracking, and cost calculation support.

## New Tables
- suppliers: Supplier directory with contact info
- purchase_orders: Purchase orders with status workflow
- purchase_order_items: Line items for purchase orders
- supplier_invoices: Invoice tracking
- losses: Waste/loss declarations with reasons

## Security
- RLS enabled on all tables with anon+authenticated access (site-scoped app pattern)
*/

CREATE TABLE IF NOT EXISTS suppliers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id uuid REFERENCES sites(id) ON DELETE SET NULL,
  name text NOT NULL,
  contact_name text,
  phone text,
  email text,
  address text,
  notes text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_suppliers_site_id ON suppliers(site_id);
ALTER TABLE suppliers ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "suppliers_select" ON suppliers;
CREATE POLICY "suppliers_select" ON suppliers FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "suppliers_insert" ON suppliers;
CREATE POLICY "suppliers_insert" ON suppliers FOR INSERT TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "suppliers_update" ON suppliers;
CREATE POLICY "suppliers_update" ON suppliers FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "suppliers_delete" ON suppliers;
CREATE POLICY "suppliers_delete" ON suppliers FOR DELETE TO anon, authenticated USING (true);

CREATE SEQUENCE IF NOT EXISTS purchase_order_number_seq;
CREATE TABLE IF NOT EXISTS purchase_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id uuid REFERENCES sites(id) ON DELETE SET NULL,
  order_number integer NOT NULL DEFAULT nextval('purchase_order_number_seq'),
  supplier_id uuid REFERENCES suppliers(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'ordered', 'partial', 'received', 'cancelled')),
  order_date date DEFAULT CURRENT_DATE,
  expected_date date,
  received_date date,
  total_amount numeric(12,2) NOT NULL DEFAULT 0,
  notes text,
  created_by uuid,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_purchase_orders_site_id ON purchase_orders(site_id);
CREATE INDEX IF NOT EXISTS idx_purchase_orders_supplier_id ON purchase_orders(supplier_id);
CREATE INDEX IF NOT EXISTS idx_purchase_orders_status ON purchase_orders(status);
ALTER TABLE purchase_orders ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "purchase_orders_select" ON purchase_orders;
CREATE POLICY "purchase_orders_select" ON purchase_orders FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "purchase_orders_insert" ON purchase_orders;
CREATE POLICY "purchase_orders_insert" ON purchase_orders FOR INSERT TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "purchase_orders_update" ON purchase_orders;
CREATE POLICY "purchase_orders_update" ON purchase_orders FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "purchase_orders_delete" ON purchase_orders;
CREATE POLICY "purchase_orders_delete" ON purchase_orders FOR DELETE TO anon, authenticated USING (true);

CREATE TABLE IF NOT EXISTS purchase_order_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id uuid REFERENCES sites(id) ON DELETE SET NULL,
  purchase_order_id uuid NOT NULL REFERENCES purchase_orders(id) ON DELETE CASCADE,
  ingredient_id uuid REFERENCES ingredients(id) ON DELETE SET NULL,
  product_id uuid REFERENCES products(id) ON DELETE SET NULL,
  description text NOT NULL,
  quantity_ordered numeric(12,3) NOT NULL DEFAULT 0,
  quantity_received numeric(12,3) NOT NULL DEFAULT 0,
  unit text NOT NULL DEFAULT 'pcs',
  unit_price numeric(12,4) NOT NULL DEFAULT 0,
  total_price numeric(12,2) NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_purchase_order_items_po_id ON purchase_order_items(purchase_order_id);
CREATE INDEX IF NOT EXISTS idx_purchase_order_items_site_id ON purchase_order_items(site_id);
ALTER TABLE purchase_order_items ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "purchase_order_items_select" ON purchase_order_items;
CREATE POLICY "purchase_order_items_select" ON purchase_order_items FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "purchase_order_items_insert" ON purchase_order_items;
CREATE POLICY "purchase_order_items_insert" ON purchase_order_items FOR INSERT TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "purchase_order_items_update" ON purchase_order_items;
CREATE POLICY "purchase_order_items_update" ON purchase_order_items FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "purchase_order_items_delete" ON purchase_order_items;
CREATE POLICY "purchase_order_items_delete" ON purchase_order_items FOR DELETE TO anon, authenticated USING (true);

CREATE TABLE IF NOT EXISTS supplier_invoices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id uuid REFERENCES sites(id) ON DELETE SET NULL,
  invoice_number text,
  supplier_id uuid REFERENCES suppliers(id) ON DELETE SET NULL,
  purchase_order_id uuid REFERENCES purchase_orders(id) ON DELETE SET NULL,
  invoice_date date DEFAULT CURRENT_DATE,
  due_date date,
  total_amount numeric(12,2) NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'paid', 'overdue')),
  notes text,
  created_at timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_supplier_invoices_site_id ON supplier_invoices(site_id);
CREATE INDEX IF NOT EXISTS idx_supplier_invoices_supplier_id ON supplier_invoices(supplier_id);
ALTER TABLE supplier_invoices ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "supplier_invoices_select" ON supplier_invoices;
CREATE POLICY "supplier_invoices_select" ON supplier_invoices FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "supplier_invoices_insert" ON supplier_invoices;
CREATE POLICY "supplier_invoices_insert" ON supplier_invoices FOR INSERT TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "supplier_invoices_update" ON supplier_invoices;
CREATE POLICY "supplier_invoices_update" ON supplier_invoices FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "supplier_invoices_delete" ON supplier_invoices;
CREATE POLICY "supplier_invoices_delete" ON supplier_invoices FOR DELETE TO anon, authenticated USING (true);

CREATE TABLE IF NOT EXISTS losses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id uuid REFERENCES sites(id) ON DELETE SET NULL,
  product_id uuid REFERENCES products(id) ON DELETE SET NULL,
  ingredient_id uuid REFERENCES ingredients(id) ON DELETE SET NULL,
  item_name text NOT NULL,
  quantity numeric(12,3) NOT NULL,
  unit text NOT NULL DEFAULT 'pcs',
  unit_cost numeric(12,4) NOT NULL DEFAULT 0,
  total_cost numeric(12,2) NOT NULL DEFAULT 0,
  reason text NOT NULL CHECK (reason IN ('breakage', 'expiry', 'production_error', 'other')),
  notes text,
  declared_by uuid,
  declared_at timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_losses_site_id ON losses(site_id);
CREATE INDEX IF NOT EXISTS idx_losses_declared_at ON losses(declared_at);
CREATE INDEX IF NOT EXISTS idx_losses_reason ON losses(reason);
ALTER TABLE losses ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "losses_select" ON losses;
CREATE POLICY "losses_select" ON losses FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "losses_insert" ON losses;
CREATE POLICY "losses_insert" ON losses FOR INSERT TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "losses_update" ON losses;
CREATE POLICY "losses_update" ON losses FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "losses_delete" ON losses;
CREATE POLICY "losses_delete" ON losses FOR DELETE TO anon, authenticated USING (true);

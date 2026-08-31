-- Sauces: catalog + product configuration + sale_item persistence

CREATE TABLE IF NOT EXISTS sauces (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id uuid NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
  name text NOT NULL,
  price_supplement numeric(10,2) NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_sauces_site ON sauces(site_id);

ALTER TABLE sauces ENABLE ROW LEVEL SECURITY;

CREATE POLICY "select_sauces" ON sauces FOR SELECT
  TO authenticated USING (
    site_id IN (SELECT s.id FROM sites s WHERE private.user_owns_site(s.id))
  );

CREATE POLICY "insert_sauces" ON sauces FOR INSERT
  TO authenticated WITH CHECK (
    site_id IN (SELECT s.id FROM sites s WHERE private.user_owns_site(s.id))
  );

CREATE POLICY "update_sauces" ON sauces FOR UPDATE
  TO authenticated
  USING (site_id IN (SELECT s.id FROM sites s WHERE private.user_owns_site(s.id)))
  WITH CHECK (site_id IN (SELECT s.id FROM sites s WHERE private.user_owns_site(s.id)));

CREATE POLICY "delete_sauces" ON sauces FOR DELETE
  TO authenticated USING (
    site_id IN (SELECT s.id FROM sites s WHERE private.user_owns_site(s.id))
  );

-- Product sauce configuration
ALTER TABLE products
  ADD COLUMN IF NOT EXISTS requires_sauce boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS sauce_required boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS sauce_count integer NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS allowed_sauce_ids uuid[] NOT NULL DEFAULT '{}';

-- Persist chosen sauces on sale lines
ALTER TABLE sale_items
  ADD COLUMN IF NOT EXISTS sauces jsonb NOT NULL DEFAULT '[]'::jsonb;

ALTER TABLE order_items
  ADD COLUMN IF NOT EXISTS sauces jsonb NOT NULL DEFAULT '[]'::jsonb;

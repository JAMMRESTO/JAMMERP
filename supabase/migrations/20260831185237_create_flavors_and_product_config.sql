/*
# Create flavors (gouts) catalog + product configuration + sale_item persistence

1. New Tables
- `flavors`
  - `id` (uuid, primary key)
  - `site_id` (uuid, FK -> sites, cascade delete)
  - `name` (text, not null)
  - `price_supplement` (numeric, default 0 — always free, kept for parity with sauces)
  - `is_active` (boolean, default true)
  - `sort_order` (integer, default 0)
  - `created_at` (timestamptz, default now)
  - `updated_at` (timestamptz, default now)

2. Modified Tables
- `products`: add `requires_flavor` (boolean, default false),
  `flavor_required` (boolean, default false),
  `flavor_count` (integer, default 1),
  `allowed_flavor_ids` (uuid[], default '{}')
- `sale_items`: add `flavors` (jsonb, default '[]')
- `order_items`: add `flavors` (jsonb, default '[]')

3. Security
- Enable RLS on `flavors`.
- 4 policies (select/insert/update/delete) scoped to authenticated users
  who own the site, mirroring the sauces table policies.

4. Notes
- Flavors are always free (price_supplement stays 0); the column exists only
  for structural parity with sauces.
- All columns use IF NOT EXISTS so the migration is safe to re-run.
*/

CREATE TABLE IF NOT EXISTS flavors (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id uuid NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
  name text NOT NULL,
  price_supplement numeric(10,2) NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_flavors_site ON flavors(site_id);

ALTER TABLE flavors ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_flavors" ON flavors;
CREATE POLICY "select_flavors" ON flavors FOR SELECT
  TO authenticated USING (
    site_id IN (SELECT s.id FROM sites s WHERE private.user_owns_site(s.id))
  );

DROP POLICY IF EXISTS "insert_flavors" ON flavors;
CREATE POLICY "insert_flavors" ON flavors FOR INSERT
  TO authenticated WITH CHECK (
    site_id IN (SELECT s.id FROM sites s WHERE private.user_owns_site(s.id))
  );

DROP POLICY IF EXISTS "update_flavors" ON flavors;
CREATE POLICY "update_flavors" ON flavors FOR UPDATE
  TO authenticated
  USING (site_id IN (SELECT s.id FROM sites s WHERE private.user_owns_site(s.id)))
  WITH CHECK (site_id IN (SELECT s.id FROM sites s WHERE private.user_owns_site(s.id)));

DROP POLICY IF EXISTS "delete_flavors" ON flavors;
CREATE POLICY "delete_flavors" ON flavors FOR DELETE
  TO authenticated USING (
    site_id IN (SELECT s.id FROM sites s WHERE private.user_owns_site(s.id))
  );

-- Product flavor configuration
ALTER TABLE products
  ADD COLUMN IF NOT EXISTS requires_flavor boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS flavor_required boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS flavor_count integer NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS allowed_flavor_ids uuid[] NOT NULL DEFAULT '{}';

-- Persist chosen flavors on sale lines
ALTER TABLE sale_items
  ADD COLUMN IF NOT EXISTS flavors jsonb NOT NULL DEFAULT '[]'::jsonb;

ALTER TABLE order_items
  ADD COLUMN IF NOT EXISTS flavors jsonb NOT NULL DEFAULT '[]'::jsonb;
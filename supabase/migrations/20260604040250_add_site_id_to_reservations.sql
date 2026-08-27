/*
  # Migration 2/6 — Add site_id to reservations

  ## Problem
  The reservations table has no site_id column. Site isolation was only
  possible via a fragile JOIN: reservations → restaurant_tables → site_id.
  If a table_id becomes NULL (ON DELETE SET NULL), the reservation loses
  all site context and becomes invisible / ungated by RLS.

  ## Actions
  1. Add site_id column with FK to sites (ON DELETE CASCADE)
  2. Backfill site_id from restaurant_tables for existing rows
  3. Add NOT NULL constraint (safe: 0 rows currently; new inserts must supply it)

  ## Security
  RLS policies on reservations updated implicitly — the existing policies
  already join through restaurant_tables. Direct site_id allows simpler
  future policies.
*/

-- Add site_id column
ALTER TABLE reservations
  ADD COLUMN IF NOT EXISTS site_id uuid
  REFERENCES sites(id) ON DELETE CASCADE;

-- Backfill from restaurant_tables (covers all existing rows that have table_id)
UPDATE reservations r
SET site_id = rt.site_id
FROM restaurant_tables rt
WHERE rt.id = r.table_id
  AND r.site_id IS NULL;

-- Add NOT NULL (safe: table is empty; future rows must supply site_id)
ALTER TABLE reservations
  ALTER COLUMN site_id SET NOT NULL;

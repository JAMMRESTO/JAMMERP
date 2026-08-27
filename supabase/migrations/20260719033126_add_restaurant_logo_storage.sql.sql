/*
  # Add restaurant logo for cash receipts

  1. Schema change
  - Adds nullable `logo_url text` column to `restaurants` (idempotent).
  - Holds the public Supabase Storage URL of the restaurant logo that
    appears at the top of price-bearing printed tickets (ADDITION / FACTURE / TEST).

  2. Storage bucket
  - Creates public `restaurant-logos` bucket (5MB, image MIME types only),
    mirroring the existing `product-images` bucket pattern.

  3. Security
  - Storage policies: public read, anon insert/update/delete scoped to
    `bucket_id = 'restaurant-logos'` (single-tenant app, no sign-in).
  - `restaurants` RLS is unchanged; the existing anon SELECT/UPDATE
    policies already cover the new column.
*/

-- 1. Add logo_url column (idempotent)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'restaurants'
      AND column_name = 'logo_url'
  ) THEN
    ALTER TABLE restaurants ADD COLUMN logo_url text;
  END IF;
END
$$;

-- 2. Create public storage bucket for restaurant logos
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'restaurant-logos',
  'restaurant-logos',
  true,
  5242880,
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif']
)
ON CONFLICT (id) DO NOTHING;

-- 3. Storage policies (idempotent: drop first)
DROP POLICY IF EXISTS "Public read restaurant logos" ON storage.objects;
CREATE POLICY "Public read restaurant logos"
  ON storage.objects FOR SELECT
  TO public
  USING (bucket_id = 'restaurant-logos');

DROP POLICY IF EXISTS "Anon can upload restaurant logos" ON storage.objects;
CREATE POLICY "Anon can upload restaurant logos"
  ON storage.objects FOR INSERT
  TO anon, authenticated
  WITH CHECK (bucket_id = 'restaurant-logos');

DROP POLICY IF EXISTS "Anon can update restaurant logos" ON storage.objects;
CREATE POLICY "Anon can update restaurant logos"
  ON storage.objects FOR UPDATE
  TO anon, authenticated
  USING (bucket_id = 'restaurant-logos');

DROP POLICY IF EXISTS "Anon can delete restaurant logos" ON storage.objects;
CREATE POLICY "Anon can delete restaurant logos"
  ON storage.objects FOR DELETE
  TO anon, authenticated
  USING (bucket_id = 'restaurant-logos');

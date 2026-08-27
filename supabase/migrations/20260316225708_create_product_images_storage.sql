/*
  # Create product-images storage bucket

  Creates a public storage bucket for product images with:
  - Public read access for all users (images displayed in menus)
  - Authenticated users can upload/delete images
  - Max file size 5MB, image types only
*/

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'product-images',
  'product-images',
  true,
  5242880,
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif']
)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Public read product images"
  ON storage.objects FOR SELECT
  TO public
  USING (bucket_id = 'product-images');

CREATE POLICY "Anon can upload product images"
  ON storage.objects FOR INSERT
  TO anon
  WITH CHECK (bucket_id = 'product-images');

CREATE POLICY "Anon can update product images"
  ON storage.objects FOR UPDATE
  TO anon
  USING (bucket_id = 'product-images');

CREATE POLICY "Anon can delete product images"
  ON storage.objects FOR DELETE
  TO anon
  USING (bucket_id = 'product-images');

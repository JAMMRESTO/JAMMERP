/*
  # Create storage bucket for company logos

  1. Storage
    - Create `logos` bucket for company logo uploads
    - Public access for reading logos (displayed on tickets)
    - Authenticated users can upload/update logos

  2. Security
    - Anyone can view logos (public bucket)
    - Only authenticated users can upload/modify
*/

-- Create the storage bucket
INSERT INTO storage.buckets (id, name, public)
VALUES ('logos', 'logos', true)
ON CONFLICT (id) DO NOTHING;

-- Policy: anyone can read logos (public)
CREATE POLICY "Public logo access"
  ON storage.objects FOR SELECT
  TO public
  USING (bucket_id = 'logos');

-- Policy: authenticated users can upload logos
CREATE POLICY "Authenticated users can upload logos"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'logos');

-- Policy: authenticated users can update logos
CREATE POLICY "Authenticated users can update logos"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (bucket_id = 'logos')
  WITH CHECK (bucket_id = 'logos');

-- Policy: authenticated users can delete logos
CREATE POLICY "Authenticated users can delete logos"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (bucket_id = 'logos');

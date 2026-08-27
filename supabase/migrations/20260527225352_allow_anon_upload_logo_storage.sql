/*
  # Allow anon role to upload/update/delete logo files in product-images bucket

  ## Context
  The app uses a custom PIN-based auth system (not Supabase Auth), so the
  Supabase client always runs as the `anon` role. The existing storage INSERT
  policy only allowed `authenticated`, which caused the logo upload to fail.

  ## Changes
  - Add INSERT policy for `anon` restricted to the `logo/` path prefix
  - Add UPDATE policy for `anon` restricted to the `logo/` path prefix
  - Add DELETE policy for `anon` restricted to the `logo/` path prefix
  - Existing `authenticated` policies are left untouched
*/

CREATE POLICY "Anon can upload logo"
  ON storage.objects
  FOR INSERT
  TO anon
  WITH CHECK (
    bucket_id = 'product-images'
    AND name LIKE 'logo/%'
  );

CREATE POLICY "Anon can update logo"
  ON storage.objects
  FOR UPDATE
  TO anon
  USING (
    bucket_id = 'product-images'
    AND name LIKE 'logo/%'
  );

CREATE POLICY "Anon can delete logo"
  ON storage.objects
  FOR DELETE
  TO anon
  USING (
    bucket_id = 'product-images'
    AND name LIKE 'logo/%'
  );

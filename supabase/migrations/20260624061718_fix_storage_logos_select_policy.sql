-- Add missing SELECT policy on storage.objects for logos bucket
CREATE POLICY "Anyone can read logos"
  ON storage.objects FOR SELECT TO anon
  USING (bucket_id = 'logos');

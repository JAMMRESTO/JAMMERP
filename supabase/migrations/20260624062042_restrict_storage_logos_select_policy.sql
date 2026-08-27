-- Remove overly broad SELECT policy that allows listing all files
DROP POLICY IF EXISTS "Anyone can read logos" ON storage.objects;

-- Replace with a scoped policy: only authenticated app sessions can list files
CREATE POLICY "App session can list logos"
  ON storage.objects FOR SELECT TO anon
  USING (
    bucket_id = 'logos' AND
    extensions.is_app_authenticated()
  );

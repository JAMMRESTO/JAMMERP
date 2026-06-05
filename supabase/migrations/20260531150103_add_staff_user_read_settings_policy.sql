/*
  # Policy RLS : staff user peut lire les settings de son site

  Permet aux employés connectés via email/mot de passe de lire les paramètres
  de configuration de leur site (nécessaire pour charger les modules actifs,
  le nom du restaurant, etc.).
*/

CREATE POLICY "Staff user can read own site settings"
  ON public.settings
  FOR SELECT
  TO authenticated
  USING (
    site_id IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.site_id = settings.site_id
        AND u.id = auth.uid()
        AND u.is_active = true
    )
  );

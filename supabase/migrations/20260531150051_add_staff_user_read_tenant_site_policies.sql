/*
  # Politiques RLS pour les staff users (public.users) sur tenants et sites

  ## Résumé
  Les employés (caissiers, admins) créés dans public.users peuvent désormais lire
  leur propre tenant et leur propre site après connexion via email/mot de passe.
  Cela est nécessaire pour que l'app puisse charger le contexte de travail après
  l'authentification Supabase Auth.

  ## Changements
  - Nouvelle policy SELECT sur `tenants` : un staff user peut lire son tenant
  - Nouvelle policy SELECT sur `sites` : un staff user peut lire son site
*/

CREATE POLICY "Staff user can read own tenant"
  ON public.tenants
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.tenant_id = tenants.id
        AND u.id = auth.uid()
        AND u.is_active = true
    )
  );

CREATE POLICY "Staff user can read own site"
  ON public.sites
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.site_id = sites.id
        AND u.id = auth.uid()
        AND u.is_active = true
    )
  );

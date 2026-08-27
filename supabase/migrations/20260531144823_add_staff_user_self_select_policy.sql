/*
  # Politique RLS : un utilisateur peut lire son propre enregistrement dans public.users

  ## Résumé
  Permet à un employé (caissier, admin) connecté via email/mot de passe de lire
  sa propre ligne dans la table `users`. Nécessaire pour le flux d'authentification
  staff via Supabase Auth.
*/

CREATE POLICY "Staff user can read own record"
  ON public.users
  FOR SELECT
  TO authenticated
  USING (id = auth.uid());

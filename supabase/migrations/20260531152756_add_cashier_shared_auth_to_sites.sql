/*
  # Ajout du compte caissier partagé sur la table sites

  ## Résumé
  Chaque site a un unique compte email/mot de passe partagé pour tous ses caissiers.
  Cela permet à n'importe quel caissier de se connecter avec le même email
  (ex: caisse@clinton.app), puis de saisir son PIN personnel sur l'écran de caisse.

  ## Changements
  - `sites.cashier_auth_user_id` : l'UUID du compte auth.users partagé des caissiers
*/

ALTER TABLE public.sites
  ADD COLUMN IF NOT EXISTS cashier_auth_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL;

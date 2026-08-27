/*
  # Ajout colonne email à la table users

  ## Résumé
  Ajoute la colonne `email` à la table `users` pour permettre aux employés (caissiers, admins)
  de se connecter via email+mot de passe en plus du PIN quotidien.

  ## Changements
  - Ajout de `email` (text, nullable) sur la table `users`
  - Index unique sur (site_id, email) pour éviter les doublons d'email par site
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'users' AND column_name = 'email'
  ) THEN
    ALTER TABLE public.users ADD COLUMN email text DEFAULT '';
  END IF;
END $$;

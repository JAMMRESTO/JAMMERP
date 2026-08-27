/*
  # Ajout email aux utilisateurs du personnel

  ## Résumé
  Ajoute la colonne `email` à la table `users` (personnel du restaurant).
  Chaque employé pourra se connecter avec email + mot de passe (en plus du PIN).

  ## Changements
  - `users.email` : adresse email de connexion, générée depuis le nom et le slug du site
*/

ALTER TABLE public.users ADD COLUMN IF NOT EXISTS email text NOT NULL DEFAULT '';

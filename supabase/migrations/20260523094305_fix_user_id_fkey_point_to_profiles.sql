/*
  # Corriger la FK user_id vers profiles au lieu de auth.users

  ## Problème
  Les tables `decaissements` et `encaissements` ont leur colonne `user_id`
  référencée vers `auth.users(id)`. Or l'application utilise une authentification
  PIN personnalisée avec la table `profiles` — les utilisateurs n'existent pas
  dans `auth.users`, ce qui provoque une violation de clé étrangère à chaque
  insertion.

  ## Changements
  - `decaissements` : suppression de la FK vers auth.users, ajout FK vers profiles(id)
  - `encaissements` : suppression de la FK vers auth.users, ajout FK vers profiles(id)
*/

ALTER TABLE public.decaissements
  DROP CONSTRAINT IF EXISTS decaissements_user_id_fkey;

ALTER TABLE public.decaissements
  ADD CONSTRAINT decaissements_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES public.profiles(id);

ALTER TABLE public.encaissements
  DROP CONSTRAINT IF EXISTS encaissements_user_id_fkey;

ALTER TABLE public.encaissements
  ADD CONSTRAINT encaissements_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES public.profiles(id);

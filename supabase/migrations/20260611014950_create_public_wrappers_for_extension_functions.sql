/*
  # Créer des fonctions wrapper dans public pour les policies RLS

  ## Problème
  Les policies RLS stockent les noms de fonction sans préfixe de schéma.
  Quand anon exécute la policy, le search_path est 'public' et il ne trouve
  pas is_app_authenticated() ni get_current_profile_id() qui sont dans extensions.

  ## Solution
  Créer des fonctions SQL wrapper dans public qui délèguent à extensions.*.
  Ces wrappers sont SECURITY DEFINER et appartiennent à postgres.
*/

CREATE OR REPLACE FUNCTION public.is_app_authenticated()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = extensions, public
AS $$ SELECT extensions.is_app_authenticated(); $$;

CREATE OR REPLACE FUNCTION public.get_current_profile_id()
RETURNS uuid
LANGUAGE sql
SECURITY DEFINER
SET search_path = extensions, public
AS $$ SELECT extensions.get_current_profile_id(); $$;

-- S'assurer que anon peut les exécuter
GRANT EXECUTE ON FUNCTION public.is_app_authenticated() TO anon;
GRANT EXECUTE ON FUNCTION public.get_current_profile_id() TO anon;

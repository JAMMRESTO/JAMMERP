/*
  # Supprimer les fonctions auth/session du schéma public

  ## Contexte
  Les fonctions authenticate_by_pin, check_app_session, create_app_session et
  destroy_app_session étaient exposées via PostgREST (/rest/v1/rpc/...) au rôle
  anon, ce qui déclenchait des alertes de sécurité.

  ## Solution
  Ces fonctions sont remplacées par une Edge Function (auth-pin) qui utilise
  service_role en interne. Les fonctions publiques sont donc supprimées.

  ## Fonctions supprimées
  - public.authenticate_by_pin(text)
  - public.check_app_session(text)
  - public.create_app_session(uuid)
  - public.destroy_app_session(text)
*/

DROP FUNCTION IF EXISTS public.authenticate_by_pin(text);
DROP FUNCTION IF EXISTS public.check_app_session(text);
DROP FUNCTION IF EXISTS public.create_app_session(uuid);
DROP FUNCTION IF EXISTS public.destroy_app_session(text);

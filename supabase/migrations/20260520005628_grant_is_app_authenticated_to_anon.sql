/*
  # Fix RLS error: grant is_app_authenticated to anon

  RLS policies on caisses, profiles, encaissements, decaissements etc. call
  is_app_authenticated() in the context of the anon role. Without EXECUTE
  permission for anon, every policy check throws "permission denied for function".

  Also grant is_valid_session to anon for the same reason.
*/

GRANT EXECUTE ON FUNCTION public.is_app_authenticated() TO anon;
GRANT EXECUTE ON FUNCTION public.is_valid_session(text) TO anon;

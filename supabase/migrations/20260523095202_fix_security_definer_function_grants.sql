/*
  # Corriger les permissions sur les fonctions SECURITY DEFINER

  ## Problème
  Toutes les fonctions SECURITY DEFINER de l'application sont accessibles au rôle
  `public` (donc `anon` ET `authenticated`), ce qui expose inutilement des RPCs
  sensibles. L'alerte de sécurité signale cela comme un risque.

  ## Analyse
  L'application utilise une authentification PIN personnalisée (pas auth.users).
  Le client Supabase envoie toujours les requêtes avec la clé anon, donc seul le
  rôle `anon` doit pouvoir appeler ces fonctions. Le rôle `authenticated` n'est
  jamais utilisé et ne doit pas avoir accès.

  ## Changements
  1. Révoquer EXECUTE sur toutes les fonctions ciblées pour PUBLIC et authenticated
  2. Accorder EXECUTE uniquement à `anon` pour les fonctions nécessaires au flux PIN
  3. Les fonctions appelées uniquement depuis des politiques RLS internes (is_app_authenticated,
     get_current_profile_id) doivent rester accessibles à `anon` car les policies
     s'exécutent dans le contexte du rôle appelant

  ## Fonctions traitées
  - authenticate_by_pin     → anon uniquement (login)
  - create_app_session      → anon uniquement (login)
  - destroy_app_session     → anon uniquement (logout)
  - check_app_session       → anon uniquement (validation interne)
  - is_valid_session        → anon uniquement (validation interne)
  - is_app_authenticated    → anon uniquement (utilisée dans RLS)
  - get_current_profile_id  → anon uniquement (utilisée dans RLS)
  - generate_numero_facture → anon uniquement (généré lors d'encaissement)
  - generate_numero_piece   → anon uniquement (généré lors de décaissement)
*/

-- Revoke from PUBLIC (covers both anon and authenticated) then re-grant only to anon

REVOKE EXECUTE ON FUNCTION public.authenticate_by_pin(text) FROM PUBLIC, authenticated;
GRANT  EXECUTE ON FUNCTION public.authenticate_by_pin(text) TO anon;

REVOKE EXECUTE ON FUNCTION public.create_app_session(uuid) FROM PUBLIC, authenticated;
GRANT  EXECUTE ON FUNCTION public.create_app_session(uuid) TO anon;

REVOKE EXECUTE ON FUNCTION public.destroy_app_session(text) FROM PUBLIC, authenticated;
GRANT  EXECUTE ON FUNCTION public.destroy_app_session(text) TO anon;

REVOKE EXECUTE ON FUNCTION public.check_app_session(text) FROM PUBLIC, authenticated;
GRANT  EXECUTE ON FUNCTION public.check_app_session(text) TO anon;

REVOKE EXECUTE ON FUNCTION public.is_valid_session(text) FROM PUBLIC, authenticated;
GRANT  EXECUTE ON FUNCTION public.is_valid_session(text) TO anon;

REVOKE EXECUTE ON FUNCTION public.is_app_authenticated() FROM PUBLIC, authenticated;
GRANT  EXECUTE ON FUNCTION public.is_app_authenticated() TO anon;

REVOKE EXECUTE ON FUNCTION public.get_current_profile_id() FROM PUBLIC, authenticated;
GRANT  EXECUTE ON FUNCTION public.get_current_profile_id() TO anon;

REVOKE EXECUTE ON FUNCTION public.generate_numero_facture() FROM PUBLIC, authenticated;
GRANT  EXECUTE ON FUNCTION public.generate_numero_facture() TO anon;

REVOKE EXECUTE ON FUNCTION public.generate_numero_piece() FROM PUBLIC, authenticated;
GRANT  EXECUTE ON FUNCTION public.generate_numero_piece() TO anon;

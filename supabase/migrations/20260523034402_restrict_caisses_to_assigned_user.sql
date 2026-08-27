/*
  # Restreindre l'accès aux caisses selon l'assignation utilisateur

  ## Objectif
  Chaque utilisateur ne doit voir et utiliser que la caisse qui lui est assignée
  dans la colonne `profiles.caisse_id`.

  ## Changements

  1. Nouvelle fonction `get_current_profile_id()`
     - Lit le token `x-app-session` depuis les headers HTTP
     - Retourne le `profile_id` de la session active en base
     - SECURITY DEFINER pour accès garanti à app_sessions

  2. Suppression des anciennes politiques RLS permissives sur `caisses`
     - Les politiques `USING (true)` sont supprimées

  3. Nouvelles politiques RLS restrictives sur `caisses`
     - SELECT : uniquement la caisse assignée au profil connecté
     - INSERT/UPDATE/DELETE : uniquement pour les admins (role = 'admin')
     - Roles admin voient toutes les caisses

  4. Côté frontend (useCaisse)
     - La requête ne retourne plus que la caisse autorisée par RLS
     - Plus besoin de filtrage côté client
*/

-- ─── Fonction helper pour récupérer le profile_id depuis le token de session ───
CREATE OR REPLACE FUNCTION public.get_current_profile_id()
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = ''
AS $$
DECLARE
  v_token text;
  v_profile_id uuid;
BEGIN
  BEGIN
    v_token := current_setting('request.headers', true)::json->>'x-app-session';
  EXCEPTION WHEN OTHERS THEN
    RETURN NULL;
  END;

  IF v_token IS NULL OR v_token = '' THEN
    RETURN NULL;
  END IF;

  SELECT profile_id INTO v_profile_id
  FROM public.app_sessions
  WHERE token = v_token
    AND expires_at > now()
  LIMIT 1;

  RETURN v_profile_id;
END;
$$;

REVOKE ALL ON FUNCTION public.get_current_profile_id() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_current_profile_id() TO anon;
GRANT EXECUTE ON FUNCTION public.get_current_profile_id() TO authenticated;

-- ─── Supprimer les anciennes politiques permissives sur caisses ───
DROP POLICY IF EXISTS "anon can select caisses" ON public.caisses;
DROP POLICY IF EXISTS "anon can insert caisses" ON public.caisses;
DROP POLICY IF EXISTS "anon can update caisses" ON public.caisses;
DROP POLICY IF EXISTS "anon can delete caisses" ON public.caisses;
DROP POLICY IF EXISTS "authenticated can select caisses" ON public.caisses;
DROP POLICY IF EXISTS "authenticated can insert caisses" ON public.caisses;
DROP POLICY IF EXISTS "authenticated can update caisses" ON public.caisses;
DROP POLICY IF EXISTS "authenticated can delete caisses" ON public.caisses;
DROP POLICY IF EXISTS "Authenticated users can read caisses" ON public.caisses;
DROP POLICY IF EXISTS "Authenticated users can insert caisses" ON public.caisses;
DROP POLICY IF EXISTS "Authenticated users can update caisses" ON public.caisses;
DROP POLICY IF EXISTS "Authenticated users can delete caisses" ON public.caisses;
DROP POLICY IF EXISTS "App authenticated users can read caisses" ON public.caisses;
DROP POLICY IF EXISTS "App authenticated users can insert caisses" ON public.caisses;
DROP POLICY IF EXISTS "App authenticated users can update caisses" ON public.caisses;
DROP POLICY IF EXISTS "App authenticated users can delete caisses" ON public.caisses;

-- ─── Nouvelles politiques RLS restrictives sur caisses ───

-- SELECT : l'utilisateur voit uniquement sa caisse assignée
--          les admins voient toutes les caisses
CREATE POLICY "User sees only their assigned caisse"
  ON public.caisses
  FOR SELECT
  TO anon, authenticated
  USING (
    is_app_authenticated() AND (
      -- Admin : voit tout
      EXISTS (
        SELECT 1 FROM public.profiles
        WHERE id = get_current_profile_id()
          AND role = 'admin'
      )
      OR
      -- Utilisateur normal : uniquement sa caisse assignée
      EXISTS (
        SELECT 1 FROM public.profiles
        WHERE id = get_current_profile_id()
          AND caisse_id = caisses.id
      )
    )
  );

-- INSERT : admins uniquement
CREATE POLICY "Only admins can insert caisses"
  ON public.caisses
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (
    is_app_authenticated() AND
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = get_current_profile_id()
        AND role = 'admin'
    )
  );

-- UPDATE : admins uniquement
CREATE POLICY "Only admins can update caisses"
  ON public.caisses
  FOR UPDATE
  TO anon, authenticated
  USING (
    is_app_authenticated() AND
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = get_current_profile_id()
        AND role = 'admin'
    )
  )
  WITH CHECK (
    is_app_authenticated() AND
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = get_current_profile_id()
        AND role = 'admin'
    )
  );

-- DELETE : admins uniquement
CREATE POLICY "Only admins can delete caisses"
  ON public.caisses
  FOR DELETE
  TO anon, authenticated
  USING (
    is_app_authenticated() AND
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = get_current_profile_id()
        AND role = 'admin'
    )
  );

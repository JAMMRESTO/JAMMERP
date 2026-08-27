/*
  # Déplacer les fonctions internes vers le schéma extensions

  ## Problème
  Les fonctions utilisées uniquement en interne (policies RLS) sont exposées dans
  le schéma `public`, ce qui les rend accessibles via PostgREST (/rest/v1/rpc/...).

  ## Solution
  1. Supprimer d'abord toutes les policies dépendantes
  2. Supprimer les anciennes fonctions publiques
  3. Recréer les fonctions dans le schéma `extensions` (non exposé par PostgREST)
  4. Recréer toutes les policies en appelant extensions.*

  ## Fonctions déplacées (plus accessibles via RPC)
  - is_app_authenticated()    → extensions.is_app_authenticated()
  - get_current_profile_id()  → extensions.get_current_profile_id()
  - is_valid_session(text)    → extensions.is_valid_session(text)
  - generate_numero_facture() → extensions.generate_numero_facture()
  - generate_numero_piece()   → extensions.generate_numero_piece()
*/

CREATE SCHEMA IF NOT EXISTS extensions;

-- ── 1. Supprimer les policies dépendantes ──────────────────────
DROP POLICY IF EXISTS "App session can read caisses" ON public.caisses;
DROP POLICY IF EXISTS "App session can insert caisses" ON public.caisses;
DROP POLICY IF EXISTS "App session can update caisses" ON public.caisses;
DROP POLICY IF EXISTS "App session can delete caisses" ON public.caisses;
DROP POLICY IF EXISTS "User sees only their assigned caisse" ON public.caisses;
DROP POLICY IF EXISTS "Only admins can insert caisses" ON public.caisses;
DROP POLICY IF EXISTS "Only admins can update caisses" ON public.caisses;
DROP POLICY IF EXISTS "Only admins can delete caisses" ON public.caisses;

DROP POLICY IF EXISTS "App session can read comptes_charges" ON public.comptes_charges;
DROP POLICY IF EXISTS "App session can insert comptes_charges" ON public.comptes_charges;
DROP POLICY IF EXISTS "App session can update comptes_charges" ON public.comptes_charges;
DROP POLICY IF EXISTS "App session can delete comptes_charges" ON public.comptes_charges;

DROP POLICY IF EXISTS "App session can read encaissements" ON public.encaissements;
DROP POLICY IF EXISTS "App session can insert encaissements" ON public.encaissements;
DROP POLICY IF EXISTS "App session can update encaissements" ON public.encaissements;

DROP POLICY IF EXISTS "App session can read decaissements" ON public.decaissements;
DROP POLICY IF EXISTS "App session can insert decaissements" ON public.decaissements;
DROP POLICY IF EXISTS "App session can update decaissements" ON public.decaissements;

DROP POLICY IF EXISTS "App session can read profiles" ON public.profiles;
DROP POLICY IF EXISTS "App session can insert profiles" ON public.profiles;
DROP POLICY IF EXISTS "App session can update profiles" ON public.profiles;
DROP POLICY IF EXISTS "App session can delete profiles" ON public.profiles;

DROP POLICY IF EXISTS "App session can read societe" ON public.societe;
DROP POLICY IF EXISTS "App session can insert societe" ON public.societe;
DROP POLICY IF EXISTS "App session can update societe" ON public.societe;

-- ── 2. Supprimer les anciennes fonctions publiques ─────────────
DROP FUNCTION IF EXISTS public.is_app_authenticated();
DROP FUNCTION IF EXISTS public.get_current_profile_id();
DROP FUNCTION IF EXISTS public.is_valid_session(text);
DROP FUNCTION IF EXISTS public.generate_numero_facture();
DROP FUNCTION IF EXISTS public.generate_numero_piece();

-- ── 3. Recréer dans le schéma extensions ──────────────────────
CREATE OR REPLACE FUNCTION extensions.is_app_authenticated()
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_token text;
BEGIN
  BEGIN
    v_token := current_setting('request.headers', true)::json->>'x-app-session';
  EXCEPTION WHEN OTHERS THEN
    RETURN false;
  END;
  IF v_token IS NULL OR v_token = '' THEN
    RETURN false;
  END IF;
  RETURN EXISTS (
    SELECT 1 FROM public.app_sessions
    WHERE token = v_token AND expires_at > now()
  );
END;
$$;

CREATE OR REPLACE FUNCTION extensions.get_current_profile_id()
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
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
  WHERE token = v_token AND expires_at > now()
  LIMIT 1;
  RETURN v_profile_id;
END;
$$;

CREATE OR REPLACE FUNCTION extensions.is_valid_session(p_token text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.app_sessions
    WHERE token = p_token AND expires_at > now()
  );
END;
$$;

CREATE OR REPLACE FUNCTION extensions.generate_numero_facture()
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN 'FAC-' || LPAD(nextval('public.seq_numero_facture')::text, 6, '0');
END;
$$;

CREATE OR REPLACE FUNCTION extensions.generate_numero_piece()
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN 'DEC-' || LPAD(nextval('public.seq_numero_piece')::text, 6, '0');
END;
$$;

-- Grants pour que les policies RLS (exécutées en tant qu'anon) puissent appeler
GRANT USAGE ON SCHEMA extensions TO anon;
GRANT EXECUTE ON FUNCTION extensions.is_app_authenticated() TO anon;
GRANT EXECUTE ON FUNCTION extensions.get_current_profile_id() TO anon;
GRANT EXECUTE ON FUNCTION extensions.is_valid_session(text) TO anon;
GRANT EXECUTE ON FUNCTION extensions.generate_numero_facture() TO anon;
GRANT EXECUTE ON FUNCTION extensions.generate_numero_piece() TO anon;

-- ── 4. Recréer toutes les policies RLS ────────────────────────

-- caisses
CREATE POLICY "App session can read caisses"
  ON public.caisses FOR SELECT TO anon
  USING (extensions.is_app_authenticated());

CREATE POLICY "App session can insert caisses"
  ON public.caisses FOR INSERT TO anon
  WITH CHECK (extensions.is_app_authenticated());

CREATE POLICY "App session can update caisses"
  ON public.caisses FOR UPDATE TO anon
  USING (extensions.is_app_authenticated())
  WITH CHECK (extensions.is_app_authenticated());

CREATE POLICY "App session can delete caisses"
  ON public.caisses FOR DELETE TO anon
  USING (extensions.is_app_authenticated());

CREATE POLICY "User sees only their assigned caisse"
  ON public.caisses FOR SELECT TO anon
  USING (
    extensions.is_app_authenticated() AND (
      EXISTS (SELECT 1 FROM profiles WHERE profiles.id = extensions.get_current_profile_id() AND profiles.role = 'admin')
      OR
      EXISTS (SELECT 1 FROM profiles WHERE profiles.id = extensions.get_current_profile_id() AND profiles.caisse_id = caisses.id)
    )
  );

CREATE POLICY "Only admins can insert caisses"
  ON public.caisses FOR INSERT TO anon
  WITH CHECK (
    extensions.is_app_authenticated() AND
    EXISTS (SELECT 1 FROM profiles WHERE profiles.id = extensions.get_current_profile_id() AND profiles.role = 'admin')
  );

CREATE POLICY "Only admins can update caisses"
  ON public.caisses FOR UPDATE TO anon
  USING (
    extensions.is_app_authenticated() AND
    EXISTS (SELECT 1 FROM profiles WHERE profiles.id = extensions.get_current_profile_id() AND profiles.role = 'admin')
  )
  WITH CHECK (
    extensions.is_app_authenticated() AND
    EXISTS (SELECT 1 FROM profiles WHERE profiles.id = extensions.get_current_profile_id() AND profiles.role = 'admin')
  );

CREATE POLICY "Only admins can delete caisses"
  ON public.caisses FOR DELETE TO anon
  USING (
    extensions.is_app_authenticated() AND
    EXISTS (SELECT 1 FROM profiles WHERE profiles.id = extensions.get_current_profile_id() AND profiles.role = 'admin')
  );

-- comptes_charges
CREATE POLICY "App session can read comptes_charges"
  ON public.comptes_charges FOR SELECT TO anon
  USING (extensions.is_app_authenticated());

CREATE POLICY "App session can insert comptes_charges"
  ON public.comptes_charges FOR INSERT TO anon
  WITH CHECK (extensions.is_app_authenticated());

CREATE POLICY "App session can update comptes_charges"
  ON public.comptes_charges FOR UPDATE TO anon
  USING (extensions.is_app_authenticated())
  WITH CHECK (extensions.is_app_authenticated());

CREATE POLICY "App session can delete comptes_charges"
  ON public.comptes_charges FOR DELETE TO anon
  USING (extensions.is_app_authenticated());

-- encaissements
CREATE POLICY "App session can read encaissements"
  ON public.encaissements FOR SELECT TO anon
  USING (extensions.is_app_authenticated());

CREATE POLICY "App session can insert encaissements"
  ON public.encaissements FOR INSERT TO anon
  WITH CHECK (extensions.is_app_authenticated());

CREATE POLICY "App session can update encaissements"
  ON public.encaissements FOR UPDATE TO anon
  USING (extensions.is_app_authenticated())
  WITH CHECK (extensions.is_app_authenticated());

-- decaissements
CREATE POLICY "App session can read decaissements"
  ON public.decaissements FOR SELECT TO anon
  USING (extensions.is_app_authenticated());

CREATE POLICY "App session can insert decaissements"
  ON public.decaissements FOR INSERT TO anon
  WITH CHECK (extensions.is_app_authenticated());

CREATE POLICY "App session can update decaissements"
  ON public.decaissements FOR UPDATE TO anon
  USING (extensions.is_app_authenticated())
  WITH CHECK (extensions.is_app_authenticated());

-- profiles
CREATE POLICY "App session can read profiles"
  ON public.profiles FOR SELECT TO anon
  USING (extensions.is_app_authenticated());

CREATE POLICY "App session can insert profiles"
  ON public.profiles FOR INSERT TO anon
  WITH CHECK (extensions.is_app_authenticated());

CREATE POLICY "App session can update profiles"
  ON public.profiles FOR UPDATE TO anon
  USING (extensions.is_app_authenticated())
  WITH CHECK (extensions.is_app_authenticated());

CREATE POLICY "App session can delete profiles"
  ON public.profiles FOR DELETE TO anon
  USING (extensions.is_app_authenticated());

-- societe
CREATE POLICY "App session can read societe"
  ON public.societe FOR SELECT TO anon
  USING (extensions.is_app_authenticated());

CREATE POLICY "App session can insert societe"
  ON public.societe FOR INSERT TO anon
  WITH CHECK (extensions.is_app_authenticated());

CREATE POLICY "App session can update societe"
  ON public.societe FOR UPDATE TO anon
  USING (extensions.is_app_authenticated())
  WITH CHECK (extensions.is_app_authenticated());

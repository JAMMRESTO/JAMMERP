
-- Create helper functions for RLS policies that bypass RLS themselves
-- These are needed because subqueries on profiles in policies would fail
-- when the profile belongs to a different org than the session

CREATE OR REPLACE FUNCTION extensions.is_current_user_admin()
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_profile_id uuid;
  v_is_admin boolean;
BEGIN
  v_profile_id := extensions.get_current_profile_id();
  IF v_profile_id IS NULL THEN
    RETURN false;
  END IF;

  SELECT (role = 'admin' OR is_super_admin = true) INTO v_is_admin
  FROM public.profiles
  WHERE id = v_profile_id;

  RETURN COALESCE(v_is_admin, false);
END;
$$;

CREATE OR REPLACE FUNCTION extensions.is_current_user_super_admin()
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_profile_id uuid;
  v_is_super boolean;
BEGIN
  v_profile_id := extensions.get_current_profile_id();
  IF v_profile_id IS NULL THEN
    RETURN false;
  END IF;

  SELECT is_super_admin INTO v_is_super
  FROM public.profiles
  WHERE id = v_profile_id;

  RETURN COALESCE(v_is_super, false);
END;
$$;

GRANT EXECUTE ON FUNCTION extensions.is_current_user_admin() TO anon;
GRANT EXECUTE ON FUNCTION extensions.is_current_user_super_admin() TO anon;

-- ── profiles RLS ──────────────────────────────────────────────────
DROP POLICY IF EXISTS "App session can read profiles" ON public.profiles;
DROP POLICY IF EXISTS "App session can insert profiles" ON public.profiles;
DROP POLICY IF EXISTS "App session can update profiles" ON public.profiles;
DROP POLICY IF EXISTS "App session can delete profiles" ON public.profiles;

CREATE POLICY "App session can read profiles"
  ON public.profiles FOR SELECT TO anon
  USING (
    extensions.is_app_authenticated() AND (
      organisation_id = extensions.get_current_organisation_id()
      OR extensions.is_current_user_super_admin()
    )
  );

CREATE POLICY "App session can insert profiles"
  ON public.profiles FOR INSERT TO anon
  WITH CHECK (
    extensions.is_app_authenticated() AND (
      organisation_id = extensions.get_current_organisation_id()
      OR extensions.is_current_user_super_admin()
    )
  );

CREATE POLICY "App session can update profiles"
  ON public.profiles FOR UPDATE TO anon
  USING (
    extensions.is_app_authenticated() AND (
      organisation_id = extensions.get_current_organisation_id()
      OR extensions.is_current_user_super_admin()
    )
  )
  WITH CHECK (
    extensions.is_app_authenticated() AND (
      organisation_id = extensions.get_current_organisation_id()
      OR extensions.is_current_user_super_admin()
    )
  );

CREATE POLICY "App session can delete profiles"
  ON public.profiles FOR DELETE TO anon
  USING (
    extensions.is_app_authenticated() AND (
      organisation_id = extensions.get_current_organisation_id()
      OR extensions.is_current_user_super_admin()
    )
  );

-- ── caisses RLS ────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Authenticated users see their allowed caisses" ON public.caisses;
DROP POLICY IF EXISTS "Only admins can insert caisses" ON public.caisses;
DROP POLICY IF EXISTS "Only admins can update caisses" ON public.caisses;
DROP POLICY IF EXISTS "Only admins can delete caisses" ON public.caisses;
DROP POLICY IF EXISTS "App session can read caisses" ON public.caisses;
DROP POLICY IF EXISTS "App session can insert caisses" ON public.caisses;
DROP POLICY IF EXISTS "App session can update caisses" ON public.caisses;
DROP POLICY IF EXISTS "App session can delete caisses" ON public.caisses;

CREATE POLICY "Users see their allowed caisses"
  ON public.caisses FOR SELECT TO anon
  USING (
    extensions.is_app_authenticated() AND
    organisation_id = extensions.get_current_organisation_id() AND (
      extensions.is_current_user_admin()
      OR EXISTS (
        SELECT 1 FROM profiles p
        WHERE p.id = extensions.get_current_profile_id()
          AND p.caisse_id = caisses.id
      )
    )
  );

CREATE POLICY "Admins can insert caisses"
  ON public.caisses FOR INSERT TO anon
  WITH CHECK (
    extensions.is_app_authenticated() AND
    organisation_id = extensions.get_current_organisation_id() AND
    extensions.is_current_user_admin()
  );

CREATE POLICY "Admins can update caisses"
  ON public.caisses FOR UPDATE TO anon
  USING (
    extensions.is_app_authenticated() AND
    organisation_id = extensions.get_current_organisation_id() AND
    extensions.is_current_user_admin()
  )
  WITH CHECK (
    extensions.is_app_authenticated() AND
    organisation_id = extensions.get_current_organisation_id() AND
    extensions.is_current_user_admin()
  );

CREATE POLICY "Admins can delete caisses"
  ON public.caisses FOR DELETE TO anon
  USING (
    extensions.is_app_authenticated() AND
    organisation_id = extensions.get_current_organisation_id() AND
    extensions.is_current_user_admin()
  );

-- ── encaissements RLS ──────────────────────────────────────────────
DROP POLICY IF EXISTS "App session can read encaissements" ON public.encaissements;
DROP POLICY IF EXISTS "App session can insert encaissements" ON public.encaissements;
DROP POLICY IF EXISTS "App session can update encaissements" ON public.encaissements;

CREATE POLICY "Users read their encaissements"
  ON public.encaissements FOR SELECT TO anon
  USING (
    extensions.is_app_authenticated() AND
    organisation_id = extensions.get_current_organisation_id() AND (
      extensions.is_current_user_admin()
      OR EXISTS (
        SELECT 1 FROM profiles p
        WHERE p.id = extensions.get_current_profile_id()
          AND p.caisse_id = encaissements.caisse_id
      )
    )
  );

CREATE POLICY "Users insert encaissements"
  ON public.encaissements FOR INSERT TO anon
  WITH CHECK (
    extensions.is_app_authenticated() AND
    organisation_id = extensions.get_current_organisation_id() AND (
      extensions.is_current_user_admin()
      OR EXISTS (
        SELECT 1 FROM profiles p
        WHERE p.id = extensions.get_current_profile_id()
          AND p.caisse_id = encaissements.caisse_id
      )
    )
  );

CREATE POLICY "Users update encaissements"
  ON public.encaissements FOR UPDATE TO anon
  USING (
    extensions.is_app_authenticated() AND
    organisation_id = extensions.get_current_organisation_id() AND (
      extensions.is_current_user_admin()
      OR EXISTS (
        SELECT 1 FROM profiles p
        WHERE p.id = extensions.get_current_profile_id()
          AND p.caisse_id = encaissements.caisse_id
      )
    )
  )
  WITH CHECK (
    extensions.is_app_authenticated() AND
    organisation_id = extensions.get_current_organisation_id() AND (
      extensions.is_current_user_admin()
      OR EXISTS (
        SELECT 1 FROM profiles p
        WHERE p.id = extensions.get_current_profile_id()
          AND p.caisse_id = encaissements.caisse_id
      )
    )
  );

-- ── decaissements RLS ──────────────────────────────────────────────
DROP POLICY IF EXISTS "App session can read decaissements" ON public.decaissements;
DROP POLICY IF EXISTS "App session can insert decaissements" ON public.decaissements;
DROP POLICY IF EXISTS "App session can update decaissements" ON public.decaissements;

CREATE POLICY "Users read their decaissements"
  ON public.decaissements FOR SELECT TO anon
  USING (
    extensions.is_app_authenticated() AND
    organisation_id = extensions.get_current_organisation_id() AND (
      extensions.is_current_user_admin()
      OR EXISTS (
        SELECT 1 FROM profiles p
        WHERE p.id = extensions.get_current_profile_id()
          AND p.caisse_id = decaissements.caisse_id
      )
    )
  );

CREATE POLICY "Users insert decaissements"
  ON public.decaissements FOR INSERT TO anon
  WITH CHECK (
    extensions.is_app_authenticated() AND
    organisation_id = extensions.get_current_organisation_id() AND (
      extensions.is_current_user_admin()
      OR EXISTS (
        SELECT 1 FROM profiles p
        WHERE p.id = extensions.get_current_profile_id()
          AND p.caisse_id = decaissements.caisse_id
      )
    )
  );

CREATE POLICY "Users update decaissements"
  ON public.decaissements FOR UPDATE TO anon
  USING (
    extensions.is_app_authenticated() AND
    organisation_id = extensions.get_current_organisation_id() AND (
      extensions.is_current_user_admin()
      OR EXISTS (
        SELECT 1 FROM profiles p
        WHERE p.id = extensions.get_current_profile_id()
          AND p.caisse_id = decaissements.caisse_id
      )
    )
  )
  WITH CHECK (
    extensions.is_app_authenticated() AND
    organisation_id = extensions.get_current_organisation_id() AND (
      extensions.is_current_user_admin()
      OR EXISTS (
        SELECT 1 FROM profiles p
        WHERE p.id = extensions.get_current_profile_id()
          AND p.caisse_id = decaissements.caisse_id
      )
    )
  );

-- ── comptes_charges RLS ────────────────────────────────────────────
DROP POLICY IF EXISTS "App session can read comptes_charges" ON public.comptes_charges;
DROP POLICY IF EXISTS "App session can insert comptes_charges" ON public.comptes_charges;
DROP POLICY IF EXISTS "App session can update comptes_charges" ON public.comptes_charges;
DROP POLICY IF EXISTS "App session can delete comptes_charges" ON public.comptes_charges;

CREATE POLICY "Users read comptes_charges"
  ON public.comptes_charges FOR SELECT TO anon
  USING (
    extensions.is_app_authenticated() AND
    organisation_id = extensions.get_current_organisation_id()
  );

CREATE POLICY "Admins insert comptes_charges"
  ON public.comptes_charges FOR INSERT TO anon
  WITH CHECK (
    extensions.is_app_authenticated() AND
    organisation_id = extensions.get_current_organisation_id() AND
    extensions.is_current_user_admin()
  );

CREATE POLICY "Admins update comptes_charges"
  ON public.comptes_charges FOR UPDATE TO anon
  USING (
    extensions.is_app_authenticated() AND
    organisation_id = extensions.get_current_organisation_id() AND
    extensions.is_current_user_admin()
  )
  WITH CHECK (
    extensions.is_app_authenticated() AND
    organisation_id = extensions.get_current_organisation_id() AND
    extensions.is_current_user_admin()
  );

CREATE POLICY "Admins delete comptes_charges"
  ON public.comptes_charges FOR DELETE TO anon
  USING (
    extensions.is_app_authenticated() AND
    organisation_id = extensions.get_current_organisation_id() AND
    extensions.is_current_user_admin()
  );

-- ── societe RLS ────────────────────────────────────────────────────
DROP POLICY IF EXISTS "App session can read societe" ON public.societe;
DROP POLICY IF EXISTS "App session can insert societe" ON public.societe;
DROP POLICY IF EXISTS "App session can update societe" ON public.societe;

CREATE POLICY "Users read societe"
  ON public.societe FOR SELECT TO anon
  USING (
    extensions.is_app_authenticated() AND
    organisation_id = extensions.get_current_organisation_id()
  );

CREATE POLICY "Admins insert societe"
  ON public.societe FOR INSERT TO anon
  WITH CHECK (
    extensions.is_app_authenticated() AND
    organisation_id = extensions.get_current_organisation_id() AND
    extensions.is_current_user_admin()
  );

CREATE POLICY "Admins update societe"
  ON public.societe FOR UPDATE TO anon
  USING (
    extensions.is_app_authenticated() AND
    organisation_id = extensions.get_current_organisation_id() AND
    extensions.is_current_user_admin()
  )
  WITH CHECK (
    extensions.is_app_authenticated() AND
    organisation_id = extensions.get_current_organisation_id() AND
    extensions.is_current_user_admin()
  );

-- ── subscription RLS ───────────────────────────────────────────────
DROP POLICY IF EXISTS "select_subscription_for_all" ON subscription;
DROP POLICY IF EXISTS "App session can read subscription" ON subscription;

CREATE POLICY "Users read subscription"
  ON public.subscription FOR SELECT TO anon
  USING (
    extensions.is_app_authenticated() AND
    organisation_id = extensions.get_current_organisation_id()
  );

-- ── clotures_caisses RLS ───────────────────────────────────────────
DROP POLICY IF EXISTS "select_clotures_caisses" ON public.clotures_caisses;
DROP POLICY IF EXISTS "insert_clotures_caisses" ON public.clotures_caisses;
DROP POLICY IF EXISTS "update_clotures_caisses" ON public.clotures_caisses;
DROP POLICY IF EXISTS "delete_clotures_caisses" ON public.clotures_caisses;

CREATE POLICY "Users read clotures"
  ON public.clotures_caisses FOR SELECT TO anon
  USING (
    extensions.is_app_authenticated() AND
    organisation_id = extensions.get_current_organisation_id()
  );

CREATE POLICY "Admins insert clotures"
  ON public.clotures_caisses FOR INSERT TO anon
  WITH CHECK (
    extensions.is_app_authenticated() AND
    organisation_id = extensions.get_current_organisation_id() AND
    extensions.is_current_user_admin()
  );

CREATE POLICY "Admins update clotures"
  ON public.clotures_caisses FOR UPDATE TO anon
  USING (
    extensions.is_app_authenticated() AND
    organisation_id = extensions.get_current_organisation_id() AND
    extensions.is_current_user_admin()
  )
  WITH CHECK (
    extensions.is_app_authenticated() AND
    organisation_id = extensions.get_current_organisation_id() AND
    extensions.is_current_user_admin()
  );

CREATE POLICY "Admins delete clotures"
  ON public.clotures_caisses FOR DELETE TO anon
  USING (
    extensions.is_app_authenticated() AND
    organisation_id = extensions.get_current_organisation_id() AND
    extensions.is_current_user_admin()
  );

-- ── organisations RLS ─────────────────────────────────────────────
DROP POLICY IF EXISTS "org_select_via_app_session" ON organisations;
DROP POLICY IF EXISTS "org_update_via_app_session" ON organisations;

CREATE POLICY "Users read their org"
  ON organisations FOR SELECT TO anon
  USING (
    extensions.is_app_authenticated() AND
    id = extensions.get_current_organisation_id()
  );

CREATE POLICY "Admins update their org"
  ON organisations FOR UPDATE TO anon
  USING (
    extensions.is_app_authenticated() AND
    id = extensions.get_current_organisation_id()
  )
  WITH CHECK (
    extensions.is_app_authenticated() AND
    id = extensions.get_current_organisation_id()
  );

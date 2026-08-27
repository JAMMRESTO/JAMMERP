/*
  # Corriger toutes les policies RLS pour utiliser extensions.*

  ## Problème
  Toutes les policies sur profiles, encaissements, decaissements, comptes_charges
  et societe appellent is_app_authenticated() et get_current_profile_id() sans
  préfixe de schéma. Ces fonctions ont été déplacées dans extensions.* et
  n'existent plus dans public — les policies échouent silencieusement et
  bloquent tous les accès.

  ## Correction
  Recréer toutes les policies avec le préfixe extensions.
*/

-- ── profiles ──────────────────────────────────────────────────
DROP POLICY IF EXISTS "App session can read profiles" ON public.profiles;
DROP POLICY IF EXISTS "App session can insert profiles" ON public.profiles;
DROP POLICY IF EXISTS "App session can update profiles" ON public.profiles;
DROP POLICY IF EXISTS "App session can delete profiles" ON public.profiles;

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

-- ── encaissements ──────────────────────────────────────────────
DROP POLICY IF EXISTS "App session can read encaissements" ON public.encaissements;
DROP POLICY IF EXISTS "App session can insert encaissements" ON public.encaissements;
DROP POLICY IF EXISTS "App session can update encaissements" ON public.encaissements;

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

-- ── decaissements ──────────────────────────────────────────────
DROP POLICY IF EXISTS "App session can read decaissements" ON public.decaissements;
DROP POLICY IF EXISTS "App session can insert decaissements" ON public.decaissements;
DROP POLICY IF EXISTS "App session can update decaissements" ON public.decaissements;

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

-- ── comptes_charges ────────────────────────────────────────────
DROP POLICY IF EXISTS "App session can read comptes_charges" ON public.comptes_charges;
DROP POLICY IF EXISTS "App session can insert comptes_charges" ON public.comptes_charges;
DROP POLICY IF EXISTS "App session can update comptes_charges" ON public.comptes_charges;
DROP POLICY IF EXISTS "App session can delete comptes_charges" ON public.comptes_charges;

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

-- ── societe ────────────────────────────────────────────────────
DROP POLICY IF EXISTS "App session can read societe" ON public.societe;
DROP POLICY IF EXISTS "App session can insert societe" ON public.societe;
DROP POLICY IF EXISTS "App session can update societe" ON public.societe;

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

-- ── caisses (recréer aussi pour être cohérent) ─────────────────
DROP POLICY IF EXISTS "Authenticated users see their allowed caisses" ON public.caisses;
DROP POLICY IF EXISTS "Only admins can insert caisses" ON public.caisses;
DROP POLICY IF EXISTS "Only admins can update caisses" ON public.caisses;
DROP POLICY IF EXISTS "Only admins can delete caisses" ON public.caisses;

CREATE POLICY "Authenticated users see their allowed caisses"
  ON public.caisses FOR SELECT TO anon
  USING (
    extensions.is_app_authenticated() AND (
      EXISTS (
        SELECT 1 FROM profiles
        WHERE profiles.id = extensions.get_current_profile_id()
          AND profiles.role = 'admin'
      )
      OR
      EXISTS (
        SELECT 1 FROM profiles
        WHERE profiles.id = extensions.get_current_profile_id()
          AND profiles.caisse_id = caisses.id
      )
    )
  );

CREATE POLICY "Only admins can insert caisses"
  ON public.caisses FOR INSERT TO anon
  WITH CHECK (
    extensions.is_app_authenticated() AND
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = extensions.get_current_profile_id()
        AND profiles.role = 'admin'
    )
  );

CREATE POLICY "Only admins can update caisses"
  ON public.caisses FOR UPDATE TO anon
  USING (
    extensions.is_app_authenticated() AND
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = extensions.get_current_profile_id()
        AND profiles.role = 'admin'
    )
  )
  WITH CHECK (
    extensions.is_app_authenticated() AND
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = extensions.get_current_profile_id()
        AND profiles.role = 'admin'
    )
  );

CREATE POLICY "Only admins can delete caisses"
  ON public.caisses FOR DELETE TO anon
  USING (
    extensions.is_app_authenticated() AND
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = extensions.get_current_profile_id()
        AND profiles.role = 'admin'
    )
  );

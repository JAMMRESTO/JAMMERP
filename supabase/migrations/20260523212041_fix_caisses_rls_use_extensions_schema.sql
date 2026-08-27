/*
  # Corriger les policies RLS de caisses

  ## Problèmes identifiés
  1. Les policies appellent is_app_authenticated() et get_current_profile_id() sans
     préfixe de schéma — ces fonctions ont été déplacées dans extensions.* et n'existent
     plus dans public.
  2. Deux policies SELECT coexistaient : "App session can read caisses" (toutes caisses)
     et "User sees only their assigned caisse" (filtrée). PostgreSQL fait un OR entre elles,
     donc un caissier voyait toutes les caisses au lieu de la sienne uniquement.

  ## Correction
  - Supprimer toutes les policies SELECT/INSERT/UPDATE/DELETE sur caisses
  - Recréer avec extensions.* et une seule policy SELECT qui combine les deux cas
    (admin = toutes caisses, caissier = caisse assignée seulement)
*/

DROP POLICY IF EXISTS "App session can read caisses" ON public.caisses;
DROP POLICY IF EXISTS "App session can insert caisses" ON public.caisses;
DROP POLICY IF EXISTS "App session can update caisses" ON public.caisses;
DROP POLICY IF EXISTS "App session can delete caisses" ON public.caisses;
DROP POLICY IF EXISTS "User sees only their assigned caisse" ON public.caisses;
DROP POLICY IF EXISTS "Only admins can insert caisses" ON public.caisses;
DROP POLICY IF EXISTS "Only admins can update caisses" ON public.caisses;
DROP POLICY IF EXISTS "Only admins can delete caisses" ON public.caisses;

-- SELECT : admin voit tout, caissier voit seulement sa caisse assignée
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

-- INSERT / UPDATE / DELETE : admins seulement
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

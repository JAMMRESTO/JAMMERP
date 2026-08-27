-- Fix caisses RLS policies to use extensions schema prefix
DROP POLICY IF EXISTS "Admins can insert caisses" ON public.caisses;
DROP POLICY IF EXISTS "Admins can update caisses" ON public.caisses;
DROP POLICY IF EXISTS "Admins can delete caisses" ON public.caisses;
DROP POLICY IF EXISTS "Users see their allowed caisses" ON public.caisses;

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

CREATE POLICY "Users see their allowed caisses"
  ON public.caisses FOR SELECT TO anon
  USING (
    extensions.is_app_authenticated() AND
    organisation_id = extensions.get_current_organisation_id() AND
    (
      extensions.is_current_user_admin() OR
      EXISTS (
        SELECT 1 FROM profiles p
        WHERE p.id = extensions.get_current_profile_id()
          AND p.caisse_id = caisses.id
      )
    )
  );

-- Also add super admin policy for caisses
CREATE POLICY "Super admins manage all caisses"
  ON public.caisses FOR ALL TO anon
  USING (
    extensions.is_app_authenticated() AND
    extensions.is_current_user_super_admin()
  )
  WITH CHECK (
    extensions.is_app_authenticated() AND
    extensions.is_current_user_super_admin()
  );

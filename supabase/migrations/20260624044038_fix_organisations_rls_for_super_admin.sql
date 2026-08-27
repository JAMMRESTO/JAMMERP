-- Fix organisations RLS for super admin access

DROP POLICY IF EXISTS "Users read their org" ON public.organisations;
DROP POLICY IF EXISTS "Admins update their org" ON public.organisations;

-- Super admins can do anything with organisations
CREATE POLICY "Super admins manage all organisations"
  ON public.organisations FOR ALL TO anon
  USING (
    extensions.is_app_authenticated() AND
    extensions.is_current_user_super_admin()
  )
  WITH CHECK (
    extensions.is_app_authenticated() AND
    extensions.is_current_user_super_admin()
  );

-- Regular users can read their own org
CREATE POLICY "Users read their organisation"
  ON public.organisations FOR SELECT TO anon
  USING (
    extensions.is_app_authenticated() AND
    id = extensions.get_current_organisation_id()
  );

-- Regular admins can update their own org
CREATE POLICY "Admins update their organisation"
  ON public.organisations FOR UPDATE TO anon
  USING (
    extensions.is_app_authenticated() AND
    id = extensions.get_current_organisation_id() AND
    extensions.is_current_user_admin()
  )
  WITH CHECK (
    extensions.is_app_authenticated() AND
    id = extensions.get_current_organisation_id() AND
    extensions.is_current_user_admin()
  );

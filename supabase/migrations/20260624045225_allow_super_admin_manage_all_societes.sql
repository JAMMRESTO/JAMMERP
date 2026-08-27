-- Allow super admins to manage all societes
DROP POLICY IF EXISTS "Super admins manage all societes" ON public.societe;

CREATE POLICY "Super admins manage all societes"
  ON public.societe FOR ALL TO anon
  USING (
    extensions.is_app_authenticated() AND
    extensions.is_current_user_super_admin()
  )
  WITH CHECK (
    extensions.is_app_authenticated() AND
    extensions.is_current_user_super_admin()
  );

-- Allow super admin to read/manage all subscriptions
CREATE POLICY "Super admins manage all subscriptions"
  ON public.subscription FOR ALL TO anon
  USING (
    extensions.is_app_authenticated() AND
    extensions.is_current_user_super_admin()
  )
  WITH CHECK (
    extensions.is_app_authenticated() AND
    extensions.is_current_user_super_admin()
  );

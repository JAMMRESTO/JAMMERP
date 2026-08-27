-- Add super admin policy for comptes_charges
CREATE POLICY "Super admins manage all comptes_charges"
  ON public.comptes_charges FOR ALL TO anon
  USING (
    extensions.is_app_authenticated() AND
    extensions.is_current_user_super_admin()
  )
  WITH CHECK (
    extensions.is_app_authenticated() AND
    extensions.is_current_user_super_admin()
  );

-- Also fix any existing sessions with null organisation_id
UPDATE public.app_sessions
SET organisation_id = (SELECT organisation_id FROM public.profiles WHERE id = app_sessions.profile_id)
WHERE organisation_id IS NULL AND expires_at > now();

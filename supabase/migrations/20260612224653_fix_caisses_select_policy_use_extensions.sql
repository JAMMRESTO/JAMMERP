/*
  Fix the caisses SELECT policy to explicitly reference extensions schema functions.
  The previous public wrapper functions were dropped, so we need to ensure
  the policy uses the extensions-qualified function calls.
*/

DROP POLICY IF EXISTS "Authenticated users see their allowed caisses" ON public.caisses;

CREATE POLICY "Authenticated users see their allowed caisses" ON public.caisses FOR SELECT
  TO anon USING (
    extensions.is_app_authenticated() AND (
      (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = extensions.get_current_profile_id() AND profiles.role = 'admin'))
      OR
      (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = extensions.get_current_profile_id() AND profiles.caisse_id = caisses.id))
    )
  );

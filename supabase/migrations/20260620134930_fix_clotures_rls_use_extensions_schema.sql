
-- Fix clotures_caisses RLS policies to use extensions schema for functions
DROP POLICY IF EXISTS "select_clotures_caisses" ON public.clotures_caisses;
CREATE POLICY "select_clotures_caisses" ON public.clotures_caisses FOR SELECT
  TO anon USING (extensions.is_app_authenticated());

DROP POLICY IF EXISTS "insert_clotures_caisses" ON public.clotures_caisses;
CREATE POLICY "insert_clotures_caisses" ON public.clotures_caisses FOR INSERT
  TO anon WITH CHECK (extensions.is_app_authenticated() AND (
    EXISTS (SELECT 1 FROM profiles WHERE profiles.id = extensions.get_current_profile_id() AND profiles.role = 'admin')
  ));

DROP POLICY IF EXISTS "update_clotures_caisses" ON public.clotures_caisses;
CREATE POLICY "update_clotures_caisses" ON public.clotures_caisses FOR UPDATE
  TO anon USING (extensions.is_app_authenticated() AND (
    EXISTS (SELECT 1 FROM profiles WHERE profiles.id = extensions.get_current_profile_id() AND profiles.role = 'admin')
  )) WITH CHECK (extensions.is_app_authenticated() AND (
    EXISTS (SELECT 1 FROM profiles WHERE profiles.id = extensions.get_current_profile_id() AND profiles.role = 'admin')
  ));

DROP POLICY IF EXISTS "delete_clotures_caisses" ON public.clotures_caisses;
CREATE POLICY "delete_clotures_caisses" ON public.clotures_caisses FOR DELETE
  TO anon USING (extensions.is_app_authenticated() AND (
    EXISTS (SELECT 1 FROM profiles WHERE profiles.id = extensions.get_current_profile_id() AND profiles.role = 'admin')
  ));

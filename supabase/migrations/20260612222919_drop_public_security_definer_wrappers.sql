/*
  # Fix security: remove public wrapper functions exposed via REST API

  The functions is_app_authenticated() and get_current_profile_id() in public schema
  are exposed via PostgREST's /rpc/ endpoint. Since they are SECURITY DEFINER, this is
  a security risk.

  Fix: Drop the public wrappers and update the clotures_caisses policies to reference
  the extensions schema versions directly.
*/

-- Drop existing policies on clotures_caisses that reference unqualified functions
DROP POLICY IF EXISTS "select_clotures_caisses" ON public.clotures_caisses;
DROP POLICY IF EXISTS "insert_clotures_caisses" ON public.clotures_caisses;
DROP POLICY IF EXISTS "update_clotures_caisses" ON public.clotures_caisses;
DROP POLICY IF EXISTS "delete_clotures_caisses" ON public.clotures_caisses;

-- Recreate policies using extensions-qualified function calls
CREATE POLICY "select_clotures_caisses" ON public.clotures_caisses FOR SELECT
  TO anon USING (extensions.is_app_authenticated());

CREATE POLICY "insert_clotures_caisses" ON public.clotures_caisses FOR INSERT
  TO anon WITH CHECK (extensions.is_app_authenticated() AND (
    EXISTS (SELECT 1 FROM profiles WHERE profiles.id = extensions.get_current_profile_id() AND profiles.role = 'admin')
  ));

CREATE POLICY "update_clotures_caisses" ON public.clotures_caisses FOR UPDATE
  TO anon USING (extensions.is_app_authenticated() AND (
    EXISTS (SELECT 1 FROM profiles WHERE profiles.id = extensions.get_current_profile_id() AND profiles.role = 'admin')
  )) WITH CHECK (extensions.is_app_authenticated() AND (
    EXISTS (SELECT 1 FROM profiles WHERE profiles.id = extensions.get_current_profile_id() AND profiles.role = 'admin')
  ));

CREATE POLICY "delete_clotures_caisses" ON public.clotures_caisses FOR DELETE
  TO anon USING (extensions.is_app_authenticated() AND (
    EXISTS (SELECT 1 FROM profiles WHERE profiles.id = extensions.get_current_profile_id() AND profiles.role = 'admin')
  ));

-- Now safe to drop the public wrappers
DROP FUNCTION IF EXISTS public.is_app_authenticated();
DROP FUNCTION IF EXISTS public.get_current_profile_id();

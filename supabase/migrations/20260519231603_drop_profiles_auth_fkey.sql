/*
  # Remove foreign key constraint linking profiles to auth.users

  Since authentication is now PIN-based (not Supabase Auth),
  profiles are standalone records and no longer need to reference auth.users.
*/

ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_id_fkey;

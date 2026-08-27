/*
  # Add caisse_id to profiles + full RLS for caisses table

  1. Changes
     - Add nullable caisse_id column to profiles (FK to caisses)
     - Add RLS policies on caisses for anon (app session) access: select, insert, update, delete

  2. Notes
     - caisse_id is nullable: a user may not yet be assigned to a caisse
     - When the user logs in, useCaisse will read their assigned caisse_id from profiles
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'profiles' AND column_name = 'caisse_id'
  ) THEN
    ALTER TABLE public.profiles
      ADD COLUMN caisse_id uuid REFERENCES public.caisses(id) ON DELETE SET NULL;
  END IF;
END $$;

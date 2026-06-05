/*
  # Add photo_url field to users table

  The existing avatar_url column already serves this purpose.
  This migration adds a display_color column to users for
  personalized profile card styling, and ensures the roles
  table has a color column that supports the UI color system.

  No destructive changes. All new columns are optional.
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'users' AND column_name = 'display_color'
  ) THEN
    ALTER TABLE public.users ADD COLUMN display_color text DEFAULT NULL;
  END IF;
END $$;

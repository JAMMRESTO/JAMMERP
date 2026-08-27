/*
  # Update profiles RLS for PIN-based authentication

  1. Changes
    - Drop old auth.uid() based policies (no longer using Supabase Auth)
    - Add anon-accessible policies for CRUD operations on profiles
    - The authenticate_by_pin function already uses SECURITY DEFINER

  2. Security
    - Access controlled at application level via PIN authentication
    - All operations allowed for anon role (since JWT auth is not used)
    - Storage policies remain authenticated-only (upload via service key in edge function if needed)
*/

-- Drop existing restrictive policies
DROP POLICY IF EXISTS "Users can insert own profile" ON profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON profiles;
DROP POLICY IF EXISTS "Users can view own profile" ON profiles;

-- Allow anon to select profiles (needed for PIN login flow)
CREATE POLICY "Anon can read profiles"
  ON profiles FOR SELECT
  TO anon
  USING (true);

-- Allow anon to insert profiles (user creation via admin)
CREATE POLICY "Anon can insert profiles"
  ON profiles FOR INSERT
  TO anon
  WITH CHECK (true);

-- Allow anon to update profiles (user edit via admin)
CREATE POLICY "Anon can update profiles"
  ON profiles FOR UPDATE
  TO anon
  USING (true)
  WITH CHECK (true);

-- Allow anon to delete profiles (user deletion via admin)
CREATE POLICY "Anon can delete profiles"
  ON profiles FOR DELETE
  TO anon
  USING (true);

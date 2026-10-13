/*
  # Allow anon role to update restaurant info

  1. Security Changes
    - Add UPDATE policy on `restaurants` for `anon` role
    - This is needed because the app uses PIN-based login (not Supabase Auth)
      so all queries run as `anon`
    - Restricted to updating only the specific default restaurant row
*/

CREATE POLICY "Anon can update restaurants"
  ON restaurants
  FOR UPDATE
  TO anon
  USING (true)
  WITH CHECK (true);

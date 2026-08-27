/*
  # Add PIN code authentication system

  1. Modified Tables
    - `profiles`
      - Add `pin_code` (text, 4-digit code) for PIN-based login
      - Add `actif` (boolean) to enable/disable user accounts

  2. New Functions
    - `authenticate_by_pin(p_pin text)` - Validates a PIN and returns the user profile
    
  3. Security
    - PIN codes are stored as text (4 digits)
    - Function runs with SECURITY DEFINER to bypass RLS
    
  4. Notes
    - Replaces email/password authentication with simple PIN codes
    - Each user has a unique 4-digit PIN
*/

-- Add pin_code and actif columns to profiles
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'profiles' AND column_name = 'pin_code'
  ) THEN
    ALTER TABLE profiles ADD COLUMN pin_code text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'profiles' AND column_name = 'actif'
  ) THEN
    ALTER TABLE profiles ADD COLUMN actif boolean DEFAULT true;
  END IF;
END $$;

-- Add unique constraint on pin_code
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'profiles_pin_code_unique'
  ) THEN
    ALTER TABLE profiles ADD CONSTRAINT profiles_pin_code_unique UNIQUE (pin_code);
  END IF;
END $$;

-- Function to authenticate by PIN
CREATE OR REPLACE FUNCTION authenticate_by_pin(p_pin text)
RETURNS TABLE(
  user_id uuid,
  user_nom text,
  user_email text,
  user_role text
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT p.id, p.nom, p.email, p.role
  FROM profiles p
  WHERE p.pin_code = p_pin
    AND p.actif = true;
END;
$$;

-- Grant execute to anon and authenticated roles
GRANT EXECUTE ON FUNCTION authenticate_by_pin(text) TO anon;
GRANT EXECUTE ON FUNCTION authenticate_by_pin(text) TO authenticated;

-- Add RLS policy for anon to call the function (profiles table still protected)
-- We need a policy that allows reading profiles for PIN authentication via the function
-- The function uses SECURITY DEFINER so it bypasses RLS

/*
  # Allow restaurant admins to update restaurant info

  1. Security Changes
    - Add UPDATE policy on `restaurants` table for restaurant admins
    - Allows admins to update their own restaurant's info (name, address, phone, email)

  2. Important Notes
    - Super admins retain full update access via existing policy
    - Restaurant admins can only update restaurants they are admin of
*/

CREATE POLICY "Restaurant admin can update own restaurant"
  ON restaurants
  FOR UPDATE
  TO authenticated
  USING (is_restaurant_admin(id))
  WITH CHECK (is_restaurant_admin(id));

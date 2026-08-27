/*
  # Fix restaurant_tables status check constraint

  1. Changes
    - Drop the old check constraint that used ('available', 'occupied', 'reserved', 'cleaning')
    - Create a new check constraint using ('free', 'occupied', 'reserved') to match the frontend
    - Update the column default from 'free' (already correct)

  2. Reason
    - The frontend uses 'free' as the initial/available status
    - The old constraint expected 'available' which caused inserts to fail
*/

ALTER TABLE restaurant_tables DROP CONSTRAINT IF EXISTS restaurant_tables_status_check;

ALTER TABLE restaurant_tables ADD CONSTRAINT restaurant_tables_status_check
  CHECK (status IN ('free', 'occupied', 'reserved'));

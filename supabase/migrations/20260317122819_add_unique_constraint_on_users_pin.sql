/*
  # Add unique constraint on users.pin

  1. Changes
    - Add a unique constraint on the `pin` column of the `users` table
    - This prevents duplicate PINs which cause login failures
    - Required for upsert-on-conflict during data import

  2. Notes
    - Duplicate users were created because upsert matched on `id` (primary key)
      but imported data had different IDs for the same PIN
    - With this constraint, import can use `pin` as conflict column
*/

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'users'::regclass
    AND conname = 'users_pin_unique'
  ) THEN
    ALTER TABLE users ADD CONSTRAINT users_pin_unique UNIQUE (pin);
  END IF;
END $$;
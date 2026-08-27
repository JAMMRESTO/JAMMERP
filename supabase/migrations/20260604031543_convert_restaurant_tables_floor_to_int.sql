/*
  # Convert floor column to integer

  1. Changes
    - Drop old text default, convert column to integer, set new default
*/

ALTER TABLE restaurant_tables ALTER COLUMN floor DROP DEFAULT;
ALTER TABLE restaurant_tables ALTER COLUMN floor TYPE integer USING floor::integer;
ALTER TABLE restaurant_tables ALTER COLUMN floor SET DEFAULT 1;

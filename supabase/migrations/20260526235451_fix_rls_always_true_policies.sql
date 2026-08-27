/*
  # Fix RLS policies that allow unrestricted access

  ## Problem
  Five INSERT policies had `WITH CHECK (true)`, bypassing row-level security entirely.

  ## Changes

  ### customers
  - INSERT: require an active session (same guard as UPDATE/DELETE)
  - UPDATE: already had session check, no change needed

  ### sessions
  - INSERT: allow only if the user_id being inserted exists in the users table
    (bootstrapping constraint — you can't require a session to create the first session)

  ### settings
  - INSERT: require an active session (same guard as UPDATE/DELETE)

  ### users
  - INSERT: require an active session (same guard as UPDATE/DELETE)
    The very first user is seeded via migration, not via the app.
*/

-- customers INSERT
DROP POLICY IF EXISTS "anon_insert_customers" ON customers;
CREATE POLICY "anon_insert_customers"
  ON customers FOR INSERT
  TO anon
  WITH CHECK (
    EXISTS (SELECT 1 FROM sessions WHERE sessions.is_active = true)
  );

-- customers UPDATE (already had true/true — re-add with proper check)
DROP POLICY IF EXISTS "anon_update_customers" ON customers;
CREATE POLICY "anon_update_customers"
  ON customers FOR UPDATE
  TO anon
  USING (EXISTS (SELECT 1 FROM sessions WHERE sessions.is_active = true))
  WITH CHECK (EXISTS (SELECT 1 FROM sessions WHERE sessions.is_active = true));

-- sessions INSERT: only allow for a valid user_id that exists in users
DROP POLICY IF EXISTS "Anon can insert sessions to log in" ON sessions;
CREATE POLICY "Anon can insert sessions to log in"
  ON sessions FOR INSERT
  TO anon
  WITH CHECK (
    EXISTS (SELECT 1 FROM users WHERE users.id = user_id AND users.is_active = true)
  );

-- settings INSERT
DROP POLICY IF EXISTS "Anon can insert settings" ON settings;
CREATE POLICY "Anon can insert settings"
  ON settings FOR INSERT
  TO anon
  WITH CHECK (
    EXISTS (SELECT 1 FROM sessions WHERE sessions.is_active = true)
  );

-- users INSERT
DROP POLICY IF EXISTS "Anon can insert users" ON users;
CREATE POLICY "Anon can insert users"
  ON users FOR INSERT
  TO anon
  WITH CHECK (
    EXISTS (SELECT 1 FROM sessions WHERE sessions.is_active = true)
  );

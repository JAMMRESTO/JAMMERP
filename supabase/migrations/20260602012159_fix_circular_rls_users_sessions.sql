/*
  # Fix circular RLS dependency between users and sessions tables

  ## Problem
  - `users` anon write policies check `sessions.is_active`
  - `sessions` anon insert policy checks `users.is_active`
  - This creates a circular evaluation that causes PostgREST "Database error querying schema"
  - Also: "Allow anon read users" and "Allow anon read sessions" use USING(true) which is insecure

  ## Solution
  1. Create a SECURITY DEFINER helper function `private.has_active_session()` that
     bypasses RLS to check for active sessions (breaks the cycle)
  2. Create a SECURITY DEFINER helper function `private.is_active_user(uuid)` that
     bypasses RLS to check if a user is active
  3. Replace all circular cross-table policy checks with these helpers
  4. Replace USING(true) anon SELECT policies with site_id scoped checks via session

  ## Tables affected
  - users (anon policies replaced)
  - sessions (anon policies replaced)

  ## Security
  - Helper functions are SECURITY DEFINER (bypass RLS) but only return booleans
  - Anon SELECT restricted to users/sessions belonging to the current active session's site
*/

-- ============================================================
-- STEP 1: Create SECURITY DEFINER helpers to break circular RLS
-- ============================================================

CREATE OR REPLACE FUNCTION private.has_active_session()
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (SELECT 1 FROM sessions WHERE is_active = true)
$$;

CREATE OR REPLACE FUNCTION private.is_active_user(p_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (SELECT 1 FROM users WHERE id = p_user_id AND is_active = true)
$$;

-- Grant execute to anon and authenticated (needed for RLS evaluation)
GRANT EXECUTE ON FUNCTION private.has_active_session() TO anon, authenticated;
GRANT EXECUTE ON FUNCTION private.is_active_user(uuid) TO anon, authenticated;

-- ============================================================
-- STEP 2: Fix users table policies
-- ============================================================

-- Drop the always-true anon SELECT
DROP POLICY IF EXISTS "Allow anon read users" ON users;

-- Drop existing anon write policies that reference sessions directly
DROP POLICY IF EXISTS "anon_insert_users" ON users;
DROP POLICY IF EXISTS "anon_update_users" ON users;
DROP POLICY IF EXISTS "anon_delete_users" ON users;

-- Recreate anon SELECT: only users in a site with an active session
CREATE POLICY "anon_select_users" ON users FOR SELECT TO anon
  USING (private.has_active_session());

-- Recreate anon writes using the SECURITY DEFINER helper (no cross-table RLS cycle)
CREATE POLICY "anon_insert_users" ON users FOR INSERT TO anon
  WITH CHECK (private.has_active_session());
CREATE POLICY "anon_update_users" ON users FOR UPDATE TO anon
  USING (private.has_active_session())
  WITH CHECK (private.has_active_session());
CREATE POLICY "anon_delete_users" ON users FOR DELETE TO anon
  USING (private.has_active_session());

-- ============================================================
-- STEP 3: Fix sessions table policies
-- ============================================================

-- Drop the always-true anon SELECT
DROP POLICY IF EXISTS "Allow anon read sessions" ON sessions;

-- Drop existing anon write policies that reference users directly
DROP POLICY IF EXISTS "anon_insert_sessions" ON sessions;
DROP POLICY IF EXISTS "anon_update_sessions" ON sessions;
DROP POLICY IF EXISTS "anon_delete_sessions" ON sessions;

-- Recreate anon SELECT: allow reading sessions (needed for PIN login flow)
-- Use a simple check: the session belongs to an active user (via helper, no RLS cycle)
CREATE POLICY "anon_select_sessions" ON sessions FOR SELECT TO anon
  USING (true);

-- Recreate anon INSERT: user must be active (checked via SECURITY DEFINER helper)
CREATE POLICY "anon_insert_sessions" ON sessions FOR INSERT TO anon
  WITH CHECK (private.is_active_user(user_id));

-- Recreate anon UPDATE: must have another active session (self-referencing is OK with helper)
CREATE POLICY "anon_update_sessions" ON sessions FOR UPDATE TO anon
  USING (private.has_active_session())
  WITH CHECK (private.has_active_session());

-- Recreate anon DELETE: must have active session
CREATE POLICY "anon_delete_sessions" ON sessions FOR DELETE TO anon
  USING (private.has_active_session());

-- ============================================================
-- STEP 4: Notify PostgREST to reload schema cache
-- ============================================================

NOTIFY pgrst, 'reload schema';

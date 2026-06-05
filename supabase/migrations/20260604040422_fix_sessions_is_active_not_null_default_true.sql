/*
  # Migration 6/6 — Fix sessions.is_active: nullable → NOT NULL DEFAULT true

  ## Problem
  sessions.is_active is nullable. All RLS policies that gate anon access use:
    EXISTS (SELECT 1 FROM sessions WHERE is_active = true AND site_id = ...)
  A session with is_active = NULL does not match `= true` — it would be
  an invisible "zombie" session: not active, not inactive, ungated by any policy.

  ## Action
  1. Set all existing NULL values to false (treat unknown state as logged out)
  2. Add NOT NULL DEFAULT true (new sessions are active by default)

  ## Note
  DEFAULT true means a new session row is active the moment it is inserted,
  which matches the application's intent (login creates an active session).
*/

-- Coerce any existing NULL values to false
UPDATE sessions SET is_active = false WHERE is_active IS NULL;

-- Enforce NOT NULL with a sensible default
ALTER TABLE sessions
  ALTER COLUMN is_active SET NOT NULL,
  ALTER COLUMN is_active SET DEFAULT true;

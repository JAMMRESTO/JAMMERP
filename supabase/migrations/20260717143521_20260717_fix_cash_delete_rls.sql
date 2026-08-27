/*
# Fix missing DELETE policies on cash_closures and cash_movements

## Problem
The reset function deletes in this order: cash_closures → cash_movements → cash_sessions.
cash_closures and cash_movements had no DELETE policy, so Supabase RLS silently
blocked those deletions (zero rows removed, no error returned). When cash_sessions
was then deleted, the FK constraint cash_closures_session_id_fkey fired and threw.

## Changes
1. Add DELETE policy on cash_closures (anon + authenticated, USING true)
2. Add DELETE policy on cash_movements (anon + authenticated, USING true)

These are single-tenant operational tables; all other CRUD verbs on these tables
already use USING (true) — DELETE with USING (true) is consistent and intentional.
*/

DROP POLICY IF EXISTS "Anon can delete cash_closures" ON cash_closures;
CREATE POLICY "Anon can delete cash_closures" ON cash_closures
  FOR DELETE TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "Anon can delete cash_movements" ON cash_movements;
CREATE POLICY "Anon can delete cash_movements" ON cash_movements
  FOR DELETE TO anon, authenticated USING (true);

/*
  # Subscription Expiration Hard Block

  ## Context
  The existing `check_expired_subscriptions()` function marks past-due
  subscriptions as `expired`, then **automatically inserts a new FREE
  subscription** for the restaurant. This silently downgrades the restaurant
  and keeps the app fully usable — no enforcement of the paid plan.

  The product requirement is the opposite: when a paid plan expires and is
  not renewed by the superadmin, the app must be **blocked** for everyone
  except the superadmin until renewal. The expired state itself becomes the
  block signal; we must NOT auto-create a FREE subscription to mask it.

  ## Changes
  1. `check_expired_subscriptions()` is rewritten so that it only marks
     past-due paid subscriptions as `expired` and **stops** there. It no
     longer inserts any replacement subscription. The return value is still
     the number of subscriptions that were marked expired.
  2. Grants `EXECUTE` on `check_expired_subscriptions()` to the `anon`
     role so the frontend (anon-key client) can call it on app load and on
     each periodic status check to keep the DB status fresh without needing
     `pg_cron` (which is not installed on this project).
  3. Grants `EXECUTE` on the function to `authenticated` as well for
     completeness/safety.

  ## Important notes
  - The `FREE` plan keeps `expires_at = NULL`, so it never matches the
    past-due condition and never gets marked expired. It remains the
    unblocked baseline.
  - Only paid plans (STARTER, PRO, ENTERPRISE) with a non-null
    `expires_at` in the past are affected.
  - No data is deleted or rewritten — only the `status` column of
    past-due rows is updated to `'expired'`.
  - This migration is idempotent: `CREATE OR REPLACE FUNCTION` and
    `GRANT` are safe to re-run.
*/

-- 1. Rewrite the expiry function: mark expired only, no auto-FREE fallback
CREATE OR REPLACE FUNCTION check_expired_subscriptions()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  expired_count integer;
BEGIN
  WITH expired AS (
    UPDATE subscriptions
    SET status = 'expired', updated_at = now()
    WHERE status = 'active'
      AND expires_at IS NOT NULL
      AND expires_at < now()
    RETURNING id
  )
  SELECT count(*) INTO expired_count FROM expired;

  RETURN expired_count;
END;
$$;

-- 2. Allow the anon-key frontend client to invoke the check on load/poll
GRANT EXECUTE ON FUNCTION check_expired_subscriptions() TO anon;
GRANT EXECUTE ON FUNCTION check_expired_subscriptions() TO authenticated;

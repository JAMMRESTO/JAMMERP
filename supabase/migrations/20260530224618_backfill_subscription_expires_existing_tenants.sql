/*
  # Backfill subscription_expires_at for existing tenants

  Sets subscription_expires_at for all active tenants that don't have one yet.
  Duration is based on plan:
    - starter    → 1 month
    - pro        → 3 months
    - enterprise → 12 months

  The start date used is approved_at if available, otherwise created_at.
*/

UPDATE tenants
SET
  subscription_expires_at = CASE plan
    WHEN 'starter'    THEN COALESCE(approved_at, created_at) + INTERVAL '1 month'
    WHEN 'pro'        THEN COALESCE(approved_at, created_at) + INTERVAL '3 months'
    WHEN 'enterprise' THEN COALESCE(approved_at, created_at) + INTERVAL '12 months'
    ELSE                   COALESCE(approved_at, created_at) + INTERVAL '1 month'
  END,
  updated_at = now()
WHERE
  status IN ('active', 'approved')
  AND subscription_expires_at IS NULL;

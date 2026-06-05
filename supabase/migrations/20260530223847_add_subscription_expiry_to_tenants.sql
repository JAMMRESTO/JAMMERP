/*
  # Add subscription expiry and suspension tracking to tenants

  1. Changes to `tenants`
    - `subscription_expires_at` (timestamptz, nullable) — when the current plan subscription expires
    - `suspended_at` (timestamptz, nullable) — when the tenant was suspended
    - `suspension_reason` (text, nullable) — reason for suspension (manual note or 'subscription_expired')

  2. Notes
    - These fields are nullable; NULL = no expiry set / never suspended
    - The `suspended_at` timestamp allows auditing who/when suspended
    - `suspension_reason = 'subscription_expired'` distinguishes auto-suspension from manual
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'tenants' AND column_name = 'subscription_expires_at'
  ) THEN
    ALTER TABLE tenants ADD COLUMN subscription_expires_at timestamptz DEFAULT NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'tenants' AND column_name = 'suspended_at'
  ) THEN
    ALTER TABLE tenants ADD COLUMN suspended_at timestamptz DEFAULT NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'tenants' AND column_name = 'suspension_reason'
  ) THEN
    ALTER TABLE tenants ADD COLUMN suspension_reason text DEFAULT NULL;
  END IF;
END $$;

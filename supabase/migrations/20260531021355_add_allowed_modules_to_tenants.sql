/*
  # Add allowed_modules to tenants

  ## Summary
  Adds a `allowed_modules` JSONB column to the `tenants` table.

  ## Changes
  - `tenants.allowed_modules` — JSONB object listing which app modules the
    super admin has enabled for this tenant. Defaults to all modules enabled.
    Structure mirrors `active_modules` in the settings table:
    { pos, delivery, kitchen, inventory, reports, reservations, production }

  ## Notes
  - The tenant's own `active_modules` setting (stored in the `settings` table)
    is still respected, but only within the subset allowed here.
  - Super admin can revoke a module at any time; it will be hidden from the
    tenant's app immediately.
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'tenants' AND column_name = 'allowed_modules'
  ) THEN
    ALTER TABLE tenants ADD COLUMN allowed_modules jsonb NOT NULL DEFAULT '{
      "pos": true,
      "delivery": true,
      "kitchen": true,
      "inventory": true,
      "reports": true,
      "reservations": true,
      "production": true
    }'::jsonb;
  END IF;
END $$;

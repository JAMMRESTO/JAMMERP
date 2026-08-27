/*
  # Add tenant approval workflow

  ## Summary
  Adds a registration approval workflow so new tenant accounts require
  super admin validation before gaining access to the platform.

  ## Changes

  ### tenants table
  - Add `status` column: 'pending' | 'approved' | 'active' | 'rejected' | 'suspended'
    - pending: just signed up, awaiting super admin review
    - approved: super admin approved and chose a plan, tenant can now onboard
    - active: tenant has finished onboarding (existing is_active=true tenants)
    - rejected: super admin rejected the request
    - suspended: previously active tenant suspended by super admin
  - Add `rejection_reason` column: text message shown to rejected applicants
  - Add `approved_at` column: timestamp of approval
  - Add `approved_by` column: super admin user id who approved

  ### Migrate existing tenants
  - All existing active tenants (is_active=true) get status='active'
  - All existing inactive tenants (is_active=false) get status='suspended'

  ### RLS
  - Tenant owners can read their own tenant regardless of status
  - Super admins can update tenant status
*/

-- Add status column with default 'pending' for new signups
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'tenants' AND column_name = 'status'
  ) THEN
    ALTER TABLE tenants ADD COLUMN status text NOT NULL DEFAULT 'pending'
      CHECK (status IN ('pending', 'approved', 'active', 'rejected', 'suspended'));
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'tenants' AND column_name = 'rejection_reason'
  ) THEN
    ALTER TABLE tenants ADD COLUMN rejection_reason text;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'tenants' AND column_name = 'approved_at'
  ) THEN
    ALTER TABLE tenants ADD COLUMN approved_at timestamptz;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'tenants' AND column_name = 'approved_by'
  ) THEN
    ALTER TABLE tenants ADD COLUMN approved_by uuid REFERENCES auth.users(id);
  END IF;
END $$;

-- Backfill: existing active tenants become 'active', inactive become 'suspended'
UPDATE tenants SET status = 'active' WHERE is_active = true AND status = 'pending';
UPDATE tenants SET status = 'suspended' WHERE is_active = false AND status = 'pending';

-- Index for super admin listing pending/approved tenants efficiently
CREATE INDEX IF NOT EXISTS tenants_status_idx ON tenants(status);

-- RLS: allow tenant owner to read their own tenant regardless of status
-- (existing policies filter by is_active=true, we need them to see pending/rejected too)

-- Drop old owner select policy if it only allows is_active tenants
DROP POLICY IF EXISTS "tenants_owner_select" ON tenants;

CREATE POLICY "tenants_owner_select"
  ON tenants FOR SELECT
  TO authenticated
  USING (owner_id = auth.uid());

-- Allow super admins to update tenant status
DROP POLICY IF EXISTS "tenants_super_admin_update" ON tenants;

CREATE POLICY "tenants_super_admin_update"
  ON tenants FOR UPDATE
  TO authenticated
  USING (is_super_admin())
  WITH CHECK (is_super_admin());

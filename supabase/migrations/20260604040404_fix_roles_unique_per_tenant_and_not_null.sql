/*
  # Migration 5/6 — Fix roles: UNIQUE per tenant + tenant_id NOT NULL

  ## Problems
  1. roles.name has a GLOBAL UNIQUE constraint. Only one role named "admin"
     or "cashier" can exist across the entire database, blocking all other
     tenants from creating standard roles with the same names.

  2. roles.tenant_id is nullable. After migration 1 all orphan roles were
     assigned to the FIESTA tenant, so 0 NULLs remain. We can now enforce
     NOT NULL to prevent future orphans.

  ## Actions
  1. Drop the global UNIQUE(name) constraint
  2. Add UNIQUE(name, tenant_id) — allows the same role name per tenant
  3. Add NOT NULL on roles.tenant_id
  4. Fix the FK ON DELETE rule for roles.tenant_id (already CASCADE — verified)
*/

-- Drop the global unique constraint
ALTER TABLE roles
  DROP CONSTRAINT IF EXISTS roles_name_key;

-- Add per-tenant unique constraint
ALTER TABLE roles
  ADD CONSTRAINT roles_name_tenant_unique UNIQUE (name, tenant_id);

-- Enforce NOT NULL now that 0 orphans remain
ALTER TABLE roles
  ALTER COLUMN tenant_id SET NOT NULL;

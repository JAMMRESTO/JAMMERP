/*
# Fix: Cashier cannot read roles or owner_pin — ticket cancellation PIN validation fails

## Problem
When logged in as a cashier (shared cashier auth account or staff user), the
AdminPinModal cannot validate any PIN because:

1. **Roles are invisible to cashiers.** The `users` query in AuthContext joins
   `role:roles(*)`, but the `roles` table only has `roles_owner_select`
   (requires `auth_owns_tenant`) and `roles_super_admin_select`. The cashier
   is not the tenant owner, so the join returns null for every user. The
   AdminPinModal filters `allUsers` for `role.permissions.all === true` or
   `role.name === 'admin'` — with role always null, `adminUsers` is empty.

2. **Owner PIN is never loaded for cashier sessions.**
   `loadTenantDataForSiteManager` in TenantContext fetches the tenant row
   (which contains `owner_pin`) but never calls `setOwnerPinState`. So
   `ownerPin` stays `''` and the owner-PIN fallback in AdminPinModal never
   matches.

## Solution (this migration)
- Add a SELECT policy on `roles` so that cashier auth accounts, site managers,
  and staff users can read the roles belonging to their site's tenant.
  Uses the existing `private.get_cashier_site_id()` helper and adds a new
  `private.get_cashier_tenant_id()` helper for the cashier-auth path, plus
  inline EXISTS checks for site managers and staff users.

## Frontend fix (separate, in TenantContext.tsx)
- `loadTenantDataForSiteManager` will be updated to call
  `setOwnerPinState((tenantData as any).owner_pin ?? '')` after loading the
  tenant row, mirroring what `loadTenantData` already does for the owner.

## Security
- The new roles SELECT policy only allows reading roles whose `tenant_id`
  matches the caller's site/tenant — no cross-tenant access.
- `owner_pin` is already on the `tenants` table which the cashier can read
  (existing "Cashier auth account can read own tenant" policy). The frontend
  change simply uses a value it already receives.
*/

-- ============================================================
-- Helper: return the tenant_id for the cashier auth account
-- ============================================================
CREATE OR REPLACE FUNCTION private.get_cashier_tenant_id()
RETURNS uuid
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT tenant_id FROM sites WHERE cashier_auth_user_id = auth.uid() LIMIT 1
$$;

GRANT EXECUTE ON FUNCTION private.get_cashier_tenant_id() TO authenticated;

-- ============================================================
-- RLS: allow cashier auth, site managers, and staff users to read
--       roles belonging to their tenant
-- ============================================================
DROP POLICY IF EXISTS "Cashier and staff can read own tenant roles" ON roles;

CREATE POLICY "Cashier and staff can read own tenant roles"
  ON public.roles
  FOR SELECT
  TO authenticated
  USING (
    -- Cashier shared auth account
    (tenant_id IS NOT NULL AND tenant_id = private.get_cashier_tenant_id())
    OR
    -- Site manager
    EXISTS (
      SELECT 1 FROM site_managers sm
      WHERE sm.tenant_id = roles.tenant_id
        AND sm.id = auth.uid()
        AND sm.is_active = true
    )
    OR
    -- Staff user (public.users)
    EXISTS (
      SELECT 1 FROM users u
      WHERE u.tenant_id = roles.tenant_id
        AND u.id = auth.uid()
        AND u.is_active = true
    )
  );

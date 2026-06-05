/*
  # Allow cashier shared auth account to read tenant and settings

  ## Problem
  When a cashier logs in using the shared auth account (cashier_auth_user_id),
  loadTenantDataForSiteManager queries tenants and settings by site_id/tenant_id.
  No existing RLS policy allows the cashier_auth_user_id to read these tables,
  so the queries return null and the app shows the SitePicker instead of the PIN screen.

  ## Solution
  Add SELECT policies on tenants and settings for authenticated users
  whose auth.uid() matches a site's cashier_auth_user_id.

  Uses SECURITY DEFINER helpers to avoid cross-table RLS cycles.
*/

-- Helper: return the site whose cashier_auth_user_id matches the caller
CREATE OR REPLACE FUNCTION private.get_cashier_site_id()
RETURNS uuid
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT id FROM sites WHERE cashier_auth_user_id = auth.uid() LIMIT 1
$$;

GRANT EXECUTE ON FUNCTION private.get_cashier_site_id() TO authenticated;

-- Tenants: cashier auth account can read their site's tenant
CREATE POLICY "Cashier auth account can read own tenant"
  ON public.tenants
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM sites
      WHERE sites.tenant_id = tenants.id
        AND sites.cashier_auth_user_id = auth.uid()
    )
  );

-- Settings: cashier auth account can read settings of their site
CREATE POLICY "Cashier auth account can read own site settings"
  ON public.settings
  FOR SELECT
  TO authenticated
  USING (
    site_id IS NOT NULL
    AND site_id = private.get_cashier_site_id()
  );

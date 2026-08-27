/*
  # Add SELECT policies for site managers on sites and tenants

  Site managers need to read their own site and its parent tenant
  to load the app context (TenantContext). Without these policies
  they see nothing after login.
*/

CREATE POLICY "sites_manager_select"
  ON sites FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM site_managers sm
      WHERE sm.site_id = sites.id
        AND sm.id = auth.uid()
        AND sm.is_active = true
    )
  );

CREATE POLICY "tenants_manager_select"
  ON tenants FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM site_managers sm
      WHERE sm.tenant_id = tenants.id
        AND sm.id = auth.uid()
        AND sm.is_active = true
    )
  );

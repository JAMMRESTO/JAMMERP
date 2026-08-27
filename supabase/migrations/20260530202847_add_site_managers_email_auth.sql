/*
  # Add site managers — email/password auth per site

  ## Purpose
  Allow each site to have its own dedicated email login (site manager)
  that can only access that specific site. The site manager sees only
  the users assigned to their site and cannot switch sites.

  ## New Tables
  - `site_managers`
    - `id` (uuid, PK) — references auth.users(id)
    - `site_id` (uuid, FK → sites) — the site this manager belongs to
    - `tenant_id` (uuid, FK → tenants)
    - `email` (text) — for display only (auth handled by Supabase)
    - `name` (text)
    - `is_active` (boolean)
    - `created_at`, `updated_at`

  ## Security
  - RLS enabled, restrictive policies
  - Tenant owner can manage site managers for their own tenant
  - Site manager can only read their own row
  - Super admin can read all rows
*/

CREATE TABLE IF NOT EXISTS site_managers (
  id          uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  site_id     uuid NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
  tenant_id   uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  email       text NOT NULL,
  name        text NOT NULL DEFAULT '',
  is_active   boolean NOT NULL DEFAULT true,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE site_managers ENABLE ROW LEVEL SECURITY;

-- Index for fast lookups
CREATE INDEX IF NOT EXISTS site_managers_site_id_idx   ON site_managers(site_id);
CREATE INDEX IF NOT EXISTS site_managers_tenant_id_idx ON site_managers(tenant_id);

-- Tenant owner can read all site managers for their tenant
CREATE POLICY "site_managers_owner_select"
  ON site_managers FOR SELECT
  TO authenticated
  USING (auth_owns_tenant(tenant_id));

-- Tenant owner can insert site managers for their tenant
CREATE POLICY "site_managers_owner_insert"
  ON site_managers FOR INSERT
  TO authenticated
  WITH CHECK (auth_owns_tenant(tenant_id));

-- Tenant owner can update site managers for their tenant
CREATE POLICY "site_managers_owner_update"
  ON site_managers FOR UPDATE
  TO authenticated
  USING (auth_owns_tenant(tenant_id))
  WITH CHECK (auth_owns_tenant(tenant_id));

-- Tenant owner can delete site managers for their tenant
CREATE POLICY "site_managers_owner_delete"
  ON site_managers FOR DELETE
  TO authenticated
  USING (auth_owns_tenant(tenant_id));

-- Site manager can read their own row
CREATE POLICY "site_managers_self_select"
  ON site_managers FOR SELECT
  TO authenticated
  USING (auth.uid() = id);

-- Super admin can read all
CREATE POLICY "site_managers_super_admin_select"
  ON site_managers FOR SELECT
  TO authenticated
  USING (is_super_admin());

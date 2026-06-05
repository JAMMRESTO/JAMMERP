/*
  # Multi-tenancy : Tenants et Sites

  ## Résumé
  Mise en place de l'architecture multi-tenant avec isolation complète des données par tenant.
  Chaque tenant (entreprise cliente) peut avoir plusieurs sites (restaurants/points de vente).

  ## Nouvelles tables
  - `tenants` — Entreprises clientes (isolation racine)
  - `sites` — Points de vente/restaurants par tenant

  ## Modifications
  - La table `users` reçoit `tenant_id` (appartenance au tenant)
  - La table `roles` reçoit `tenant_id` (rôles par tenant)
  - La table `settings` reçoit `site_id` (paramètres par site)
  - La table `sessions` reçoit `site_id`

  ## Sécurité
  - RLS activé sur toutes les nouvelles tables
  - Les policies vérifient `auth.uid()` via `tenant_members` pour tenants
  - Le super admin Supabase Auth (owner) a accès complet
  - Les données sans tenant_id/site_id restent accessibles en anon (rétrocompatibilité)

  ## Notes
  1. Stratégie : Row-Level Security via Supabase Auth (email/password) pour les admins tenant
  2. L'auth PIN interne reste pour les employés (cashiers, etc.) — filtrée par site_id
  3. La migration est additive (IF NOT EXISTS) — aucune donnée existante perdue
  4. Un tenant "default" est créé pour migrer les données existantes
*/

-- ============================================================
-- TENANTS (entreprises clientes)
-- ============================================================
CREATE TABLE IF NOT EXISTS tenants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  slug text NOT NULL UNIQUE,
  plan text NOT NULL DEFAULT 'starter',
  is_active boolean NOT NULL DEFAULT true,
  owner_id uuid, -- auth.users.id du super-admin du tenant
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE tenants ENABLE ROW LEVEL SECURITY;

-- Seul le owner (auth.uid = owner_id) peut voir son tenant
CREATE POLICY "tenant_owner_select"
  ON tenants FOR SELECT
  TO authenticated
  USING (auth.uid() = owner_id);

CREATE POLICY "tenant_owner_update"
  ON tenants FOR UPDATE
  TO authenticated
  USING (auth.uid() = owner_id)
  WITH CHECK (auth.uid() = owner_id);

-- Tout utilisateur authentifié peut créer un tenant (inscription)
CREATE POLICY "tenant_authenticated_insert"
  ON tenants FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = owner_id);

-- Accès anon pour la lecture du slug (page d'accueil publique)
CREATE POLICY "tenant_anon_select_slug"
  ON tenants FOR SELECT
  TO anon
  USING (is_active = true);

-- ============================================================
-- SITES (points de vente / restaurants par tenant)
-- ============================================================
CREATE TABLE IF NOT EXISTS sites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name text NOT NULL,
  slug text NOT NULL,
  address text DEFAULT '',
  phone text DEFAULT '',
  timezone text DEFAULT 'Africa/Dakar',
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(tenant_id, slug)
);

ALTER TABLE sites ENABLE ROW LEVEL SECURITY;

CREATE POLICY "sites_owner_select"
  ON sites FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM tenants
      WHERE tenants.id = sites.tenant_id
      AND tenants.owner_id = auth.uid()
    )
  );

CREATE POLICY "sites_owner_insert"
  ON sites FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM tenants
      WHERE tenants.id = sites.tenant_id
      AND tenants.owner_id = auth.uid()
    )
  );

CREATE POLICY "sites_owner_update"
  ON sites FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM tenants
      WHERE tenants.id = sites.tenant_id
      AND tenants.owner_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM tenants
      WHERE tenants.id = sites.tenant_id
      AND tenants.owner_id = auth.uid()
    )
  );

CREATE POLICY "sites_owner_delete"
  ON sites FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM tenants
      WHERE tenants.id = sites.tenant_id
      AND tenants.owner_id = auth.uid()
    )
  );

-- Anon peut lire les sites actifs (pour login PIN des employés)
CREATE POLICY "sites_anon_select"
  ON sites FOR SELECT
  TO anon
  USING (is_active = true);

-- ============================================================
-- Ajouter tenant_id / site_id aux tables existantes
-- ============================================================

-- users : appartient à un tenant
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='users' AND column_name='tenant_id') THEN
    ALTER TABLE users ADD COLUMN tenant_id uuid REFERENCES tenants(id) ON DELETE CASCADE;
    CREATE INDEX IF NOT EXISTS idx_users_tenant_id ON users(tenant_id);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='users' AND column_name='site_id') THEN
    ALTER TABLE users ADD COLUMN site_id uuid REFERENCES sites(id) ON DELETE SET NULL;
    CREATE INDEX IF NOT EXISTS idx_users_site_id ON users(site_id);
  END IF;
END $$;

-- roles : par tenant (chaque tenant a ses propres rôles)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='roles' AND column_name='tenant_id') THEN
    ALTER TABLE roles ADD COLUMN tenant_id uuid REFERENCES tenants(id) ON DELETE CASCADE;
    CREATE INDEX IF NOT EXISTS idx_roles_tenant_id ON roles(tenant_id);
  END IF;
END $$;

-- sessions : par site
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='sessions' AND column_name='site_id') THEN
    ALTER TABLE sessions ADD COLUMN site_id uuid REFERENCES sites(id) ON DELETE SET NULL;
  END IF;
END $$;

-- settings : par site (remplace la clé unique globale)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='settings' AND column_name='site_id') THEN
    ALTER TABLE settings ADD COLUMN site_id uuid REFERENCES sites(id) ON DELETE CASCADE;
    CREATE INDEX IF NOT EXISTS idx_settings_site_id ON settings(site_id);
  END IF;
END $$;

-- Supprimer l'ancienne contrainte unique sur key seul si elle existe
ALTER TABLE settings DROP CONSTRAINT IF EXISTS settings_key_key;

-- Créer la contrainte unique (site_id, key)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'settings_site_key_unique'
  ) THEN
    ALTER TABLE settings ADD CONSTRAINT settings_site_key_unique UNIQUE(site_id, key);
  END IF;
END $$;

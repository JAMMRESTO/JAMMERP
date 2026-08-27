/*
  # Super Admins

  ## Résumé
  Création d'une table `super_admins` pour les comptes avec accès global
  à tous les tenants et toutes les données de la plateforme.

  ## Nouvelle table
  - `super_admins` — liste des auth.users ayant les droits super admin
    - `id` : référence auth.users
    - `email` : email pour affichage
    - `created_at`

  ## Sécurité
  - RLS activé : seul un super admin peut voir/gérer la table
  - Un super admin peut lire TOUS les tenants et sites (policy séparée)

  ## Notes
  1. Le premier super admin doit être inséré manuellement (bootstrap)
  2. Les super admins voient toutes les données sans filtre tenant_id/site_id
  3. L'accès est vérifié via la fonction `is_super_admin()` utilisée par les policies
*/

-- ============================================================
-- Table super_admins
-- ============================================================
CREATE TABLE IF NOT EXISTS super_admins (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email text NOT NULL,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE super_admins ENABLE ROW LEVEL SECURITY;

-- Seul un super admin peut lire la liste
CREATE POLICY "super_admins_select"
  ON super_admins FOR SELECT
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM super_admins sa WHERE sa.id = auth.uid())
  );

-- Seul un super admin peut ajouter un autre super admin
CREATE POLICY "super_admins_insert"
  ON super_admins FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (SELECT 1 FROM super_admins sa WHERE sa.id = auth.uid())
  );

CREATE POLICY "super_admins_delete"
  ON super_admins FOR DELETE
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM super_admins sa WHERE sa.id = auth.uid())
  );

-- ============================================================
-- Fonction helper : vérifie si l'utilisateur courant est super admin
-- ============================================================
CREATE OR REPLACE FUNCTION public.is_super_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT EXISTS (
    SELECT 1 FROM super_admins WHERE id = auth.uid()
  )
$$;

-- ============================================================
-- Super admins peuvent lire TOUS les tenants et sites
-- ============================================================
CREATE POLICY "tenants_super_admin_select"
  ON tenants FOR SELECT
  TO authenticated
  USING (public.is_super_admin());

CREATE POLICY "tenants_super_admin_update"
  ON tenants FOR UPDATE
  TO authenticated
  USING (public.is_super_admin())
  WITH CHECK (public.is_super_admin());

CREATE POLICY "tenants_super_admin_delete"
  ON tenants FOR DELETE
  TO authenticated
  USING (public.is_super_admin());

CREATE POLICY "sites_super_admin_select"
  ON sites FOR SELECT
  TO authenticated
  USING (public.is_super_admin());

CREATE POLICY "sites_super_admin_update"
  ON sites FOR UPDATE
  TO authenticated
  USING (public.is_super_admin())
  WITH CHECK (public.is_super_admin());

CREATE POLICY "sites_super_admin_delete"
  ON sites FOR DELETE
  TO authenticated
  USING (public.is_super_admin());

-- ============================================================
-- Super admins ont accès en lecture à toutes les données (cross-tenant)
-- ============================================================
DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'users','roles','settings','sessions',
    'categories','products','stock_movements',
    'sales','sale_items','payments',
    'restaurant_tables','orders','order_items',
    'drivers','deliveries','driver_payments',
    'ingredients','recipes','recipe_items','productions',
    'warehouses','warehouse_stock','warehouse_transfers','warehouse_transfer_items',
    'online_orders','cash_sessions'
  ]
  LOOP
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = t AND table_schema = 'public') THEN
      BEGIN
        EXECUTE format(
          'CREATE POLICY %I ON %I FOR SELECT TO authenticated USING (public.is_super_admin())',
          t || '_super_admin_select', t
        );
      EXCEPTION WHEN duplicate_object THEN
        NULL; -- policy already exists, skip
      END;
    END IF;
  END LOOP;
END $$;

-- ============================================================
-- customers (si elle existe)
-- ============================================================
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'customers' AND table_schema = 'public') THEN
    BEGIN
      EXECUTE 'CREATE POLICY "customers_super_admin_select" ON customers FOR SELECT TO authenticated USING (public.is_super_admin())';
    EXCEPTION WHEN duplicate_object THEN
      NULL;
    END;
  END IF;
END $$;

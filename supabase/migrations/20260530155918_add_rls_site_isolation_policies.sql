/*
  # RLS : Isolation par site pour toutes les tables de données

  ## Résumé
  Mise en place des policies RLS pour l'isolation multi-tenant.
  
  ## Stratégie
  - Les employés (anon, auth PIN) accèdent via site_id passé dans les queries
  - Le propriétaire du tenant (Supabase Auth) accède à tous ses sites
  - Policy "anon full access by site" : l'app filtre par site_id côté client
  - Les données sans site_id restent accessibles (rétrocompatibilité)

  ## Architecture de sécurité
  1. Couche 1 (RLS DB) : anon voit tout, mais le WHERE site_id=X en query isole les données
  2. Couche 2 (App) : le contexte React impose TOUJOURS un filtre site_id
  3. Couche 3 (Auth) : le propriétaire Supabase Auth peut gérer tous ses sites

  ## Note
  Les policies existantes "anon" sont conservées pour la rétrocompatibilité.
  L'isolation principale est garantie par le filtrage applicatif obligatoire.
*/

-- ============================================================
-- Fonction helper : vérifie si un site appartient au tenant de l'utilisateur connecté
-- ============================================================
CREATE OR REPLACE FUNCTION public.user_owns_site(p_site_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM sites s
    JOIN tenants t ON t.id = s.tenant_id
    WHERE s.id = p_site_id
    AND t.owner_id = auth.uid()
  )
$$;

-- ============================================================
-- Policies pour les tables de données (accès owner via Auth)
-- ============================================================

-- categories
CREATE POLICY "categories_owner_select" ON categories FOR SELECT TO authenticated
  USING (site_id IS NULL OR public.user_owns_site(site_id));
CREATE POLICY "categories_owner_insert" ON categories FOR INSERT TO authenticated
  WITH CHECK (site_id IS NULL OR public.user_owns_site(site_id));
CREATE POLICY "categories_owner_update" ON categories FOR UPDATE TO authenticated
  USING (site_id IS NULL OR public.user_owns_site(site_id))
  WITH CHECK (site_id IS NULL OR public.user_owns_site(site_id));
CREATE POLICY "categories_owner_delete" ON categories FOR DELETE TO authenticated
  USING (site_id IS NULL OR public.user_owns_site(site_id));

-- products
CREATE POLICY "products_owner_select" ON products FOR SELECT TO authenticated
  USING (site_id IS NULL OR public.user_owns_site(site_id));
CREATE POLICY "products_owner_insert" ON products FOR INSERT TO authenticated
  WITH CHECK (site_id IS NULL OR public.user_owns_site(site_id));
CREATE POLICY "products_owner_update" ON products FOR UPDATE TO authenticated
  USING (site_id IS NULL OR public.user_owns_site(site_id))
  WITH CHECK (site_id IS NULL OR public.user_owns_site(site_id));
CREATE POLICY "products_owner_delete" ON products FOR DELETE TO authenticated
  USING (site_id IS NULL OR public.user_owns_site(site_id));

-- sales
CREATE POLICY "sales_owner_select" ON sales FOR SELECT TO authenticated
  USING (site_id IS NULL OR public.user_owns_site(site_id));
CREATE POLICY "sales_owner_insert" ON sales FOR INSERT TO authenticated
  WITH CHECK (site_id IS NULL OR public.user_owns_site(site_id));
CREATE POLICY "sales_owner_update" ON sales FOR UPDATE TO authenticated
  USING (site_id IS NULL OR public.user_owns_site(site_id))
  WITH CHECK (site_id IS NULL OR public.user_owns_site(site_id));
CREATE POLICY "sales_owner_delete" ON sales FOR DELETE TO authenticated
  USING (site_id IS NULL OR public.user_owns_site(site_id));

-- sale_items
CREATE POLICY "sale_items_owner_select" ON sale_items FOR SELECT TO authenticated
  USING (site_id IS NULL OR public.user_owns_site(site_id));
CREATE POLICY "sale_items_owner_insert" ON sale_items FOR INSERT TO authenticated
  WITH CHECK (site_id IS NULL OR public.user_owns_site(site_id));
CREATE POLICY "sale_items_owner_update" ON sale_items FOR UPDATE TO authenticated
  USING (site_id IS NULL OR public.user_owns_site(site_id))
  WITH CHECK (site_id IS NULL OR public.user_owns_site(site_id));
CREATE POLICY "sale_items_owner_delete" ON sale_items FOR DELETE TO authenticated
  USING (site_id IS NULL OR public.user_owns_site(site_id));

-- payments
CREATE POLICY "payments_owner_select" ON payments FOR SELECT TO authenticated
  USING (site_id IS NULL OR public.user_owns_site(site_id));
CREATE POLICY "payments_owner_insert" ON payments FOR INSERT TO authenticated
  WITH CHECK (site_id IS NULL OR public.user_owns_site(site_id));
CREATE POLICY "payments_owner_update" ON payments FOR UPDATE TO authenticated
  USING (site_id IS NULL OR public.user_owns_site(site_id))
  WITH CHECK (site_id IS NULL OR public.user_owns_site(site_id));
CREATE POLICY "payments_owner_delete" ON payments FOR DELETE TO authenticated
  USING (site_id IS NULL OR public.user_owns_site(site_id));

-- orders
CREATE POLICY "orders_owner_select" ON orders FOR SELECT TO authenticated
  USING (site_id IS NULL OR public.user_owns_site(site_id));
CREATE POLICY "orders_owner_insert" ON orders FOR INSERT TO authenticated
  WITH CHECK (site_id IS NULL OR public.user_owns_site(site_id));
CREATE POLICY "orders_owner_update" ON orders FOR UPDATE TO authenticated
  USING (site_id IS NULL OR public.user_owns_site(site_id))
  WITH CHECK (site_id IS NULL OR public.user_owns_site(site_id));
CREATE POLICY "orders_owner_delete" ON orders FOR DELETE TO authenticated
  USING (site_id IS NULL OR public.user_owns_site(site_id));

-- order_items
CREATE POLICY "order_items_owner_select" ON order_items FOR SELECT TO authenticated
  USING (site_id IS NULL OR public.user_owns_site(site_id));
CREATE POLICY "order_items_owner_insert" ON order_items FOR INSERT TO authenticated
  WITH CHECK (site_id IS NULL OR public.user_owns_site(site_id));
CREATE POLICY "order_items_owner_update" ON order_items FOR UPDATE TO authenticated
  USING (site_id IS NULL OR public.user_owns_site(site_id))
  WITH CHECK (site_id IS NULL OR public.user_owns_site(site_id));
CREATE POLICY "order_items_owner_delete" ON order_items FOR DELETE TO authenticated
  USING (site_id IS NULL OR public.user_owns_site(site_id));

-- restaurant_tables
CREATE POLICY "restaurant_tables_owner_select" ON restaurant_tables FOR SELECT TO authenticated
  USING (site_id IS NULL OR public.user_owns_site(site_id));
CREATE POLICY "restaurant_tables_owner_insert" ON restaurant_tables FOR INSERT TO authenticated
  WITH CHECK (site_id IS NULL OR public.user_owns_site(site_id));
CREATE POLICY "restaurant_tables_owner_update" ON restaurant_tables FOR UPDATE TO authenticated
  USING (site_id IS NULL OR public.user_owns_site(site_id))
  WITH CHECK (site_id IS NULL OR public.user_owns_site(site_id));
CREATE POLICY "restaurant_tables_owner_delete" ON restaurant_tables FOR DELETE TO authenticated
  USING (site_id IS NULL OR public.user_owns_site(site_id));

-- drivers
CREATE POLICY "drivers_owner_select" ON drivers FOR SELECT TO authenticated
  USING (site_id IS NULL OR public.user_owns_site(site_id));
CREATE POLICY "drivers_owner_insert" ON drivers FOR INSERT TO authenticated
  WITH CHECK (site_id IS NULL OR public.user_owns_site(site_id));
CREATE POLICY "drivers_owner_update" ON drivers FOR UPDATE TO authenticated
  USING (site_id IS NULL OR public.user_owns_site(site_id))
  WITH CHECK (site_id IS NULL OR public.user_owns_site(site_id));
CREATE POLICY "drivers_owner_delete" ON drivers FOR DELETE TO authenticated
  USING (site_id IS NULL OR public.user_owns_site(site_id));

-- deliveries
CREATE POLICY "deliveries_owner_select" ON deliveries FOR SELECT TO authenticated
  USING (site_id IS NULL OR public.user_owns_site(site_id));
CREATE POLICY "deliveries_owner_insert" ON deliveries FOR INSERT TO authenticated
  WITH CHECK (site_id IS NULL OR public.user_owns_site(site_id));
CREATE POLICY "deliveries_owner_update" ON deliveries FOR UPDATE TO authenticated
  USING (site_id IS NULL OR public.user_owns_site(site_id))
  WITH CHECK (site_id IS NULL OR public.user_owns_site(site_id));
CREATE POLICY "deliveries_owner_delete" ON deliveries FOR DELETE TO authenticated
  USING (site_id IS NULL OR public.user_owns_site(site_id));

-- ingredients
CREATE POLICY "ingredients_owner_select" ON ingredients FOR SELECT TO authenticated
  USING (site_id IS NULL OR public.user_owns_site(site_id));
CREATE POLICY "ingredients_owner_insert" ON ingredients FOR INSERT TO authenticated
  WITH CHECK (site_id IS NULL OR public.user_owns_site(site_id));
CREATE POLICY "ingredients_owner_update" ON ingredients FOR UPDATE TO authenticated
  USING (site_id IS NULL OR public.user_owns_site(site_id))
  WITH CHECK (site_id IS NULL OR public.user_owns_site(site_id));
CREATE POLICY "ingredients_owner_delete" ON ingredients FOR DELETE TO authenticated
  USING (site_id IS NULL OR public.user_owns_site(site_id));

-- recipes
CREATE POLICY "recipes_owner_select" ON recipes FOR SELECT TO authenticated
  USING (site_id IS NULL OR public.user_owns_site(site_id));
CREATE POLICY "recipes_owner_insert" ON recipes FOR INSERT TO authenticated
  WITH CHECK (site_id IS NULL OR public.user_owns_site(site_id));
CREATE POLICY "recipes_owner_update" ON recipes FOR UPDATE TO authenticated
  USING (site_id IS NULL OR public.user_owns_site(site_id))
  WITH CHECK (site_id IS NULL OR public.user_owns_site(site_id));
CREATE POLICY "recipes_owner_delete" ON recipes FOR DELETE TO authenticated
  USING (site_id IS NULL OR public.user_owns_site(site_id));

-- warehouses
CREATE POLICY "warehouses_owner_select" ON warehouses FOR SELECT TO authenticated
  USING (site_id IS NULL OR public.user_owns_site(site_id));
CREATE POLICY "warehouses_owner_insert" ON warehouses FOR INSERT TO authenticated
  WITH CHECK (site_id IS NULL OR public.user_owns_site(site_id));
CREATE POLICY "warehouses_owner_update" ON warehouses FOR UPDATE TO authenticated
  USING (site_id IS NULL OR public.user_owns_site(site_id))
  WITH CHECK (site_id IS NULL OR public.user_owns_site(site_id));
CREATE POLICY "warehouses_owner_delete" ON warehouses FOR DELETE TO authenticated
  USING (site_id IS NULL OR public.user_owns_site(site_id));

-- cash_sessions
CREATE POLICY "cash_sessions_owner_select" ON cash_sessions FOR SELECT TO authenticated
  USING (site_id IS NULL OR public.user_owns_site(site_id));
CREATE POLICY "cash_sessions_owner_insert" ON cash_sessions FOR INSERT TO authenticated
  WITH CHECK (site_id IS NULL OR public.user_owns_site(site_id));
CREATE POLICY "cash_sessions_owner_update" ON cash_sessions FOR UPDATE TO authenticated
  USING (site_id IS NULL OR public.user_owns_site(site_id))
  WITH CHECK (site_id IS NULL OR public.user_owns_site(site_id));

-- online_orders
CREATE POLICY "online_orders_owner_select" ON online_orders FOR SELECT TO authenticated
  USING (site_id IS NULL OR public.user_owns_site(site_id));
CREATE POLICY "online_orders_owner_insert" ON online_orders FOR INSERT TO authenticated
  WITH CHECK (site_id IS NULL OR public.user_owns_site(site_id));
CREATE POLICY "online_orders_owner_update" ON online_orders FOR UPDATE TO authenticated
  USING (site_id IS NULL OR public.user_owns_site(site_id))
  WITH CHECK (site_id IS NULL OR public.user_owns_site(site_id));

-- customers (si la table existe)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'customers' AND table_schema = 'public') THEN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'customers' AND policyname = 'customers_owner_select') THEN
      EXECUTE 'CREATE POLICY "customers_owner_select" ON customers FOR SELECT TO authenticated USING (site_id IS NULL OR public.user_owns_site(site_id))';
      EXECUTE 'CREATE POLICY "customers_owner_insert" ON customers FOR INSERT TO authenticated WITH CHECK (site_id IS NULL OR public.user_owns_site(site_id))';
      EXECUTE 'CREATE POLICY "customers_owner_update" ON customers FOR UPDATE TO authenticated USING (site_id IS NULL OR public.user_owns_site(site_id)) WITH CHECK (site_id IS NULL OR public.user_owns_site(site_id))';
    END IF;
  END IF;
END $$;

-- users : un owner peut gérer les users de ses sites
CREATE POLICY "users_owner_select" ON users FOR SELECT TO authenticated
  USING (
    tenant_id IS NULL OR
    EXISTS (
      SELECT 1 FROM tenants WHERE id = users.tenant_id AND owner_id = auth.uid()
    )
  );
CREATE POLICY "users_owner_insert" ON users FOR INSERT TO authenticated
  WITH CHECK (
    tenant_id IS NULL OR
    EXISTS (
      SELECT 1 FROM tenants WHERE id = users.tenant_id AND owner_id = auth.uid()
    )
  );
CREATE POLICY "users_owner_update" ON users FOR UPDATE TO authenticated
  USING (
    tenant_id IS NULL OR
    EXISTS (
      SELECT 1 FROM tenants WHERE id = users.tenant_id AND owner_id = auth.uid()
    )
  )
  WITH CHECK (
    tenant_id IS NULL OR
    EXISTS (
      SELECT 1 FROM tenants WHERE id = users.tenant_id AND owner_id = auth.uid()
    )
  );
CREATE POLICY "users_owner_delete" ON users FOR DELETE TO authenticated
  USING (
    tenant_id IS NULL OR
    EXISTS (
      SELECT 1 FROM tenants WHERE id = users.tenant_id AND owner_id = auth.uid()
    )
  );

-- roles : un owner peut gérer les rôles de son tenant
CREATE POLICY "roles_owner_select" ON roles FOR SELECT TO authenticated
  USING (
    tenant_id IS NULL OR
    EXISTS (
      SELECT 1 FROM tenants WHERE id = roles.tenant_id AND owner_id = auth.uid()
    )
  );
CREATE POLICY "roles_owner_insert" ON roles FOR INSERT TO authenticated
  WITH CHECK (
    tenant_id IS NULL OR
    EXISTS (
      SELECT 1 FROM tenants WHERE id = roles.tenant_id AND owner_id = auth.uid()
    )
  );
CREATE POLICY "roles_owner_update" ON roles FOR UPDATE TO authenticated
  USING (
    tenant_id IS NULL OR
    EXISTS (
      SELECT 1 FROM tenants WHERE id = roles.tenant_id AND owner_id = auth.uid()
    )
  )
  WITH CHECK (
    tenant_id IS NULL OR
    EXISTS (
      SELECT 1 FROM tenants WHERE id = roles.tenant_id AND owner_id = auth.uid()
    )
  );

-- settings : par site, un owner peut gérer les settings de ses sites
CREATE POLICY "settings_owner_select" ON settings FOR SELECT TO authenticated
  USING (
    site_id IS NULL OR public.user_owns_site(site_id)
  );
CREATE POLICY "settings_owner_insert" ON settings FOR INSERT TO authenticated
  WITH CHECK (
    site_id IS NULL OR public.user_owns_site(site_id)
  );
CREATE POLICY "settings_owner_update" ON settings FOR UPDATE TO authenticated
  USING (
    site_id IS NULL OR public.user_owns_site(site_id)
  )
  WITH CHECK (
    site_id IS NULL OR public.user_owns_site(site_id)
  );

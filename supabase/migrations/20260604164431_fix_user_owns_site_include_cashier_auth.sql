/*
  # Fix user_owns_site to include cashier auth account

  ## Problem
  The private.user_owns_site() function used in RLS policies for products,
  categories, and other data tables does not cover the cashier shared auth
  account (cashier_auth_user_id on the sites table). As a result, cashier
  accounts cannot read products or categories in the POS, even though they
  can authenticate and read the site/tenant records.

  ## Changes
  - Updated private.user_owns_site(p_site_id uuid) to add a 4th OR branch
    that matches when auth.uid() equals the site's cashier_auth_user_id.

  ## Affected tables (via RLS policies using this function)
  - products, categories, sales, sale_items, payments, customers,
    inventory_items, stock_movements, restaurant_tables, reservations,
    online_orders, cash_sessions, deliveries, and all other data tables.
*/

CREATE OR REPLACE FUNCTION private.user_owns_site(p_site_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = 'public'
AS $$
SELECT EXISTS (
  SELECT 1 FROM sites s JOIN tenants t ON t.id = s.tenant_id
  WHERE s.id = p_site_id AND t.owner_id = auth.uid()
)
OR EXISTS (
  SELECT 1 FROM site_managers sm
  WHERE sm.site_id = p_site_id AND sm.id = auth.uid() AND sm.is_active = true
)
OR EXISTS (
  SELECT 1 FROM users u
  WHERE u.site_id = p_site_id AND u.id = auth.uid() AND u.is_active = true
)
OR EXISTS (
  SELECT 1 FROM sites s
  WHERE s.id = p_site_id AND s.cashier_auth_user_id = auth.uid()
);
$$;

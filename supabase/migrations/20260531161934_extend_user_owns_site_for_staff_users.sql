/*
  # Extend user_owns_site() to include staff users

  1. Changes
    - Updates `private.user_owns_site(p_site_id)` to also return true
      when `auth.uid()` matches an active staff user (`public.users`)
      assigned to the given site
    - This allows cashiers and other staff who authenticate via a
      shared Supabase Auth account to pass RLS checks on products,
      categories, sales, and all other site-scoped tables

  2. Security
    - Staff users can only access data for the site they belong to
    - The `is_active` flag is checked so deactivated staff are blocked
    - Function remains SECURITY DEFINER to safely query internal tables
*/

CREATE OR REPLACE FUNCTION private.user_owns_site(p_site_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
SELECT EXISTS (
  SELECT 1 FROM sites s
  JOIN tenants t ON t.id = s.tenant_id
  WHERE s.id = p_site_id AND t.owner_id = auth.uid()
)
OR EXISTS (
  SELECT 1 FROM site_managers sm
  WHERE sm.site_id = p_site_id
  AND sm.id = auth.uid()
  AND sm.is_active = true
)
OR EXISTS (
  SELECT 1 FROM users u
  WHERE u.site_id = p_site_id
  AND u.id = auth.uid()
  AND u.is_active = true
)
$function$;

/*
# Fix order item access for PIN-based sessions

1. Purpose
- Restore order item creation and quantity changes for the restaurant app.
- The app uses its own PIN login and communicates with Supabase using the public client key, so requests may use either the `anon` or `authenticated` database role.

2. Modified table
- `order_items`
- Keeps all existing columns and data unchanged.
- Allows valid order item inserts for both client roles.
- Allows quantity updates, including quantity `0`, which represents an item cancellation.
- Keeps basic validation so empty snapshots, missing orders, and negative quantities remain blocked.

3. Security
- RLS remains enabled on `order_items`.
- Replaces the previous role-specific policies with four separate CRUD policies covering both `anon` and `authenticated`.
- This is a single-restaurant PIN-authenticated application, so the existing shared-data access model is preserved.

4. Important notes
- No rows are deleted.
- No columns or types are changed.
- The existing quantity update function remains responsible for checking whether an order can still be changed.
*/

ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow anon full access on order_items" ON public.order_items;
DROP POLICY IF EXISTS "Anon can insert order_items" ON public.order_items;
DROP POLICY IF EXISTS "Anon can update order_items" ON public.order_items;
DROP POLICY IF EXISTS "Anon can delete order_items" ON public.order_items;
DROP POLICY IF EXISTS "Select order_items for app users" ON public.order_items;
DROP POLICY IF EXISTS "Insert order_items for app users" ON public.order_items;
DROP POLICY IF EXISTS "Update order_items for app users" ON public.order_items;
DROP POLICY IF EXISTS "Delete order_items for app users" ON public.order_items;

CREATE POLICY "Select order_items for app users"
ON public.order_items FOR SELECT
TO anon, authenticated
USING (true);

CREATE POLICY "Insert order_items for app users"
ON public.order_items FOR INSERT
TO anon, authenticated
WITH CHECK (
  nom_snapshot IS NOT NULL
  AND order_id IS NOT NULL
  AND qty > 0
);

CREATE POLICY "Update order_items for app users"
ON public.order_items FOR UPDATE
TO anon, authenticated
USING (id IS NOT NULL)
WITH CHECK (qty >= 0);

CREATE POLICY "Delete order_items for app users"
ON public.order_items FOR DELETE
TO anon, authenticated
USING (id IS NOT NULL);
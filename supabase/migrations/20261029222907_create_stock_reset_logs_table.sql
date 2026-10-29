/*
# Create stock_reset_logs table for tracking full stock resets

## Purpose
Each time an administrator uses the "Remettre tout le stock à zéro" feature,
a single log row is inserted recording who performed the reset, when, and how
many products/components were affected. This gives a clear audit trail separate
from the individual stock_movement rows (which show per-product changes).

## New Tables
- `stock_reset_logs`
  - `id` (uuid, primary key)
  - `site_id` (uuid, references sites, not null) — which site was reset
  - `performed_by` (uuid, references auth.users, not null) — the Supabase auth user who ran the reset
  - `performed_by_name` (text, not null) — human-readable name of the performer (owner email or staff name)
  - `products_reset` (integer, not null, default 0) — number of products zeroed
  - `components_reset` (integer, not null, default 0) — number of components zeroed
  - `created_at` (timestamptz, default now()) — exact timestamp of the reset

## Modified Functions
- `public.reset_site_stock(uuid)` — now inserts a row into `stock_reset_logs`
  at the end of the reset operation, capturing the performer's identity and counts.

## Security
- RLS enabled on `stock_reset_logs`.
- `GRANT SELECT` to `authenticated` (read-only audit log; inserts are done by
  the SECURITY DEFINER function, so no INSERT grant is needed for app roles).
- SELECT policy: users can only view reset logs for sites they own.
- The `reset_site_stock` function (SECURITY DEFINER) inserts the log row on
  behalf of the caller, so no direct INSERT grant is required.
*/

CREATE TABLE IF NOT EXISTS public.stock_reset_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id uuid NOT NULL REFERENCES public.sites(id) ON DELETE CASCADE,
  performed_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  performed_by_name text NOT NULL DEFAULT '',
  products_reset integer NOT NULL DEFAULT 0,
  components_reset integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.stock_reset_logs ENABLE ROW LEVEL SECURITY;

GRANT SELECT ON public.stock_reset_logs TO authenticated;

DROP POLICY IF EXISTS "select_own_stock_reset_logs" ON public.stock_reset_logs;
CREATE POLICY "select_own_stock_reset_logs" ON public.stock_reset_logs FOR SELECT
  TO authenticated USING (site_id IN (SELECT id FROM public.sites WHERE public.user_owns_site(site_id)));

CREATE OR REPLACE FUNCTION public.reset_site_stock(p_site_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_tenant uuid;
  v_user uuid;
  v_performer_name text := '';
  v_products integer := 0;
  v_components integer := 0;
  r record;
BEGIN
  SELECT tenant_id INTO v_tenant FROM public.sites WHERE id = p_site_id;
  IF v_tenant IS NULL THEN
    RAISE EXCEPTION 'Site introuvable' USING ERRCODE = '42501';
  END IF;

  IF NOT (
    EXISTS (SELECT 1 FROM public.tenants t WHERE t.id = v_tenant AND t.owner_id = auth.uid())
    OR EXISTS (
      SELECT 1
      FROM public.users u
      JOIN public.roles ro ON ro.id = u.role_id
      WHERE u.id = auth.uid()
        AND u.is_active = true
        AND u.tenant_id = v_tenant
        AND ro.permissions->>'all' = 'true'
    )
  ) THEN
    RAISE EXCEPTION 'Réservé aux administrateurs' USING ERRCODE = '42501';
  END IF;

  SELECT u.id, u.name INTO v_user, v_performer_name FROM public.users u WHERE u.id = auth.uid();

  -- If no staff user found, it's the tenant owner — use their email
  IF v_performer_name IS NULL OR v_performer_name = '' THEN
    SELECT t.owner_id INTO v_user FROM public.tenants t WHERE t.id = v_tenant AND t.owner_id = auth.uid();
    v_performer_name := COALESCE(
      (SELECT email FROM auth.users WHERE id = auth.uid()),
      'Propriétaire'
    );
  END IF;

  FOR r IN
    SELECT p.id, p.stock
    FROM public.products p
    WHERE p.site_id = p_site_id AND p.track_stock = true AND COALESCE(p.stock, 0) <> 0
    FOR UPDATE
  LOOP
    INSERT INTO public.stock_movements (product_id, type, quantity, stock_before, stock_after, reason, user_id, site_id)
    VALUES (r.id, 'out', r.stock, r.stock, 0, 'Remise à zéro du stock', v_user, p_site_id);

    UPDATE public.products
    SET stock = 0, is_available = false, updated_at = now()
    WHERE id = r.id;

    v_products := v_products + 1;
  END LOOP;

  FOR r IN
    SELECT c.id, c.stock
    FROM public.product_components c
    WHERE c.site_id = p_site_id AND COALESCE(c.stock, 0) <> 0
    FOR UPDATE
  LOOP
    INSERT INTO public.component_stock_movements (component_id, movement_type, quantity, stock_before, stock_after, reason, user_id, site_id, reference_type)
    VALUES (r.id, 'out', r.stock, r.stock, 0, 'Remise à zéro du stock', v_user, p_site_id, 'manual');

    UPDATE public.product_components
    SET stock = 0, updated_at = now()
    WHERE id = r.id;

    v_components := v_components + 1;
  END LOOP;

  -- Record the audit log entry
  INSERT INTO public.stock_reset_logs (site_id, performed_by, performed_by_name, products_reset, components_reset)
  VALUES (p_site_id, auth.uid(), v_performer_name, v_products, v_components);

  RETURN jsonb_build_object('products_reset', v_products, 'components_reset', v_components);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.reset_site_stock(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.reset_site_stock(uuid) TO authenticated;

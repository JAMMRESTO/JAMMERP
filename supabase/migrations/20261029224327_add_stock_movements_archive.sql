/*
# Add archive support for stock movements

## Purpose
Allow administrators to archive old stock movements so the movements list
stays manageable. Archived movements are hidden by default but can be shown
via a toggle. The data is never deleted — only flagged.

## Changes
1. `stock_movements` — add `is_archived` boolean column (default false)
2. `component_stock_movements` — add `is_archived` boolean column (default false)
3. New function `archive_old_stock_movements(p_site_id, p_before_date)`:
   Marks all movements on the given site with `created_at < p_before_date`
   as archived. Returns counts of archived rows.
4. Security: function is SECURITY DEFINER, callable only by authenticated
   users who own the site (same check as reset_site_stock).
*/

ALTER TABLE public.stock_movements
  ADD COLUMN IF NOT EXISTS is_archived boolean NOT NULL DEFAULT false;

ALTER TABLE public.component_stock_movements
  ADD COLUMN IF NOT EXISTS is_archived boolean NOT NULL DEFAULT false;

-- Index for filtering archived movements by site
CREATE INDEX IF NOT EXISTS idx_stock_movements_archived_site
  ON public.stock_movements (site_id, is_archived, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_component_stock_movements_archived_site
  ON public.component_stock_movements (site_id, is_archived, created_at DESC);

CREATE OR REPLACE FUNCTION public.archive_old_stock_movements(
  p_site_id uuid,
  p_before_date date
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_tenant uuid;
  v_products integer := 0;
  v_components integer := 0;
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

  UPDATE public.stock_movements
  SET is_archived = true
  WHERE site_id = p_site_id
    AND created_at < p_before_date::timestamptz
    AND is_archived = false;

  GET DIAGNOSTICS v_products = ROW_COUNT;

  UPDATE public.component_stock_movements
  SET is_archived = true
  WHERE site_id = p_site_id
    AND created_at < p_before_date::timestamptz
    AND is_archived = false;

  GET DIAGNOSTICS v_components = ROW_COUNT;

  RETURN jsonb_build_object('products_archived', v_products, 'components_archived', v_components);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.archive_old_stock_movements(uuid, date) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.archive_old_stock_movements(uuid, date) TO authenticated;

ALTER TABLE public.stock_movements
  ADD COLUMN IF NOT EXISTS stock_before integer,
  ADD COLUMN IF NOT EXISTS stock_after integer;

CREATE OR REPLACE FUNCTION public.reset_site_stock(p_site_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_tenant uuid;
  v_user uuid;
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

  SELECT u.id INTO v_user FROM public.users u WHERE u.id = auth.uid();

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

  RETURN jsonb_build_object('products_reset', v_products, 'components_reset', v_components);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.reset_site_stock(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.reset_site_stock(uuid) TO authenticated;
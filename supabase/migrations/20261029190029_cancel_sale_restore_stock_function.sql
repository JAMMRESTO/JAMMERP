CREATE OR REPLACE FUNCTION public.cancel_sale_and_restore_stock(p_sale_id uuid, p_admin_id uuid, p_admin_name text, p_reason text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_site uuid;
  v_status text;
  v_item_ids uuid[];
  r record;
BEGIN
  SELECT site_id, status INTO v_site, v_status FROM public.sales WHERE id = p_sale_id FOR UPDATE;
  IF v_site IS NULL THEN
    RAISE EXCEPTION 'Vente introuvable' USING ERRCODE = '42501';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.sites s
    JOIN public.tenants t ON t.id = s.tenant_id
    WHERE s.id = v_site
      AND (
        t.owner_id = auth.uid()
        OR EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.tenant_id = t.id AND u.is_active = true)
      )
  ) THEN
    RAISE EXCEPTION 'Accès refusé' USING ERRCODE = '42501';
  END IF;

  IF v_status = 'cancelled' THEN
    RETURN false;
  END IF;

  UPDATE public.sales
  SET status = 'cancelled',
      cancelled_by = p_admin_id,
      cancelled_by_name = p_admin_name,
      cancelled_at = now(),
      cancel_reason = p_reason
  WHERE id = p_sale_id;

  FOR r IN
    SELECT si.id, si.product_id, COALESCE(si.stock_consumed, si.quantity) AS qty
    FROM public.sale_items si
    JOIN public.products p ON p.id = si.product_id
    WHERE si.sale_id = p_sale_id AND p.track_stock = true
  LOOP
    UPDATE public.products
    SET stock = COALESCE(stock, 0) + r.qty,
        is_available = true,
        updated_at = now()
    WHERE id = r.product_id;
  END LOOP;

  SELECT COALESCE(array_agg(id), ARRAY[]::uuid[]) INTO v_item_ids
  FROM public.sale_items WHERE sale_id = p_sale_id;

  IF array_length(v_item_ids, 1) IS NOT NULL THEN
    PERFORM public.restore_component_stock(v_item_ids);
  END IF;

  RETURN true;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.cancel_sale_and_restore_stock(uuid, uuid, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.cancel_sale_and_restore_stock(uuid, uuid, text, text) TO authenticated;

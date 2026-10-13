/*
# Update order item quantity and recalculate total

1. Purpose
- Adds one server-side operation for changing an unpaid order item's quantity.
- Recalculates the parent order total from the stored item prices and options.
2. Modified data
- `order_items.qty` is updated only for an item belonging to the requested order.
- `orders.total` is recalculated from all remaining item quantities and option deltas.
3. Safety
- Only BROUILLON and VALIDE orders can be changed.
- Quantities must be integers from 0 through 100.
- The function uses the existing table permissions of this single-tenant staff app.
4. Compatibility
- Existing rows and columns are unchanged.
- Quantity zero remains the existing cancellation representation.
*/

CREATE OR REPLACE FUNCTION public.update_order_item_quantity(
  p_order_item_id uuid,
  p_quantity integer
)
RETURNS void
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_order_id uuid;
BEGIN
  IF p_quantity IS NULL OR p_quantity < 0 OR p_quantity > 100 THEN
    RAISE EXCEPTION 'Invalid quantity';
  END IF;

  SELECT order_id INTO v_order_id
  FROM public.order_items
  WHERE id = p_order_item_id;

  IF v_order_id IS NULL THEN
    RAISE EXCEPTION 'Order item not found';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.orders
    WHERE id = v_order_id
      AND statut IN ('BROUILLON', 'VALIDE')
  ) THEN
    RAISE EXCEPTION 'Order cannot be changed';
  END IF;

  UPDATE public.order_items
  SET qty = p_quantity
  WHERE id = p_order_item_id;

  UPDATE public.orders o
  SET total = COALESCE((
    SELECT SUM(
      oi.qty * (
        oi.prix_snapshot + COALESCE((
          SELECT SUM(oio.prix_delta_snapshot)
          FROM public.order_item_options oio
          WHERE oio.order_item_id = oi.id
        ), 0)
      )
    )
    FROM public.order_items oi
    WHERE oi.order_id = o.id
  ), 0),
  updated_at = now()
  WHERE o.id = v_order_id;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.update_order_item_quantity(uuid, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.update_order_item_quantity(uuid, integer) TO anon, authenticated;
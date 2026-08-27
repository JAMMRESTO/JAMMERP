/*
# Batch direct order persistence

1. Purpose
- Replace the browser's sequential per-item writes used by direct sales with one server-side operation.
- Create or update a direct order, its line items, and selected options in one database transaction.

2. Modified database objects
- `orders`: inserts new DIRECT orders or updates an existing direct order's status and total.
- `order_items`: inserts new lines or updates matching product lines for a direct order.
- `order_item_options`: replaces the selected options for each affected line so edits remain accurate.

3. New function
- `save_direct_order(order_id, caissier_id, total, status, items)`
- Returns the order UUID and generated ticket number.
- `items` is JSONB containing product_id, product name, unit price, quantity, notes, and options.

4. Security
- SECURITY INVOKER preserves the existing RLS rules on orders, order_items, and order_item_options.
- Execution is granted to anon and authenticated because this internal application uses its existing PIN-based staff access and its current anon-key policies.
- The function only creates or updates DIRECT orders and validates the allowed order status values.

5. Important notes
- No existing rows are deleted except selected option rows for a line being intentionally rewritten during an edit.
- The operation is atomic inside PostgreSQL, so a partial order cannot be left behind if one item fails.
*/

CREATE OR REPLACE FUNCTION public.save_direct_order(
  p_order_id uuid,
  p_caissier_id uuid,
  p_total integer,
  p_status text,
  p_items jsonb
)
RETURNS TABLE(order_id uuid, ticket_number text)
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_order_id uuid := p_order_id;
  v_item jsonb;
  v_option jsonb;
  v_order_item_id uuid;
BEGIN
  IF p_status NOT IN ('BROUILLON', 'VALIDE') THEN
    RAISE EXCEPTION 'Invalid direct order status';
  END IF;

  IF v_order_id IS NULL THEN
    INSERT INTO public.orders (
      table_id, serveur_id, caissier_id, order_type, statut, total
    ) VALUES (
      NULL, NULL, p_caissier_id, 'DIRECT', p_status, p_total
    )
    RETURNING id INTO v_order_id;
  ELSE
    UPDATE public.orders
    SET statut = p_status,
        total = p_total,
        caissier_id = COALESCE(p_caissier_id, caissier_id),
        updated_at = now()
    WHERE id = v_order_id
      AND order_type = 'DIRECT';

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Direct order not found';
    END IF;
  END IF;

  FOR v_item IN SELECT value FROM jsonb_array_elements(COALESCE(p_items, '[]'::jsonb)) LOOP
    SELECT id INTO v_order_item_id
    FROM public.order_items
    WHERE order_id = v_order_id
      AND product_id = (v_item->>'product_id')::uuid
    LIMIT 1;

    IF v_order_item_id IS NULL THEN
      INSERT INTO public.order_items (
        order_id, product_id, nom_snapshot, prix_snapshot, qty, printed_qty, notes
      ) VALUES (
        v_order_id,
        (v_item->>'product_id')::uuid,
        v_item->>'nom_snapshot',
        (v_item->>'prix_snapshot')::integer,
        (v_item->>'qty')::integer,
        0,
        COALESCE(v_item->>'notes', '')
      )
      RETURNING id INTO v_order_item_id;
    ELSE
      UPDATE public.order_items
      SET nom_snapshot = v_item->>'nom_snapshot',
          prix_snapshot = (v_item->>'prix_snapshot')::integer,
          qty = (v_item->>'qty')::integer,
          notes = COALESCE(v_item->>'notes', '')
      WHERE id = v_order_item_id;
      DELETE FROM public.order_item_options WHERE order_item_id = v_order_item_id;
    END IF;

    FOR v_option IN SELECT value FROM jsonb_array_elements(COALESCE(v_item->'options', '[]'::jsonb)) LOOP
      INSERT INTO public.order_item_options (
        order_item_id, nom_snapshot, prix_delta_snapshot
      ) VALUES (
        v_order_item_id,
        v_option->>'nom_snapshot',
        (v_option->>'prix_delta_snapshot')::integer
      );
    END LOOP;
  END LOOP;

  RETURN QUERY
  SELECT o.id, o.ticket_number
  FROM public.orders AS o
  WHERE o.id = v_order_id;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.save_direct_order(uuid, uuid, integer, text, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.save_direct_order(uuid, uuid, integer, text, jsonb) TO anon, authenticated;
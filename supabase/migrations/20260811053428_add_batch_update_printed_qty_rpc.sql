/*
# Batch update printed_qty for fabrication tickets

1. Purpose
- Replaces N individual UPDATE round-trips with a single RPC call when
  marking items as printed during fabrication ticket dispatch.
2. Security
- SECURITY INVOKER so existing row-level policies on order_items remain active.
- Restricted to authenticated staff sessions.
3. New Function
- batch_update_printed_qty(items jsonb): each element has {id: uuid, printed_qty: int}
- Updates the given rows in a single statement.
*/

CREATE OR REPLACE FUNCTION batch_update_printed_qty(items jsonb)
RETURNS void
LANGUAGE sql
SECURITY INVOKER
SET search_path = public
AS $$
  UPDATE order_items
  SET printed_qty = v.printed_qty
  FROM (
    SELECT
      (j->>'id')::uuid AS id,
      (j->>'printed_qty')::int AS printed_qty
    FROM jsonb_array_elements(items) AS j
  ) AS v
  WHERE order_items.id = v.id;
$$;

REVOKE EXECUTE ON FUNCTION batch_update_printed_qty(jsonb) FROM anon;
GRANT EXECUTE ON FUNCTION batch_update_printed_qty(jsonb) TO authenticated;
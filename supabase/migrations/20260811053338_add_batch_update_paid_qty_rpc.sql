/*
# Batch update paid_qty for split-bill payments

1. Purpose
- Replaces N individual UPDATE round-trips with a single RPC call when
  recording partial payments in the split-bill flow.
2. Security
- SECURITY INVOKER so existing row-level policies on order_items remain active.
- Restricted to authenticated staff sessions.
3. New Function
- batch_update_paid_qty(items jsonb): each element has {id: uuid, paid_qty: int}
- Updates the given rows in a single statement.
*/

CREATE OR REPLACE FUNCTION batch_update_paid_qty(items jsonb)
RETURNS void
LANGUAGE sql
SECURITY INVOKER
SET search_path = public
AS $$
  UPDATE order_items
  SET paid_qty = v.paid_qty
  FROM (
    SELECT
      (j->>'id')::uuid AS id,
      (j->>'paid_qty')::int AS paid_qty
    FROM jsonb_array_elements(items) AS j
  ) AS v
  WHERE order_items.id = v.id;
$$;

REVOKE EXECUTE ON FUNCTION batch_update_paid_qty(jsonb) FROM anon;
GRANT EXECUTE ON FUNCTION batch_update_paid_qty(jsonb) TO authenticated;
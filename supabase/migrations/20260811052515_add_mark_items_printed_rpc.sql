-- Single-call batch update: sets printed_qty = qty for all given item IDs
-- Replaces N individual UPDATE round-trips with one RPC call.
CREATE OR REPLACE FUNCTION mark_items_printed(item_ids uuid[])
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE order_items
  SET printed_qty = qty
  WHERE id = ANY(item_ids);
$$;

GRANT EXECUTE ON FUNCTION mark_items_printed(uuid[]) TO authenticated, anon;
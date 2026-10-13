/*
# Add paid_qty to order_items for split-bill support

## Summary
Adds a `paid_qty` column to `order_items` to track how many units of each item
have been paid for during a split-bill payment process. This allows the cashier
to pay items in multiple rounds (one customer at a time) without losing track
of what remains unpaid.

## Changes

### order_items table
- `paid_qty` (integer, NOT NULL, default 0): tracks how many units of this item
  have been covered by a payment. When `paid_qty = qty` for all items on an
  order, the order is fully paid.

## Security
- RLS already enabled on order_items; existing policies cover the new column.
- No new policies needed.
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'order_items' AND column_name = 'paid_qty'
  ) THEN
    ALTER TABLE order_items ADD COLUMN paid_qty integer NOT NULL DEFAULT 0;
  END IF;
END $$;

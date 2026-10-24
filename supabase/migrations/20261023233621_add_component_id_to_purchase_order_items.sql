/*
# Add component_id to purchase_order_items

1. Modified Tables
- `purchase_order_items`: added `component_id` (uuid, nullable) referencing `product_components(id)`.
  This lets a purchase order line item point at a stocked component (e.g. "Tenders", "Drink") so that
  reception increments that component's stock and records a component_stock_movement, instead of (or
  in addition to) updating ingredient/product stock.

2. Security
- No new tables. The existing site-scoped RLS policies on `purchase_order_items` continue to govern
  access; the new column is covered by the existing grant to `authenticated`.
- The FK target `product_components` is already RLS-enabled and site-scoped.
*/

ALTER TABLE purchase_order_items
  ADD COLUMN IF NOT EXISTS component_id uuid REFERENCES product_components(id) ON DELETE SET NULL;

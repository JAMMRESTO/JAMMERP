/*
  # Stock deduction quantity per portion

  1. New Columns
    - `products.stock_deduction_quantity` (integer, NOT NULL, default 1)
      Coefficient: how many stock units are consumed per unit sold.
      Example: a product "TENDERS 4 PCS" with coefficient 4 sold once
      deducts 4 from stock. Price and quantity stay in commercial units.

    - `sale_items.stock_consumed` (integer, nullable)
      The actual stock consumed for this line item at time of sale.
      Stored so that cancellations restore exactly what was deducted,
      even if the product's coefficient changes later.

  2. Modified Trigger
    - `handle_sale_item_stock_change()` now uses COALESCE(NEW.stock_consumed,
      NEW.quantity) on INSERT and COALESCE(OLD.stock_consumed, OLD.quantity)
      on DELETE. This preserves backward compatibility: when stock_consumed
      is NULL (old rows or feature disabled), behavior is unchanged.

  3. No Security Changes
    - No new tables, no RLS policy changes.
    - Existing grants on products and sale_items already cover the new columns.
*/

-- Add stock_deduction_quantity to products
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'products' AND column_name = 'stock_deduction_quantity'
  ) THEN
    ALTER TABLE products ADD COLUMN stock_deduction_quantity integer NOT NULL DEFAULT 1;
  END IF;
END $$;

-- Add stock_consumed to sale_items (nullable for backward compat)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'sale_items' AND column_name = 'stock_consumed'
  ) THEN
    ALTER TABLE sale_items ADD COLUMN stock_consumed integer;
  END IF;
END $$;

-- Update the trigger function to use stock_consumed when available
CREATE OR REPLACE FUNCTION public.handle_sale_item_stock_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE products
    SET stock = stock - COALESCE(NEW.stock_consumed, NEW.quantity),
        is_available = CASE
          WHEN (stock - COALESCE(NEW.stock_consumed, NEW.quantity)) <= 0 THEN false
          ELSE is_available
        END
    WHERE id = NEW.product_id
      AND track_stock = true;

    RETURN NEW;

  ELSIF TG_OP = 'DELETE' THEN
    UPDATE products
    SET stock = stock + COALESCE(OLD.stock_consumed, OLD.quantity),
        is_available = CASE
          WHEN (stock + COALESCE(OLD.stock_consumed, OLD.quantity)) > 0 THEN true
          ELSE is_available
        END
    WHERE id = OLD.product_id
      AND track_stock = true;

    RETURN OLD;
  END IF;

  RETURN NULL;
END;
$$;

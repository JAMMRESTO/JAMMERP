/*
  # Auto-decrement stock on sale

  1. New Functions
    - `handle_sale_item_stock_change()` - trigger function that:
      - On INSERT: decrements `products.stock` by the sold quantity
        when `track_stock = true`. Sets `is_available = false` when
        stock reaches zero or below.
      - On DELETE: restores `products.stock` by the removed quantity
        (handles pending sale cancellation / take-back).

  2. New Triggers
    - `trg_sale_item_stock_decrement` on `sale_items` AFTER INSERT
    - `trg_sale_item_stock_restore` on `sale_items` AFTER DELETE

  3. Important Notes
    - Only affects products where `track_stock = true`
    - Stock can go negative (backorder scenario) but product is
      marked unavailable at zero
    - Restoring stock on DELETE also re-enables `is_available` if
      stock goes back above zero
*/

CREATE OR REPLACE FUNCTION public.handle_sale_item_stock_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE products
    SET stock = stock - NEW.quantity,
        is_available = CASE
          WHEN (stock - NEW.quantity) <= 0 THEN false
          ELSE is_available
        END
    WHERE id = NEW.product_id
      AND track_stock = true;

    RETURN NEW;

  ELSIF TG_OP = 'DELETE' THEN
    UPDATE products
    SET stock = stock + OLD.quantity,
        is_available = CASE
          WHEN (stock + OLD.quantity) > 0 THEN true
          ELSE is_available
        END
    WHERE id = OLD.product_id
      AND track_stock = true;

    RETURN OLD;
  END IF;

  RETURN NULL;
END;
$$;

CREATE TRIGGER trg_sale_item_stock_decrement
  AFTER INSERT ON sale_items
  FOR EACH ROW
  EXECUTE FUNCTION handle_sale_item_stock_change();

CREATE TRIGGER trg_sale_item_stock_restore
  AFTER DELETE ON sale_items
  FOR EACH ROW
  EXECUTE FUNCTION handle_sale_item_stock_change();

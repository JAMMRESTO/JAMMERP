/*
  # Propagate category track_stock to products

  1. New Functions
    - `propagate_category_track_stock()` - trigger function that:
      - On UPDATE of categories.track_stock: updates all products
        in that category to match the new track_stock value.
      - When track_stock changes to false: also sets is_available = true
        on all products in the category (so they become sellable again).

  2. New Triggers
    - `trg_category_track_stock_propagate` on `categories` AFTER UPDATE

  3. Important Notes
    - Ensures that changing a category's stock tracking immediately
      applies to all its existing products
    - Products without stock tracking are always available for sale
*/

CREATE OR REPLACE FUNCTION public.propagate_category_track_stock()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF OLD.track_stock IS DISTINCT FROM NEW.track_stock THEN
    IF NEW.track_stock = false THEN
      UPDATE products
      SET track_stock = false,
          is_available = true
      WHERE category_id = NEW.id;
    ELSE
      UPDATE products
      SET track_stock = true
      WHERE category_id = NEW.id;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_category_track_stock_propagate
  AFTER UPDATE ON categories
  FOR EACH ROW
  EXECUTE FUNCTION propagate_category_track_stock();

/*
  # Auto-reset table status when order is closed or cancelled

  ## Purpose
  When an order transitions to PAYEE, CLOTUREE, or ANNULEE status, its
  associated table should automatically be set back to LIBRE — preventing
  tables from getting stuck in A_ENCAISSER or OCCUPEE with no active order.

  ## Changes
  - New function: `reset_table_on_order_close()` — checks if the table has
    any other active orders before resetting to LIBRE
  - New trigger: `trg_reset_table_on_order_close` — fires AFTER UPDATE on
    orders when statut changes to a terminal value

  ## Notes
  - Only resets if no other non-terminal orders exist for that table
  - Terminal statuses: PAYEE, CLOTUREE, ANNULEE
*/

CREATE OR REPLACE FUNCTION reset_table_on_order_close()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.table_id IS NOT NULL
    AND NEW.statut IN ('PAYEE', 'CLOTUREE', 'ANNULEE')
    AND (OLD.statut IS NULL OR OLD.statut NOT IN ('PAYEE', 'CLOTUREE', 'ANNULEE'))
  THEN
    IF NOT EXISTS (
      SELECT 1 FROM orders
      WHERE table_id = NEW.table_id
        AND id <> NEW.id
        AND statut NOT IN ('PAYEE', 'CLOTUREE', 'ANNULEE')
    ) THEN
      UPDATE tables SET statut = 'LIBRE' WHERE id = NEW.table_id;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_reset_table_on_order_close ON orders;

CREATE TRIGGER trg_reset_table_on_order_close
  AFTER UPDATE ON orders
  FOR EACH ROW
  EXECUTE FUNCTION reset_table_on_order_close();

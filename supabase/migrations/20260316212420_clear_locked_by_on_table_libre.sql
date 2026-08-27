/*
  # Clear locked_by when table becomes LIBRE

  ## Purpose
  When a table's status is reset to LIBRE (either via the auto-reset trigger
  when an order is paid/closed, or manually), the locked_by field must also
  be cleared so the table is fully available to any server.

  ## Changes
  - Updates the `reset_table_on_order_close` function to also set `locked_by = NULL`
    when resetting the table to LIBRE
  - Adds a new trigger function `clear_lock_on_table_libre` that fires on direct
    UPDATE to the tables table, clearing locked_by whenever statut becomes LIBRE

  ## Notes
  - This ensures no table stays locked after encaissement, regardless of the
    code path that freed it
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
      UPDATE tables SET statut = 'LIBRE', locked_by = NULL WHERE id = NEW.table_id;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION clear_lock_on_table_libre()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.statut = 'LIBRE' AND OLD.statut <> 'LIBRE' THEN
    NEW.locked_by := NULL;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_clear_lock_on_table_libre ON tables;

CREATE TRIGGER trg_clear_lock_on_table_libre
  BEFORE UPDATE ON tables
  FOR EACH ROW
  EXECUTE FUNCTION clear_lock_on_table_libre();

-- Recreate the missing trigger and functions that clear locked_by when a table becomes LIBRE.
-- The original migration (20260316212420) was never applied to this database.

-- 1. Function that auto-resets a table to LIBRE + clears locked_by when its order is paid/closed/annulled
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

-- 2. Trigger on orders table (drop if exists first, in case a partial version exists)
DROP TRIGGER IF EXISTS trg_reset_table_on_order_close ON orders;
CREATE TRIGGER trg_reset_table_on_order_close
  AFTER UPDATE ON orders
  FOR EACH ROW
  EXECUTE FUNCTION reset_table_on_order_close();

-- 3. Function that clears locked_by whenever a table's statut becomes LIBRE or A_ENCAISSER
CREATE OR REPLACE FUNCTION clear_lock_on_table_libre()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Use IS DISTINCT FROM to safely handle NULL old.statut
  IF NEW.statut = 'LIBRE' AND (OLD.statut IS DISTINCT FROM 'LIBRE') THEN
    NEW.locked_by := NULL;
  END IF;
  -- Also clear locked_by when the bill is requested (server is done with the table)
  IF NEW.statut = 'A_ENCAISSER' AND (OLD.statut IS DISTINCT FROM 'A_ENCAISSER') THEN
    NEW.locked_by := NULL;
  END IF;
  RETURN NEW;
END;
$$;

-- 4. Trigger on tables table
DROP TRIGGER IF EXISTS trg_clear_lock_on_table_libre ON tables;
CREATE TRIGGER trg_clear_lock_on_table_libre
  BEFORE UPDATE ON tables
  FOR EACH ROW
  EXECUTE FUNCTION clear_lock_on_table_libre();

-- 5. One-time cleanup: unstick tables that are LIBRE but still have a stale locked_by
UPDATE tables SET locked_by = NULL WHERE statut = 'LIBRE' AND locked_by IS NOT NULL;

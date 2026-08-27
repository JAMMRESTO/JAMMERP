/*
  # Auto-update client balance via triggers

  ## Summary
  Creates a function and triggers to automatically keep `clients.balance`
  synchronized with the actual outstanding amount owed by each client.

  ## Logic
  The balance is computed as:
    SUM of `reste_a_payer` on all non-cancelled invoices for the client.

  ## Triggers
  - After INSERT, UPDATE, DELETE on `factures`
  - After INSERT, UPDATE, DELETE on `paiements`

  ## Notes
  - Uses `SECURITY DEFINER` so the function runs with elevated privileges
  - Safe to run multiple times (idempotent)
*/

CREATE OR REPLACE FUNCTION recalculate_client_balance(p_client_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_balance numeric(15,2);
BEGIN
  SELECT COALESCE(SUM(reste_a_payer), 0)
    INTO v_balance
    FROM factures
   WHERE client_id = p_client_id
     AND statut NOT IN ('annulée');

  UPDATE clients
     SET balance = v_balance
   WHERE id = p_client_id;
END;
$$;

CREATE OR REPLACE FUNCTION trigger_update_client_balance_from_facture()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    PERFORM recalculate_client_balance(OLD.client_id);
  ELSIF TG_OP = 'INSERT' THEN
    PERFORM recalculate_client_balance(NEW.client_id);
  ELSE
    IF OLD.client_id IS DISTINCT FROM NEW.client_id THEN
      PERFORM recalculate_client_balance(OLD.client_id);
    END IF;
    PERFORM recalculate_client_balance(NEW.client_id);
  END IF;
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_client_balance_on_facture ON factures;
CREATE TRIGGER trg_client_balance_on_facture
  AFTER INSERT OR UPDATE OR DELETE ON factures
  FOR EACH ROW EXECUTE FUNCTION trigger_update_client_balance_from_facture();

CREATE OR REPLACE FUNCTION trigger_update_client_balance_from_paiement()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_client_id uuid;
BEGIN
  IF TG_OP = 'DELETE' THEN
    SELECT client_id INTO v_client_id FROM factures WHERE id = OLD.facture_id;
    IF v_client_id IS NOT NULL THEN
      PERFORM recalculate_client_balance(v_client_id);
    END IF;
  ELSE
    SELECT client_id INTO v_client_id FROM factures WHERE id = NEW.facture_id;
    IF v_client_id IS NOT NULL THEN
      PERFORM recalculate_client_balance(v_client_id);
    END IF;
  END IF;
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_client_balance_on_paiement ON paiements;
CREATE TRIGGER trg_client_balance_on_paiement
  AFTER INSERT OR UPDATE OR DELETE ON paiements
  FOR EACH ROW EXECUTE FUNCTION trigger_update_client_balance_from_paiement();

DO $$
DECLARE
  r record;
BEGIN
  FOR r IN SELECT DISTINCT client_id FROM factures WHERE client_id IS NOT NULL LOOP
    PERFORM recalculate_client_balance(r.client_id);
  END LOOP;
END;
$$;

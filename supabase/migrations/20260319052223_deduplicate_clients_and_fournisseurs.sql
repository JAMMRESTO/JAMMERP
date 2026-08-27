/*
  # Deduplicate clients and fournisseurs, add unique constraints

  1. Changes
    - Remove duplicate clients within the same company (keeping the record with the highest balance, then most recent)
    - Remove duplicate fournisseurs within the same company (same logic)
    - Add unique constraint on clients (company_id, lower(name), phone) to prevent future duplicates
    - Add unique constraint on fournisseurs (company_id, lower(name), phone) to prevent future duplicates

  2. Important Notes
    - Duplicates are identified by matching company_id + name (case-insensitive) + phone
    - The record with the highest absolute balance is kept; ties broken by most recent created_at
    - Foreign key references (factures, paiements, etc.) are updated to point to the kept record before deletion
*/

-- Step 1: Deduplicate clients
DO $$
DECLARE
  dup RECORD;
  keeper_id uuid;
  to_delete uuid[];
BEGIN
  FOR dup IN
    SELECT company_id, lower(name) AS lname, phone
    FROM clients
    GROUP BY company_id, lower(name), phone
    HAVING count(*) > 1
  LOOP
    SELECT id INTO keeper_id
    FROM clients
    WHERE company_id = dup.company_id
      AND lower(name) = dup.lname
      AND phone = dup.phone
    ORDER BY abs(balance) DESC, created_at DESC
    LIMIT 1;

    SELECT array_agg(id) INTO to_delete
    FROM clients
    WHERE company_id = dup.company_id
      AND lower(name) = dup.lname
      AND phone = dup.phone
      AND id != keeper_id;

    UPDATE factures SET client_id = keeper_id WHERE client_id = ANY(to_delete);
    UPDATE devis SET client_id = keeper_id WHERE client_id = ANY(to_delete);
    UPDATE paiements SET client_id = keeper_id WHERE client_id = ANY(to_delete);
    UPDATE retours SET client_id = keeper_id WHERE client_id = ANY(to_delete);
    UPDATE pos_ventes SET client_id = keeper_id WHERE client_id = ANY(to_delete);

    DELETE FROM clients WHERE id = ANY(to_delete);
  END LOOP;
END $$;

-- Step 2: Deduplicate fournisseurs
DO $$
DECLARE
  dup RECORD;
  keeper_id uuid;
  to_delete uuid[];
BEGIN
  FOR dup IN
    SELECT company_id, lower(name) AS lname, phone
    FROM fournisseurs
    GROUP BY company_id, lower(name), phone
    HAVING count(*) > 1
  LOOP
    SELECT id INTO keeper_id
    FROM fournisseurs
    WHERE company_id = dup.company_id
      AND lower(name) = dup.lname
      AND phone = dup.phone
    ORDER BY abs(balance) DESC, created_at DESC
    LIMIT 1;

    SELECT array_agg(id) INTO to_delete
    FROM fournisseurs
    WHERE company_id = dup.company_id
      AND lower(name) = dup.lname
      AND phone = dup.phone
      AND id != keeper_id;

    UPDATE factures_fournisseurs SET fournisseur_id = keeper_id WHERE fournisseur_id = ANY(to_delete);

    DELETE FROM fournisseurs WHERE id = ANY(to_delete);
  END LOOP;
END $$;

-- Step 3: Add unique constraints
CREATE UNIQUE INDEX IF NOT EXISTS idx_clients_unique_name_phone
  ON clients (company_id, lower(name), phone);

CREATE UNIQUE INDEX IF NOT EXISTS idx_fournisseurs_unique_name_phone
  ON fournisseurs (company_id, lower(name), phone);

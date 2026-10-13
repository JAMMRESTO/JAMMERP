/*
  # Fix cash_closures and cash_movements RLS for import/upsert

  1. Changes
    - Add SELECT policy for anon on cash_closures (needed for upsert conflict detection)
    - Add UPDATE policy for anon on cash_closures (needed for upsert of existing rows)
    - Add SELECT policy for anon on cash_movements (needed for upsert conflict detection)
    - Add UPDATE policy for anon on cash_movements (needed for upsert of existing rows)

  2. Security
    - Follows same pattern as orders, payments, cash_sessions tables
    - Anon access required for POS/cashier and data import flows
*/

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'cash_closures' AND policyname = 'Anon can select cash_closures'
  ) THEN
    CREATE POLICY "Anon can select cash_closures"
      ON cash_closures FOR SELECT
      TO anon
      USING (true);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'cash_closures' AND policyname = 'Anon can update cash_closures'
  ) THEN
    CREATE POLICY "Anon can update cash_closures"
      ON cash_closures FOR UPDATE
      TO anon
      USING (true)
      WITH CHECK (true);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'cash_movements' AND policyname = 'Anon can select cash_movements'
  ) THEN
    CREATE POLICY "Anon can select cash_movements"
      ON cash_movements FOR SELECT
      TO anon
      USING (true);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'cash_movements' AND policyname = 'Anon can update cash_movements'
  ) THEN
    CREATE POLICY "Anon can update cash_movements"
      ON cash_movements FOR UPDATE
      TO anon
      USING (true)
      WITH CHECK (true);
  END IF;
END $$;
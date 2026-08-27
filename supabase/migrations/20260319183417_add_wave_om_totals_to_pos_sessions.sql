/*
  # Ajout des totaux Wave et Orange Money dans les sessions POS

  ## Modification
  - Ajout de la colonne `total_wave` (numeric, default 0) dans `pos_sessions`
  - Ajout de la colonne `total_om` (numeric, default 0) dans `pos_sessions`

  Ces colonnes permettent de suivre séparément les encaissements Wave et Orange Money
  dans chaque session de caisse, à l'instar de `total_especes`.
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'pos_sessions' AND column_name = 'total_wave'
  ) THEN
    ALTER TABLE pos_sessions ADD COLUMN total_wave numeric DEFAULT 0 NOT NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'pos_sessions' AND column_name = 'total_om'
  ) THEN
    ALTER TABLE pos_sessions ADD COLUMN total_om numeric DEFAULT 0 NOT NULL;
  END IF;
END $$;

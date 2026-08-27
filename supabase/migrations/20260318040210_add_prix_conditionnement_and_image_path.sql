/*
  # Add prix_conditionnement and image_path to produits

  1. Changes
    - `prix_conditionnement` (numeric): specific price for the packaging/conditionnement unit, 
       independent from prix_vente (unit price). If null, falls back to prix_vente * quantite.
    - `image_path` (text): local file path/data URL for product images uploaded from device,
       as an alternative to image_url (external URL).

  2. Notes
    - Both columns are nullable and optional
    - Existing data is preserved
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'produits' AND column_name = 'prix_conditionnement'
  ) THEN
    ALTER TABLE produits ADD COLUMN prix_conditionnement numeric(15,2) DEFAULT NULL;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'produits' AND column_name = 'image_path'
  ) THEN
    ALTER TABLE produits ADD COLUMN image_path text DEFAULT NULL;
  END IF;
END $$;

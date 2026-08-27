/*
  # Add document template settings to companies

  1. Modified Tables
    - `companies`
      - `template_facture` (text, default 'classic') - Selected invoice/quote template style
      - `template_ticket` (text, default 'classic') - Selected POS receipt template style

  2. Notes
    - Template options: 'classic', 'modern', 'elegant', 'minimal'
    - These columns store the user's preferred document design for printing
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'companies' AND column_name = 'template_facture'
  ) THEN
    ALTER TABLE companies ADD COLUMN template_facture text NOT NULL DEFAULT 'classic';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'companies' AND column_name = 'template_ticket'
  ) THEN
    ALTER TABLE companies ADD COLUMN template_ticket text NOT NULL DEFAULT 'classic';
  END IF;
END $$;

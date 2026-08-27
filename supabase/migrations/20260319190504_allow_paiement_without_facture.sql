/*
  # Permettre les paiements d'encours sans facture associée

  ## Contexte
  Actuellement la colonne `facture_id` dans la table `paiements` est NOT NULL,
  ce qui empêche d'enregistrer un encaissement d'encours initial (balance) d'un
  client sans le rattacher à une facture de vente.

  ## Modifications
  1. `paiements.facture_id` : passage en nullable pour autoriser les paiements
     d'encours sans facture
  2. Ajout de la colonne `type_paiement` (text, default 'facture') permettant
     de distinguer :
     - 'facture'  : paiement lié à une facture (comportement actuel)
     - 'encours'  : encaissement d'un encours initial non lié à une facture

  ## Sécurité
  Les politiques RLS existantes restent inchangées.
*/

ALTER TABLE paiements
  ALTER COLUMN facture_id DROP NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'paiements' AND column_name = 'type_paiement'
  ) THEN
    ALTER TABLE paiements ADD COLUMN type_paiement text NOT NULL DEFAULT 'facture';
  END IF;
END $$;

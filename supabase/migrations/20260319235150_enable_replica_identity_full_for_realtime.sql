/*
  # Enable REPLICA IDENTITY FULL for realtime subscriptions

  ## Purpose
  Supabase realtime with row-level filtering on non-primary-key columns (like company_id)
  requires REPLICA IDENTITY FULL to be set on tables. Without this, filtered realtime 
  subscriptions may not fire reliably.

  ## Changes
  - Set REPLICA IDENTITY FULL on all business tables used with realtime subscriptions
  - This ensures change events include full row data needed for company_id filtering
*/

ALTER TABLE clients REPLICA IDENTITY FULL;
ALTER TABLE factures REPLICA IDENTITY FULL;
ALTER TABLE factures_fournisseurs REPLICA IDENTITY FULL;
ALTER TABLE paiements REPLICA IDENTITY FULL;
ALTER TABLE depenses REPLICA IDENTITY FULL;
ALTER TABLE produits REPLICA IDENTITY FULL;
ALTER TABLE pos_ventes REPLICA IDENTITY FULL;
ALTER TABLE devis REPLICA IDENTITY FULL;
ALTER TABLE fournisseurs REPLICA IDENTITY FULL;
ALTER TABLE mouvements_stock REPLICA IDENTITY FULL;

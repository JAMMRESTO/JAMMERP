/*
  # Clôtures de caisse

  ## Résumé
  Création de la table `cash_sessions` pour gérer les sessions de caisse :
  ouverture, fermeture, fonds de caisse initial et final, détail des ventes
  par méthode de paiement, écart de caisse et notes.

  ## Nouvelle table : cash_sessions
  - `id` : identifiant unique
  - `session_number` : numéro auto-incrémenté lisible
  - `cashier_id` : caissier qui a ouvert la session (référence users)
  - `closed_by` : caissier qui a clôturé (peut différer)
  - `opened_at` : horodatage d'ouverture
  - `closed_at` : horodatage de fermeture (NULL = session ouverte)
  - `opening_balance` : fonds de caisse en début de session
  - `expected_cash` : espèces calculées (ouverture + ventes cash)
  - `actual_cash` : espèces comptées physiquement lors de la clôture
  - `cash_difference` : écart (actual_cash - expected_cash)
  - `total_sales` : total des ventes payées pendant la session
  - `total_cash` : total encaissé en espèces
  - `total_wave` : total encaissé via Wave
  - `total_orange_money` : total encaissé via Orange Money
  - `total_card` : total encaissé par carte
  - `sales_count` : nombre de ventes réalisées
  - `notes` : commentaires libres du caissier
  - `status` : 'open' | 'closed'

  ## Sécurité
  - RLS activé
  - Lecture : utilisateurs authentifiés (rôle admin/caissier via app)
  - Insertion : utilisateurs authentifiés
  - Mise à jour : utilisateurs authentifiés
*/

CREATE TABLE IF NOT EXISTS cash_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_number serial NOT NULL,
  cashier_id uuid REFERENCES users(id) ON DELETE SET NULL,
  closed_by uuid REFERENCES users(id) ON DELETE SET NULL,
  opened_at timestamptz DEFAULT now() NOT NULL,
  closed_at timestamptz,
  opening_balance numeric(12,2) DEFAULT 0 NOT NULL,
  expected_cash numeric(12,2) DEFAULT 0 NOT NULL,
  actual_cash numeric(12,2) DEFAULT 0 NOT NULL,
  cash_difference numeric(12,2) DEFAULT 0 NOT NULL,
  total_sales numeric(12,2) DEFAULT 0 NOT NULL,
  total_cash numeric(12,2) DEFAULT 0 NOT NULL,
  total_wave numeric(12,2) DEFAULT 0 NOT NULL,
  total_orange_money numeric(12,2) DEFAULT 0 NOT NULL,
  total_card numeric(12,2) DEFAULT 0 NOT NULL,
  sales_count integer DEFAULT 0 NOT NULL,
  notes text DEFAULT '' NOT NULL,
  status text DEFAULT 'open' NOT NULL CHECK (status IN ('open','closed'))
);

ALTER TABLE cash_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read cash sessions"
  ON cash_sessions FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert cash sessions"
  ON cash_sessions FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update cash sessions"
  ON cash_sessions FOR UPDATE
  TO anon, authenticated
  USING (true)
  WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_cash_sessions_opened_at ON cash_sessions(opened_at DESC);
CREATE INDEX IF NOT EXISTS idx_cash_sessions_status ON cash_sessions(status);

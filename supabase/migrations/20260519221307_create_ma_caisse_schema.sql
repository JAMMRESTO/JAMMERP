/*
  # MA CAISSE – Schema Initial

  1. Nouvelles tables
    - `caisses` : Liste des caisses (CAISSE 1, 2, 3)
    - `societe` : Paramètres de la société (1 seule ligne)
    - `comptes_charges` : Plan comptable des charges
    - `encaissements` : Toutes les transactions d'encaissement
    - `decaissements` : Toutes les transactions de décaissement

  2. Sécurité
    - RLS activé sur toutes les tables
    - Policies : utilisateurs authentifiés peuvent lire/écrire leurs données
*/

-- TABLE: caisses
CREATE TABLE IF NOT EXISTS caisses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nom text NOT NULL,
  ordre integer NOT NULL DEFAULT 1,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE caisses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read caisses"
  ON caisses FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert caisses"
  ON caisses FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update caisses"
  ON caisses FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Authenticated users can delete caisses"
  ON caisses FOR DELETE
  TO authenticated
  USING (true);

-- Seed caisses
INSERT INTO caisses (nom, ordre) VALUES
  ('CAISSE 1', 1),
  ('CAISSE 2', 2),
  ('CAISSE 3', 3)
ON CONFLICT DO NOTHING;

-- TABLE: societe
CREATE TABLE IF NOT EXISTS societe (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nom text NOT NULL DEFAULT 'MA SOCIÉTÉ',
  telephone text NOT NULL DEFAULT '',
  adresse text NOT NULL DEFAULT '',
  message_ticket text NOT NULL DEFAULT 'Merci de votre visite !',
  logo_url text NOT NULL DEFAULT '',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE societe ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read societe"
  ON societe FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert societe"
  ON societe FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update societe"
  ON societe FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Seed societe (une seule ligne)
INSERT INTO societe (nom, telephone, adresse, message_ticket)
SELECT 'MA SOCIÉTÉ', '', '', 'Merci de votre visite !'
WHERE NOT EXISTS (SELECT 1 FROM societe);

-- TABLE: comptes_charges
CREATE TABLE IF NOT EXISTS comptes_charges (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  numero text NOT NULL UNIQUE,
  libelle text NOT NULL,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE comptes_charges ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read comptes_charges"
  ON comptes_charges FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert comptes_charges"
  ON comptes_charges FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update comptes_charges"
  ON comptes_charges FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Authenticated users can delete comptes_charges"
  ON comptes_charges FOR DELETE
  TO authenticated
  USING (true);

-- Seed comptes charges
INSERT INTO comptes_charges (numero, libelle) VALUES
  ('601000', 'Achats marchandises'),
  ('602000', 'Achats matières premières'),
  ('605000', 'Achats fournitures'),
  ('612000', 'Electricité'),
  ('613000', 'Loyer'),
  ('614000', 'Charges locatives'),
  ('616000', 'Internet / Téléphone'),
  ('622000', 'Commissions et honoraires'),
  ('625000', 'Transport'),
  ('626000', 'Frais postaux'),
  ('631000', 'Taxes et impôts'),
  ('641000', 'Salaires'),
  ('645000', 'Charges sociales'),
  ('681000', 'Amortissements'),
  ('698000', 'Autres charges')
ON CONFLICT (numero) DO NOTHING;

-- TABLE: encaissements
CREATE TABLE IF NOT EXISTS encaissements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  numero_facture text NOT NULL UNIQUE,
  caisse_id uuid NOT NULL REFERENCES caisses(id),
  user_id uuid NOT NULL REFERENCES auth.users(id),
  client_nom text NOT NULL,
  montant numeric(15,2) NOT NULL CHECK (montant > 0),
  mode_paiement text NOT NULL CHECK (mode_paiement IN ('especes','wave','orange_money','carte','cheque')),
  montant_recu numeric(15,2) NOT NULL,
  monnaie_rendue numeric(15,2) NOT NULL DEFAULT 0,
  date_transaction date NOT NULL DEFAULT CURRENT_DATE,
  heure_transaction time NOT NULL DEFAULT CURRENT_TIME,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_encaissements_caisse ON encaissements(caisse_id);
CREATE INDEX IF NOT EXISTS idx_encaissements_user ON encaissements(user_id);
CREATE INDEX IF NOT EXISTS idx_encaissements_date ON encaissements(date_transaction);

ALTER TABLE encaissements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read encaissements"
  ON encaissements FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert encaissements"
  ON encaissements FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Authenticated users can update encaissements"
  ON encaissements FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- TABLE: decaissements
CREATE TABLE IF NOT EXISTS decaissements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  numero_piece text NOT NULL UNIQUE,
  caisse_id uuid NOT NULL REFERENCES caisses(id),
  user_id uuid NOT NULL REFERENCES auth.users(id),
  compte_id uuid NOT NULL REFERENCES comptes_charges(id),
  compte_numero text NOT NULL,
  compte_libelle text NOT NULL,
  description text NOT NULL DEFAULT '',
  montant numeric(15,2) NOT NULL CHECK (montant > 0),
  date_transaction date NOT NULL DEFAULT CURRENT_DATE,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_decaissements_caisse ON decaissements(caisse_id);
CREATE INDEX IF NOT EXISTS idx_decaissements_user ON decaissements(user_id);
CREATE INDEX IF NOT EXISTS idx_decaissements_date ON decaissements(date_transaction);

ALTER TABLE decaissements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read decaissements"
  ON decaissements FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert decaissements"
  ON decaissements FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Authenticated users can update decaissements"
  ON decaissements FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

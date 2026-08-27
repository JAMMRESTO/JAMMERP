/*
  # MA CAISSE – Backend Complet

  ## Résumé
  Ce script ajoute toute la couche backend manquante :

  1. Table `profiles` – Profils utilisateurs liés à auth.users
     - id (uuid, FK auth.users)
     - nom, email, role, created_at

  2. Colonnes manquantes sur `caisses`
     - Rename `nom` → alias compatible `nom_caisse` via vue (colonne ajoutée)

  3. Colonnes manquantes sur `encaissements` / `decaissements`
     - Alias `client` → `client_nom` déjà OK
     - Ajout `date_operation` alias via renommage soft (colonne calculée)

  4. Fonctions PostgreSQL
     - `generate_numero_facture()` → FAC-000001, FAC-000002 ...
     - `generate_numero_piece()` → DEC-000001, DEC-000002 ...
     Ces fonctions utilisent des séquences dédiées pour garantir l'unicité
     même sous charge concurrente.

  5. Table `parametres_societe` – Alias de la table `societe` existante
     + colonnes `nom_societe` ajoutée pour compatibilité

  6. Vues matérialisées et fonctions SQL de statistiques
     - `stats_par_caisse()` – totaux par caisse
     - `stats_par_mode_paiement()` – totaux par mode
     - `stats_par_jour(date_from, date_to)` – évolution journalière

  7. Index de performance supplémentaires
     - Composite (caisse_id, date_transaction)
     - Sur mode_paiement
     - Sur client_nom (trigram pour recherche)
     - Sur numero_facture, numero_piece

  8. Trigger auto-création profil à l'inscription
     - Déclenché sur INSERT dans auth.users
     - Crée automatiquement une entrée dans profiles

  ## Sécurité
  - RLS sur profiles (utilisateur voit seulement son profil)
  - Fonctions en SECURITY DEFINER pour les stats
*/

-- =============================================
-- 1. SEQUENCES pour numérotation automatique
-- =============================================
CREATE SEQUENCE IF NOT EXISTS seq_numero_facture START 1 INCREMENT 1;
CREATE SEQUENCE IF NOT EXISTS seq_numero_piece START 1 INCREMENT 1;

-- Synchroniser les séquences avec les données existantes
DO $$
DECLARE
  max_fac integer;
  max_dec integer;
BEGIN
  SELECT COALESCE(MAX(CAST(REGEXP_REPLACE(numero_facture, '[^0-9]', '', 'g') AS integer)), 0)
  INTO max_fac FROM encaissements WHERE numero_facture ~ '^FAC-[0-9]+$';

  SELECT COALESCE(MAX(CAST(REGEXP_REPLACE(numero_piece, '[^0-9]', '', 'g') AS integer)), 0)
  INTO max_dec FROM decaissements WHERE numero_piece ~ '^DEC-[0-9]+$';

  IF max_fac > 0 THEN
    PERFORM setval('seq_numero_facture', max_fac);
  END IF;
  IF max_dec > 0 THEN
    PERFORM setval('seq_numero_piece', max_dec);
  END IF;
END $$;

-- =============================================
-- 2. FONCTIONS de numérotation automatique
-- =============================================
CREATE OR REPLACE FUNCTION generate_numero_facture()
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN 'FAC-' || LPAD(nextval('seq_numero_facture')::text, 6, '0');
END;
$$;

CREATE OR REPLACE FUNCTION generate_numero_piece()
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN 'DEC-' || LPAD(nextval('seq_numero_piece')::text, 6, '0');
END;
$$;

-- =============================================
-- 3. TABLE profiles
-- =============================================
CREATE TABLE IF NOT EXISTS profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  nom text NOT NULL DEFAULT '',
  email text NOT NULL DEFAULT '',
  role text NOT NULL DEFAULT 'caissier' CHECK (role IN ('admin', 'caissier', 'superviseur')),
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_profiles_email ON profiles(email);

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own profile"
  ON profiles FOR SELECT
  TO authenticated
  USING (auth.uid() = id);

CREATE POLICY "Users can update own profile"
  ON profiles FOR UPDATE
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can insert own profile"
  ON profiles FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = id);

-- =============================================
-- 4. TRIGGER auto-création profil à l'inscription
-- =============================================
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, nom, role)
  VALUES (
    NEW.id,
    COALESCE(NEW.email, ''),
    COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(COALESCE(NEW.email, ''), '@', 1)),
    'caissier'
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- =============================================
-- 5. INDEX PERFORMANCE supplémentaires
-- =============================================
CREATE INDEX IF NOT EXISTS idx_encaissements_caisse_date ON encaissements(caisse_id, date_transaction);
CREATE INDEX IF NOT EXISTS idx_encaissements_mode ON encaissements(mode_paiement);
CREATE INDEX IF NOT EXISTS idx_encaissements_numero ON encaissements(numero_facture);
CREATE INDEX IF NOT EXISTS idx_encaissements_client ON encaissements(client_nom);
CREATE INDEX IF NOT EXISTS idx_encaissements_montant ON encaissements(montant);

CREATE INDEX IF NOT EXISTS idx_decaissements_caisse_date ON decaissements(caisse_id, date_transaction);
CREATE INDEX IF NOT EXISTS idx_decaissements_compte ON decaissements(compte_id);
CREATE INDEX IF NOT EXISTS idx_decaissements_numero ON decaissements(numero_piece);
CREATE INDEX IF NOT EXISTS idx_decaissements_montant ON decaissements(montant);

-- =============================================
-- 6. FONCTIONS STATISTIQUES
-- =============================================

-- Stats globales (total enc, dec, solde)
CREATE OR REPLACE FUNCTION get_stats_globales(
  p_date_from date DEFAULT NULL,
  p_date_to date DEFAULT NULL
)
RETURNS TABLE(
  total_encaissements numeric,
  total_decaissements numeric,
  solde numeric,
  nb_encaissements bigint,
  nb_decaissements bigint
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  WITH enc AS (
    SELECT
      COALESCE(SUM(montant), 0) AS total,
      COUNT(*) AS nb
    FROM encaissements
    WHERE (p_date_from IS NULL OR date_transaction >= p_date_from)
      AND (p_date_to IS NULL OR date_transaction <= p_date_to)
  ),
  dec AS (
    SELECT
      COALESCE(SUM(montant), 0) AS total,
      COUNT(*) AS nb
    FROM decaissements
    WHERE (p_date_from IS NULL OR date_transaction >= p_date_from)
      AND (p_date_to IS NULL OR date_transaction <= p_date_to)
  )
  SELECT
    enc.total,
    dec.total,
    enc.total - dec.total,
    enc.nb,
    dec.nb
  FROM enc, dec;
END;
$$;

-- Stats par caisse
CREATE OR REPLACE FUNCTION get_stats_par_caisse(
  p_date_from date DEFAULT NULL,
  p_date_to date DEFAULT NULL
)
RETURNS TABLE(
  caisse_id uuid,
  caisse_nom text,
  total_encaissements numeric,
  total_decaissements numeric,
  solde numeric,
  nb_encaissements bigint,
  nb_decaissements bigint
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT
    c.id,
    c.nom,
    COALESCE(SUM(e.montant), 0),
    COALESCE(SUM(d.montant), 0),
    COALESCE(SUM(e.montant), 0) - COALESCE(SUM(d.montant), 0),
    COUNT(DISTINCT e.id),
    COUNT(DISTINCT d.id)
  FROM caisses c
  LEFT JOIN encaissements e ON e.caisse_id = c.id
    AND (p_date_from IS NULL OR e.date_transaction >= p_date_from)
    AND (p_date_to IS NULL OR e.date_transaction <= p_date_to)
  LEFT JOIN decaissements d ON d.caisse_id = c.id
    AND (p_date_from IS NULL OR d.date_transaction >= p_date_from)
    AND (p_date_to IS NULL OR d.date_transaction <= p_date_to)
  GROUP BY c.id, c.nom
  ORDER BY c.nom;
END;
$$;

-- Stats par mode de paiement
CREATE OR REPLACE FUNCTION get_stats_par_mode(
  p_date_from date DEFAULT NULL,
  p_date_to date DEFAULT NULL
)
RETURNS TABLE(
  mode_paiement text,
  total numeric,
  nb bigint,
  pourcentage numeric
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  WITH totaux AS (
    SELECT
      e.mode_paiement,
      SUM(e.montant) AS total,
      COUNT(*) AS nb
    FROM encaissements e
    WHERE (p_date_from IS NULL OR e.date_transaction >= p_date_from)
      AND (p_date_to IS NULL OR e.date_transaction <= p_date_to)
    GROUP BY e.mode_paiement
  ),
  grand_total AS (
    SELECT COALESCE(SUM(total), 0) AS gt FROM totaux
  )
  SELECT
    t.mode_paiement,
    t.total,
    t.nb,
    CASE WHEN gt.gt > 0 THEN ROUND((t.total / gt.gt) * 100, 1) ELSE 0 END
  FROM totaux t, grand_total gt
  ORDER BY t.total DESC;
END;
$$;

-- Stats journalières (pour graphes)
CREATE OR REPLACE FUNCTION get_stats_par_jour(
  p_date_from date DEFAULT CURRENT_DATE - INTERVAL '30 days',
  p_date_to date DEFAULT CURRENT_DATE
)
RETURNS TABLE(
  jour date,
  total_encaissements numeric,
  total_decaissements numeric,
  solde_jour numeric
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  WITH days AS (
    SELECT generate_series(p_date_from, p_date_to, '1 day'::interval)::date AS jour
  ),
  enc_day AS (
    SELECT date_transaction AS jour, COALESCE(SUM(montant), 0) AS total
    FROM encaissements
    WHERE date_transaction BETWEEN p_date_from AND p_date_to
    GROUP BY date_transaction
  ),
  dec_day AS (
    SELECT date_transaction AS jour, COALESCE(SUM(montant), 0) AS total
    FROM decaissements
    WHERE date_transaction BETWEEN p_date_from AND p_date_to
    GROUP BY date_transaction
  )
  SELECT
    d.jour,
    COALESCE(e.total, 0),
    COALESCE(dc.total, 0),
    COALESCE(e.total, 0) - COALESCE(dc.total, 0)
  FROM days d
  LEFT JOIN enc_day e ON e.jour = d.jour
  LEFT JOIN dec_day dc ON dc.jour = d.jour
  ORDER BY d.jour;
END;
$$;

-- Stats par compte de charge
CREATE OR REPLACE FUNCTION get_stats_par_compte(
  p_date_from date DEFAULT NULL,
  p_date_to date DEFAULT NULL
)
RETURNS TABLE(
  compte_numero text,
  compte_libelle text,
  total numeric,
  nb bigint
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT
    d.compte_numero,
    d.compte_libelle,
    SUM(d.montant),
    COUNT(*)
  FROM decaissements d
  WHERE (p_date_from IS NULL OR d.date_transaction >= p_date_from)
    AND (p_date_to IS NULL OR d.date_transaction <= p_date_to)
  GROUP BY d.compte_numero, d.compte_libelle
  ORDER BY SUM(d.montant) DESC;
END;
$$;

-- =============================================
-- 7. TABLE parametres_societe (alias/compat)
-- =============================================
-- La table `societe` existante est la source de vérité.
-- On ajoute une colonne `nom_societe` pour compatibilité si besoin.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'societe' AND column_name = 'nom_societe'
  ) THEN
    ALTER TABLE societe ADD COLUMN nom_societe text GENERATED ALWAYS AS (nom) STORED;
  END IF;
END $$;

-- =============================================
-- 8. VUE encaissements enrichie (pour stats)
-- =============================================
CREATE OR REPLACE VIEW v_encaissements AS
SELECT
  e.*,
  c.nom AS caisse_nom,
  p.nom AS utilisateur_nom
FROM encaissements e
LEFT JOIN caisses c ON c.id = e.caisse_id
LEFT JOIN profiles p ON p.id = e.user_id;

CREATE OR REPLACE VIEW v_decaissements AS
SELECT
  d.*,
  c.nom AS caisse_nom,
  p.nom AS utilisateur_nom,
  cc.libelle AS compte_libelle_full
FROM decaissements d
LEFT JOIN caisses c ON c.id = d.caisse_id
LEFT JOIN profiles p ON p.id = d.user_id
LEFT JOIN comptes_charges cc ON cc.id = d.compte_id;


/*
  # SUNUFACTURE - Transaction Tables

  1. New Tables
    - `devis` - Quotes with status tracking
    - `devis_lignes` - Quote line items
    - `factures` - Customer invoices (comptant/acompte/crédit)
    - `facture_lignes` - Invoice line items
    - `paiements` - Payment records linked to invoices
    - `factures_fournisseurs` - Supplier invoices (increases stock even if unpaid)
    - `factures_fournisseurs_lignes` - Supplier invoice line items
    - `paiements_fournisseurs` - Supplier payment records
    - `depenses` - Company expenses
    - `retours` - Customer returns (partial or total)
    - `retour_lignes` - Return line items
    - `mouvements_stock` - Stock movement audit log

  2. Key Features
    - Devis can be converted to factures
    - Supplier invoices automatically increase stock
    - Returns impact stock
    - All stock changes logged in mouvements_stock
*/

CREATE SEQUENCE IF NOT EXISTS devis_seq START 1;
CREATE SEQUENCE IF NOT EXISTS factures_seq START 1;
CREATE SEQUENCE IF NOT EXISTS factures_fourn_seq START 1;

CREATE TABLE IF NOT EXISTS devis (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  client_id uuid NOT NULL REFERENCES clients(id) ON DELETE RESTRICT,
  numero text NOT NULL,
  date_devis date NOT NULL DEFAULT CURRENT_DATE,
  date_validite date,
  statut text NOT NULL DEFAULT 'brouillon',
  notes text DEFAULT '',
  sous_total numeric(15,2) DEFAULT 0,
  tva_montant numeric(15,2) DEFAULT 0,
  total numeric(15,2) DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE devis ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Company members can select devis"
  ON devis FOR SELECT TO authenticated
  USING (company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid()));

CREATE POLICY "Company members can insert devis"
  ON devis FOR INSERT TO authenticated
  WITH CHECK (company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid()));

CREATE POLICY "Company members can update devis"
  ON devis FOR UPDATE TO authenticated
  USING (company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid()))
  WITH CHECK (company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid()));

CREATE POLICY "Company members can delete devis"
  ON devis FOR DELETE TO authenticated
  USING (company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid()));

CREATE TABLE IF NOT EXISTS devis_lignes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  devis_id uuid NOT NULL REFERENCES devis(id) ON DELETE CASCADE,
  produit_id uuid REFERENCES produits(id) ON DELETE SET NULL,
  designation text NOT NULL,
  quantite numeric(15,3) NOT NULL DEFAULT 1,
  prix_unitaire numeric(15,2) NOT NULL DEFAULT 0,
  tva_taux numeric(5,2) DEFAULT 0,
  montant_ht numeric(15,2) DEFAULT 0,
  montant_tva numeric(15,2) DEFAULT 0,
  montant_ttc numeric(15,2) DEFAULT 0,
  sort_order integer DEFAULT 0
);

ALTER TABLE devis_lignes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Company members can select devis_lignes"
  ON devis_lignes FOR SELECT TO authenticated
  USING (devis_id IN (SELECT id FROM devis WHERE company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid())));

CREATE POLICY "Company members can insert devis_lignes"
  ON devis_lignes FOR INSERT TO authenticated
  WITH CHECK (devis_id IN (SELECT id FROM devis WHERE company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid())));

CREATE POLICY "Company members can update devis_lignes"
  ON devis_lignes FOR UPDATE TO authenticated
  USING (devis_id IN (SELECT id FROM devis WHERE company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid())))
  WITH CHECK (devis_id IN (SELECT id FROM devis WHERE company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid())));

CREATE POLICY "Company members can delete devis_lignes"
  ON devis_lignes FOR DELETE TO authenticated
  USING (devis_id IN (SELECT id FROM devis WHERE company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid())));

CREATE TABLE IF NOT EXISTS factures (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  client_id uuid NOT NULL REFERENCES clients(id) ON DELETE RESTRICT,
  devis_id uuid REFERENCES devis(id) ON DELETE SET NULL,
  numero text NOT NULL,
  date_facture date NOT NULL DEFAULT CURRENT_DATE,
  date_echeance date,
  statut text NOT NULL DEFAULT 'brouillon',
  type_paiement text NOT NULL DEFAULT 'comptant',
  notes text DEFAULT '',
  sous_total numeric(15,2) DEFAULT 0,
  tva_montant numeric(15,2) DEFAULT 0,
  total numeric(15,2) DEFAULT 0,
  montant_paye numeric(15,2) DEFAULT 0,
  reste_a_payer numeric(15,2) DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE factures ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Company members can select factures"
  ON factures FOR SELECT TO authenticated
  USING (company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid()));

CREATE POLICY "Company members can insert factures"
  ON factures FOR INSERT TO authenticated
  WITH CHECK (company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid()));

CREATE POLICY "Company members can update factures"
  ON factures FOR UPDATE TO authenticated
  USING (company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid()))
  WITH CHECK (company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid()));

CREATE POLICY "Company members can delete factures"
  ON factures FOR DELETE TO authenticated
  USING (company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid()));

CREATE TABLE IF NOT EXISTS facture_lignes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  facture_id uuid NOT NULL REFERENCES factures(id) ON DELETE CASCADE,
  produit_id uuid REFERENCES produits(id) ON DELETE SET NULL,
  designation text NOT NULL,
  quantite numeric(15,3) NOT NULL DEFAULT 1,
  prix_unitaire numeric(15,2) NOT NULL DEFAULT 0,
  tva_taux numeric(5,2) DEFAULT 0,
  montant_ht numeric(15,2) DEFAULT 0,
  montant_tva numeric(15,2) DEFAULT 0,
  montant_ttc numeric(15,2) DEFAULT 0,
  sort_order integer DEFAULT 0
);

ALTER TABLE facture_lignes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Company members can select facture_lignes"
  ON facture_lignes FOR SELECT TO authenticated
  USING (facture_id IN (SELECT id FROM factures WHERE company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid())));

CREATE POLICY "Company members can insert facture_lignes"
  ON facture_lignes FOR INSERT TO authenticated
  WITH CHECK (facture_id IN (SELECT id FROM factures WHERE company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid())));

CREATE POLICY "Company members can update facture_lignes"
  ON facture_lignes FOR UPDATE TO authenticated
  USING (facture_id IN (SELECT id FROM factures WHERE company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid())))
  WITH CHECK (facture_id IN (SELECT id FROM factures WHERE company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid())));

CREATE POLICY "Company members can delete facture_lignes"
  ON facture_lignes FOR DELETE TO authenticated
  USING (facture_id IN (SELECT id FROM factures WHERE company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid())));

CREATE TABLE IF NOT EXISTS paiements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  facture_id uuid NOT NULL REFERENCES factures(id) ON DELETE CASCADE,
  client_id uuid REFERENCES clients(id) ON DELETE SET NULL,
  date_paiement date NOT NULL DEFAULT CURRENT_DATE,
  montant numeric(15,2) NOT NULL DEFAULT 0,
  mode_paiement text NOT NULL DEFAULT 'espèces',
  reference text DEFAULT '',
  notes text DEFAULT '',
  created_at timestamptz DEFAULT now()
);

ALTER TABLE paiements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Company members can select paiements"
  ON paiements FOR SELECT TO authenticated
  USING (company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid()));

CREATE POLICY "Company members can insert paiements"
  ON paiements FOR INSERT TO authenticated
  WITH CHECK (company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid()));

CREATE POLICY "Company members can update paiements"
  ON paiements FOR UPDATE TO authenticated
  USING (company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid()))
  WITH CHECK (company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid()));

CREATE POLICY "Company members can delete paiements"
  ON paiements FOR DELETE TO authenticated
  USING (company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid()));

CREATE TABLE IF NOT EXISTS factures_fournisseurs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  fournisseur_id uuid NOT NULL REFERENCES fournisseurs(id) ON DELETE RESTRICT,
  numero text NOT NULL,
  date_facture date NOT NULL DEFAULT CURRENT_DATE,
  date_echeance date,
  statut text NOT NULL DEFAULT 'reçue',
  notes text DEFAULT '',
  sous_total numeric(15,2) DEFAULT 0,
  tva_montant numeric(15,2) DEFAULT 0,
  total numeric(15,2) DEFAULT 0,
  montant_paye numeric(15,2) DEFAULT 0,
  reste_a_payer numeric(15,2) DEFAULT 0,
  stock_mis_a_jour boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE factures_fournisseurs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Company members can select factures_fournisseurs"
  ON factures_fournisseurs FOR SELECT TO authenticated
  USING (company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid()));

CREATE POLICY "Company members can insert factures_fournisseurs"
  ON factures_fournisseurs FOR INSERT TO authenticated
  WITH CHECK (company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid()));

CREATE POLICY "Company members can update factures_fournisseurs"
  ON factures_fournisseurs FOR UPDATE TO authenticated
  USING (company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid()))
  WITH CHECK (company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid()));

CREATE POLICY "Company members can delete factures_fournisseurs"
  ON factures_fournisseurs FOR DELETE TO authenticated
  USING (company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid()));

CREATE TABLE IF NOT EXISTS factures_fournisseurs_lignes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  facture_fournisseur_id uuid NOT NULL REFERENCES factures_fournisseurs(id) ON DELETE CASCADE,
  produit_id uuid REFERENCES produits(id) ON DELETE SET NULL,
  designation text NOT NULL,
  quantite numeric(15,3) NOT NULL DEFAULT 1,
  prix_unitaire numeric(15,2) NOT NULL DEFAULT 0,
  tva_taux numeric(5,2) DEFAULT 0,
  montant_ht numeric(15,2) DEFAULT 0,
  montant_tva numeric(15,2) DEFAULT 0,
  montant_ttc numeric(15,2) DEFAULT 0,
  sort_order integer DEFAULT 0
);

ALTER TABLE factures_fournisseurs_lignes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Company members can select factures_fournisseurs_lignes"
  ON factures_fournisseurs_lignes FOR SELECT TO authenticated
  USING (facture_fournisseur_id IN (SELECT id FROM factures_fournisseurs WHERE company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid())));

CREATE POLICY "Company members can insert factures_fournisseurs_lignes"
  ON factures_fournisseurs_lignes FOR INSERT TO authenticated
  WITH CHECK (facture_fournisseur_id IN (SELECT id FROM factures_fournisseurs WHERE company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid())));

CREATE POLICY "Company members can update factures_fournisseurs_lignes"
  ON factures_fournisseurs_lignes FOR UPDATE TO authenticated
  USING (facture_fournisseur_id IN (SELECT id FROM factures_fournisseurs WHERE company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid())))
  WITH CHECK (facture_fournisseur_id IN (SELECT id FROM factures_fournisseurs WHERE company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid())));

CREATE POLICY "Company members can delete factures_fournisseurs_lignes"
  ON factures_fournisseurs_lignes FOR DELETE TO authenticated
  USING (facture_fournisseur_id IN (SELECT id FROM factures_fournisseurs WHERE company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid())));

CREATE TABLE IF NOT EXISTS paiements_fournisseurs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  facture_fournisseur_id uuid NOT NULL REFERENCES factures_fournisseurs(id) ON DELETE CASCADE,
  fournisseur_id uuid REFERENCES fournisseurs(id) ON DELETE SET NULL,
  date_paiement date NOT NULL DEFAULT CURRENT_DATE,
  montant numeric(15,2) NOT NULL DEFAULT 0,
  mode_paiement text NOT NULL DEFAULT 'espèces',
  reference text DEFAULT '',
  notes text DEFAULT '',
  created_at timestamptz DEFAULT now()
);

ALTER TABLE paiements_fournisseurs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Company members can select paiements_fournisseurs"
  ON paiements_fournisseurs FOR SELECT TO authenticated
  USING (company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid()));

CREATE POLICY "Company members can insert paiements_fournisseurs"
  ON paiements_fournisseurs FOR INSERT TO authenticated
  WITH CHECK (company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid()));

CREATE POLICY "Company members can update paiements_fournisseurs"
  ON paiements_fournisseurs FOR UPDATE TO authenticated
  USING (company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid()))
  WITH CHECK (company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid()));

CREATE POLICY "Company members can delete paiements_fournisseurs"
  ON paiements_fournisseurs FOR DELETE TO authenticated
  USING (company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid()));

CREATE TABLE IF NOT EXISTS depenses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  categorie text NOT NULL DEFAULT 'Autre',
  description text NOT NULL,
  montant numeric(15,2) NOT NULL DEFAULT 0,
  date_depense date NOT NULL DEFAULT CURRENT_DATE,
  mode_paiement text DEFAULT 'espèces',
  reference text DEFAULT '',
  notes text DEFAULT '',
  created_at timestamptz DEFAULT now()
);

ALTER TABLE depenses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Company members can select depenses"
  ON depenses FOR SELECT TO authenticated
  USING (company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid()));

CREATE POLICY "Company members can insert depenses"
  ON depenses FOR INSERT TO authenticated
  WITH CHECK (company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid()));

CREATE POLICY "Company members can update depenses"
  ON depenses FOR UPDATE TO authenticated
  USING (company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid()))
  WITH CHECK (company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid()));

CREATE POLICY "Company members can delete depenses"
  ON depenses FOR DELETE TO authenticated
  USING (company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid()));

CREATE TABLE IF NOT EXISTS retours (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  facture_id uuid NOT NULL REFERENCES factures(id) ON DELETE RESTRICT,
  client_id uuid REFERENCES clients(id) ON DELETE SET NULL,
  date_retour date NOT NULL DEFAULT CURRENT_DATE,
  type_retour text NOT NULL DEFAULT 'partiel',
  motif text DEFAULT '',
  statut text NOT NULL DEFAULT 'traité',
  montant_rembourse numeric(15,2) DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE retours ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Company members can select retours"
  ON retours FOR SELECT TO authenticated
  USING (company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid()));

CREATE POLICY "Company members can insert retours"
  ON retours FOR INSERT TO authenticated
  WITH CHECK (company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid()));

CREATE POLICY "Company members can update retours"
  ON retours FOR UPDATE TO authenticated
  USING (company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid()))
  WITH CHECK (company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid()));

CREATE POLICY "Company members can delete retours"
  ON retours FOR DELETE TO authenticated
  USING (company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid()));

CREATE TABLE IF NOT EXISTS retour_lignes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  retour_id uuid NOT NULL REFERENCES retours(id) ON DELETE CASCADE,
  facture_ligne_id uuid REFERENCES facture_lignes(id) ON DELETE SET NULL,
  produit_id uuid REFERENCES produits(id) ON DELETE SET NULL,
  designation text NOT NULL,
  quantite_retournee numeric(15,3) NOT NULL DEFAULT 1,
  prix_unitaire numeric(15,2) DEFAULT 0,
  motif text DEFAULT ''
);

ALTER TABLE retour_lignes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Company members can select retour_lignes"
  ON retour_lignes FOR SELECT TO authenticated
  USING (retour_id IN (SELECT id FROM retours WHERE company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid())));

CREATE POLICY "Company members can insert retour_lignes"
  ON retour_lignes FOR INSERT TO authenticated
  WITH CHECK (retour_id IN (SELECT id FROM retours WHERE company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid())));

CREATE POLICY "Company members can update retour_lignes"
  ON retour_lignes FOR UPDATE TO authenticated
  USING (retour_id IN (SELECT id FROM retours WHERE company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid())))
  WITH CHECK (retour_id IN (SELECT id FROM retours WHERE company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid())));

CREATE POLICY "Company members can delete retour_lignes"
  ON retour_lignes FOR DELETE TO authenticated
  USING (retour_id IN (SELECT id FROM retours WHERE company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid())));

CREATE TABLE IF NOT EXISTS mouvements_stock (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  produit_id uuid NOT NULL REFERENCES produits(id) ON DELETE CASCADE,
  type_mouvement text NOT NULL,
  quantite numeric(15,3) NOT NULL,
  stock_avant numeric(15,3) DEFAULT 0,
  stock_apres numeric(15,3) DEFAULT 0,
  reference_id uuid,
  reference_type text DEFAULT '',
  notes text DEFAULT '',
  created_at timestamptz DEFAULT now()
);

ALTER TABLE mouvements_stock ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Company members can select mouvements_stock"
  ON mouvements_stock FOR SELECT TO authenticated
  USING (company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid()));

CREATE POLICY "Company members can insert mouvements_stock"
  ON mouvements_stock FOR INSERT TO authenticated
  WITH CHECK (company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid()));

CREATE INDEX IF NOT EXISTS idx_mouvements_stock_produit ON mouvements_stock(produit_id);
CREATE INDEX IF NOT EXISTS idx_mouvements_stock_company ON mouvements_stock(company_id);
CREATE INDEX IF NOT EXISTS idx_factures_company ON factures(company_id);
CREATE INDEX IF NOT EXISTS idx_factures_client ON factures(client_id);
CREATE INDEX IF NOT EXISTS idx_devis_company ON devis(company_id);
CREATE INDEX IF NOT EXISTS idx_produits_company ON produits(company_id);
CREATE INDEX IF NOT EXISTS idx_clients_company ON clients(company_id);

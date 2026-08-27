/*
  # Ajout de la table produit_unites

  ## Objectif
  Permettre à chaque produit d'avoir plusieurs unités de vente et conditionnements
  au lieu d'un seul conditionnement figé.

  ## Nouvelles tables
  - `produit_unites` : Modes de vente supplémentaires pour un produit
    - `id` : Identifiant unique
    - `produit_id` : Référence au produit parent
    - `company_id` : Référence à la compagnie (pour RLS)
    - `nom` : Nom de l'unité ou conditionnement (ex: Carton, Pack, Palette)
    - `type` : 'unite' ou 'conditionnement'
    - `quantite` : Nombre d'unités de base contenues (pour les conditionnements)
    - `prix` : Prix spécifique pour ce mode de vente (null = calculé automatiquement)
    - `sort_order` : Ordre d'affichage
    - `created_at` : Date de création

  ## Sécurité
  - RLS activé
  - Accès restreint aux membres de la compagnie
*/

CREATE TABLE IF NOT EXISTS produit_unites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  produit_id uuid NOT NULL REFERENCES produits(id) ON DELETE CASCADE,
  company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  nom text NOT NULL,
  type text NOT NULL DEFAULT 'conditionnement' CHECK (type IN ('unite', 'conditionnement')),
  quantite numeric(10,3) NOT NULL DEFAULT 1,
  prix numeric(15,2),
  sort_order integer DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE produit_unites ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Company members can select produit_unites"
  ON produit_unites FOR SELECT
  TO authenticated
  USING (company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid()));

CREATE POLICY "Company members can insert produit_unites"
  ON produit_unites FOR INSERT
  TO authenticated
  WITH CHECK (company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid()));

CREATE POLICY "Company members can update produit_unites"
  ON produit_unites FOR UPDATE
  TO authenticated
  USING (company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid()))
  WITH CHECK (company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid()));

CREATE POLICY "Company members can delete produit_unites"
  ON produit_unites FOR DELETE
  TO authenticated
  USING (company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid()));

CREATE INDEX IF NOT EXISTS idx_produit_unites_produit_id ON produit_unites(produit_id);
CREATE INDEX IF NOT EXISTS idx_produit_unites_company_id ON produit_unites(company_id);

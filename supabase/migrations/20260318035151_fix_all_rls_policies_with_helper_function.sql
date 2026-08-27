/*
  # Fix all RLS policies to use security definer helper functions

  The profiles table had recursive RLS (policy querying profiles itself).
  Fix: 
  - profiles SELECT only uses auth.uid() = id (no subquery on profiles)
  - All other tables use get_my_company_id() helper which is SECURITY DEFINER
    (bypasses RLS when called, breaking the recursion)
  - get_my_role() helper added for role-based checks
*/

DROP POLICY IF EXISTS "Company members can read profiles" ON profiles;
DROP POLICY IF EXISTS "Users can read own profile" ON profiles;

CREATE POLICY "Users can read own profile"
  ON profiles
  FOR SELECT
  TO authenticated
  USING (auth.uid() = id);

CREATE OR REPLACE FUNCTION get_my_company_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT company_id FROM profiles WHERE id = auth.uid() LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION get_my_role()
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role FROM profiles WHERE id = auth.uid() LIMIT 1;
$$;

DROP POLICY IF EXISTS "Company admins can manage company" ON companies;
DROP POLICY IF EXISTS "Company admins can update company" ON companies;

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'companies' AND policyname = 'Company members can view company') THEN
    DROP POLICY "Company members can view company" ON companies;
  END IF;
END $$;

CREATE POLICY "Company members can view company"
  ON companies
  FOR SELECT
  TO authenticated
  USING (id = get_my_company_id());

CREATE POLICY "Company admins can manage company"
  ON companies
  FOR UPDATE
  TO authenticated
  USING (id = get_my_company_id() AND get_my_role() = 'admin')
  WITH CHECK (id = get_my_company_id() AND get_my_role() = 'admin');

DROP POLICY IF EXISTS "Company members can select clients" ON clients;
DROP POLICY IF EXISTS "Company members can update clients" ON clients;
DROP POLICY IF EXISTS "Company members can delete clients" ON clients;
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'clients' AND policyname = 'Company members can insert clients') THEN
    DROP POLICY "Company members can insert clients" ON clients;
  END IF;
END $$;

CREATE POLICY "Company members can select clients" ON clients FOR SELECT TO authenticated USING (company_id = get_my_company_id());
CREATE POLICY "Company members can insert clients" ON clients FOR INSERT TO authenticated WITH CHECK (company_id = get_my_company_id());
CREATE POLICY "Company members can update clients" ON clients FOR UPDATE TO authenticated USING (company_id = get_my_company_id()) WITH CHECK (company_id = get_my_company_id());
CREATE POLICY "Company members can delete clients" ON clients FOR DELETE TO authenticated USING (company_id = get_my_company_id());

DROP POLICY IF EXISTS "Company members can select fournisseurs" ON fournisseurs;
DROP POLICY IF EXISTS "Company members can update fournisseurs" ON fournisseurs;
DROP POLICY IF EXISTS "Company members can delete fournisseurs" ON fournisseurs;
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'fournisseurs' AND policyname = 'Company members can insert fournisseurs') THEN
    DROP POLICY "Company members can insert fournisseurs" ON fournisseurs;
  END IF;
END $$;

CREATE POLICY "Company members can select fournisseurs" ON fournisseurs FOR SELECT TO authenticated USING (company_id = get_my_company_id());
CREATE POLICY "Company members can insert fournisseurs" ON fournisseurs FOR INSERT TO authenticated WITH CHECK (company_id = get_my_company_id());
CREATE POLICY "Company members can update fournisseurs" ON fournisseurs FOR UPDATE TO authenticated USING (company_id = get_my_company_id()) WITH CHECK (company_id = get_my_company_id());
CREATE POLICY "Company members can delete fournisseurs" ON fournisseurs FOR DELETE TO authenticated USING (company_id = get_my_company_id());

DROP POLICY IF EXISTS "Company members can select categories" ON categories;
DROP POLICY IF EXISTS "Company members can update categories" ON categories;
DROP POLICY IF EXISTS "Company members can delete categories" ON categories;
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'categories' AND policyname = 'Company members can insert categories') THEN
    DROP POLICY "Company members can insert categories" ON categories;
  END IF;
END $$;

CREATE POLICY "Company members can select categories" ON categories FOR SELECT TO authenticated USING (company_id = get_my_company_id());
CREATE POLICY "Company members can insert categories" ON categories FOR INSERT TO authenticated WITH CHECK (company_id = get_my_company_id());
CREATE POLICY "Company members can update categories" ON categories FOR UPDATE TO authenticated USING (company_id = get_my_company_id()) WITH CHECK (company_id = get_my_company_id());
CREATE POLICY "Company members can delete categories" ON categories FOR DELETE TO authenticated USING (company_id = get_my_company_id());

DROP POLICY IF EXISTS "Company members can select produits" ON produits;
DROP POLICY IF EXISTS "Company members can update produits" ON produits;
DROP POLICY IF EXISTS "Company members can delete produits" ON produits;
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'produits' AND policyname = 'Company members can insert produits') THEN
    DROP POLICY "Company members can insert produits" ON produits;
  END IF;
END $$;

CREATE POLICY "Company members can select produits" ON produits FOR SELECT TO authenticated USING (company_id = get_my_company_id());
CREATE POLICY "Company members can insert produits" ON produits FOR INSERT TO authenticated WITH CHECK (company_id = get_my_company_id());
CREATE POLICY "Company members can update produits" ON produits FOR UPDATE TO authenticated USING (company_id = get_my_company_id()) WITH CHECK (company_id = get_my_company_id());
CREATE POLICY "Company members can delete produits" ON produits FOR DELETE TO authenticated USING (company_id = get_my_company_id());

DROP POLICY IF EXISTS "Company members can select devis" ON devis;
DROP POLICY IF EXISTS "Company members can update devis" ON devis;
DROP POLICY IF EXISTS "Company members can delete devis" ON devis;
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'devis' AND policyname = 'Company members can insert devis') THEN
    DROP POLICY "Company members can insert devis" ON devis;
  END IF;
END $$;

CREATE POLICY "Company members can select devis" ON devis FOR SELECT TO authenticated USING (company_id = get_my_company_id());
CREATE POLICY "Company members can insert devis" ON devis FOR INSERT TO authenticated WITH CHECK (company_id = get_my_company_id());
CREATE POLICY "Company members can update devis" ON devis FOR UPDATE TO authenticated USING (company_id = get_my_company_id()) WITH CHECK (company_id = get_my_company_id());
CREATE POLICY "Company members can delete devis" ON devis FOR DELETE TO authenticated USING (company_id = get_my_company_id());

DROP POLICY IF EXISTS "Company members can select devis_lignes" ON devis_lignes;
DROP POLICY IF EXISTS "Company members can update devis_lignes" ON devis_lignes;
DROP POLICY IF EXISTS "Company members can delete devis_lignes" ON devis_lignes;
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'devis_lignes' AND policyname = 'Company members can insert devis_lignes') THEN
    DROP POLICY "Company members can insert devis_lignes" ON devis_lignes;
  END IF;
END $$;

CREATE POLICY "Company members can select devis_lignes" ON devis_lignes FOR SELECT TO authenticated
  USING (devis_id IN (SELECT id FROM devis WHERE company_id = get_my_company_id()));
CREATE POLICY "Company members can insert devis_lignes" ON devis_lignes FOR INSERT TO authenticated
  WITH CHECK (devis_id IN (SELECT id FROM devis WHERE company_id = get_my_company_id()));
CREATE POLICY "Company members can update devis_lignes" ON devis_lignes FOR UPDATE TO authenticated
  USING (devis_id IN (SELECT id FROM devis WHERE company_id = get_my_company_id()));
CREATE POLICY "Company members can delete devis_lignes" ON devis_lignes FOR DELETE TO authenticated
  USING (devis_id IN (SELECT id FROM devis WHERE company_id = get_my_company_id()));

DROP POLICY IF EXISTS "Company members can select factures" ON factures;
DROP POLICY IF EXISTS "Company members can update factures" ON factures;
DROP POLICY IF EXISTS "Company members can delete factures" ON factures;
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'factures' AND policyname = 'Company members can insert factures') THEN
    DROP POLICY "Company members can insert factures" ON factures;
  END IF;
END $$;

CREATE POLICY "Company members can select factures" ON factures FOR SELECT TO authenticated USING (company_id = get_my_company_id());
CREATE POLICY "Company members can insert factures" ON factures FOR INSERT TO authenticated WITH CHECK (company_id = get_my_company_id());
CREATE POLICY "Company members can update factures" ON factures FOR UPDATE TO authenticated USING (company_id = get_my_company_id()) WITH CHECK (company_id = get_my_company_id());
CREATE POLICY "Company members can delete factures" ON factures FOR DELETE TO authenticated USING (company_id = get_my_company_id());

DROP POLICY IF EXISTS "Company members can select facture_lignes" ON facture_lignes;
DROP POLICY IF EXISTS "Company members can update facture_lignes" ON facture_lignes;
DROP POLICY IF EXISTS "Company members can delete facture_lignes" ON facture_lignes;
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'facture_lignes' AND policyname = 'Company members can insert facture_lignes') THEN
    DROP POLICY "Company members can insert facture_lignes" ON facture_lignes;
  END IF;
END $$;

CREATE POLICY "Company members can select facture_lignes" ON facture_lignes FOR SELECT TO authenticated
  USING (facture_id IN (SELECT id FROM factures WHERE company_id = get_my_company_id()));
CREATE POLICY "Company members can insert facture_lignes" ON facture_lignes FOR INSERT TO authenticated
  WITH CHECK (facture_id IN (SELECT id FROM factures WHERE company_id = get_my_company_id()));
CREATE POLICY "Company members can update facture_lignes" ON facture_lignes FOR UPDATE TO authenticated
  USING (facture_id IN (SELECT id FROM factures WHERE company_id = get_my_company_id()));
CREATE POLICY "Company members can delete facture_lignes" ON facture_lignes FOR DELETE TO authenticated
  USING (facture_id IN (SELECT id FROM factures WHERE company_id = get_my_company_id()));

DROP POLICY IF EXISTS "Company members can select paiements" ON paiements;
DROP POLICY IF EXISTS "Company members can update paiements" ON paiements;
DROP POLICY IF EXISTS "Company members can delete paiements" ON paiements;
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'paiements' AND policyname = 'Company members can insert paiements') THEN
    DROP POLICY "Company members can insert paiements" ON paiements;
  END IF;
END $$;

CREATE POLICY "Company members can select paiements" ON paiements FOR SELECT TO authenticated USING (company_id = get_my_company_id());
CREATE POLICY "Company members can insert paiements" ON paiements FOR INSERT TO authenticated WITH CHECK (company_id = get_my_company_id());
CREATE POLICY "Company members can update paiements" ON paiements FOR UPDATE TO authenticated USING (company_id = get_my_company_id()) WITH CHECK (company_id = get_my_company_id());
CREATE POLICY "Company members can delete paiements" ON paiements FOR DELETE TO authenticated USING (company_id = get_my_company_id());

DROP POLICY IF EXISTS "Company members can select factures_fournisseurs" ON factures_fournisseurs;
DROP POLICY IF EXISTS "Company members can update factures_fournisseurs" ON factures_fournisseurs;
DROP POLICY IF EXISTS "Company members can delete factures_fournisseurs" ON factures_fournisseurs;
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'factures_fournisseurs' AND policyname = 'Company members can insert factures_fournisseurs') THEN
    DROP POLICY "Company members can insert factures_fournisseurs" ON factures_fournisseurs;
  END IF;
END $$;

CREATE POLICY "Company members can select factures_fournisseurs" ON factures_fournisseurs FOR SELECT TO authenticated USING (company_id = get_my_company_id());
CREATE POLICY "Company members can insert factures_fournisseurs" ON factures_fournisseurs FOR INSERT TO authenticated WITH CHECK (company_id = get_my_company_id());
CREATE POLICY "Company members can update factures_fournisseurs" ON factures_fournisseurs FOR UPDATE TO authenticated USING (company_id = get_my_company_id()) WITH CHECK (company_id = get_my_company_id());
CREATE POLICY "Company members can delete factures_fournisseurs" ON factures_fournisseurs FOR DELETE TO authenticated USING (company_id = get_my_company_id());

DROP POLICY IF EXISTS "Company members can select factures_fournisseurs_lignes" ON factures_fournisseurs_lignes;
DROP POLICY IF EXISTS "Company members can update factures_fournisseurs_lignes" ON factures_fournisseurs_lignes;
DROP POLICY IF EXISTS "Company members can delete factures_fournisseurs_lignes" ON factures_fournisseurs_lignes;
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'factures_fournisseurs_lignes' AND policyname = 'Company members can insert factures_fournisseurs_lignes') THEN
    DROP POLICY "Company members can insert factures_fournisseurs_lignes" ON factures_fournisseurs_lignes;
  END IF;
END $$;

CREATE POLICY "Company members can select factures_fournisseurs_lignes" ON factures_fournisseurs_lignes FOR SELECT TO authenticated
  USING (facture_fournisseur_id IN (SELECT id FROM factures_fournisseurs WHERE company_id = get_my_company_id()));
CREATE POLICY "Company members can insert factures_fournisseurs_lignes" ON factures_fournisseurs_lignes FOR INSERT TO authenticated
  WITH CHECK (facture_fournisseur_id IN (SELECT id FROM factures_fournisseurs WHERE company_id = get_my_company_id()));
CREATE POLICY "Company members can update factures_fournisseurs_lignes" ON factures_fournisseurs_lignes FOR UPDATE TO authenticated
  USING (facture_fournisseur_id IN (SELECT id FROM factures_fournisseurs WHERE company_id = get_my_company_id()));
CREATE POLICY "Company members can delete factures_fournisseurs_lignes" ON factures_fournisseurs_lignes FOR DELETE TO authenticated
  USING (facture_fournisseur_id IN (SELECT id FROM factures_fournisseurs WHERE company_id = get_my_company_id()));

DROP POLICY IF EXISTS "Company members can select paiements_fournisseurs" ON paiements_fournisseurs;
DROP POLICY IF EXISTS "Company members can update paiements_fournisseurs" ON paiements_fournisseurs;
DROP POLICY IF EXISTS "Company members can delete paiements_fournisseurs" ON paiements_fournisseurs;
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'paiements_fournisseurs' AND policyname = 'Company members can insert paiements_fournisseurs') THEN
    DROP POLICY "Company members can insert paiements_fournisseurs" ON paiements_fournisseurs;
  END IF;
END $$;

CREATE POLICY "Company members can select paiements_fournisseurs" ON paiements_fournisseurs FOR SELECT TO authenticated USING (company_id = get_my_company_id());
CREATE POLICY "Company members can insert paiements_fournisseurs" ON paiements_fournisseurs FOR INSERT TO authenticated WITH CHECK (company_id = get_my_company_id());
CREATE POLICY "Company members can update paiements_fournisseurs" ON paiements_fournisseurs FOR UPDATE TO authenticated USING (company_id = get_my_company_id()) WITH CHECK (company_id = get_my_company_id());
CREATE POLICY "Company members can delete paiements_fournisseurs" ON paiements_fournisseurs FOR DELETE TO authenticated USING (company_id = get_my_company_id());

DROP POLICY IF EXISTS "Company members can select depenses" ON depenses;
DROP POLICY IF EXISTS "Company members can update depenses" ON depenses;
DROP POLICY IF EXISTS "Company members can delete depenses" ON depenses;
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'depenses' AND policyname = 'Company members can insert depenses') THEN
    DROP POLICY "Company members can insert depenses" ON depenses;
  END IF;
END $$;

CREATE POLICY "Company members can select depenses" ON depenses FOR SELECT TO authenticated USING (company_id = get_my_company_id());
CREATE POLICY "Company members can insert depenses" ON depenses FOR INSERT TO authenticated WITH CHECK (company_id = get_my_company_id());
CREATE POLICY "Company members can update depenses" ON depenses FOR UPDATE TO authenticated USING (company_id = get_my_company_id()) WITH CHECK (company_id = get_my_company_id());
CREATE POLICY "Company members can delete depenses" ON depenses FOR DELETE TO authenticated USING (company_id = get_my_company_id());

DROP POLICY IF EXISTS "Company members can select retours" ON retours;
DROP POLICY IF EXISTS "Company members can update retours" ON retours;
DROP POLICY IF EXISTS "Company members can delete retours" ON retours;
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'retours' AND policyname = 'Company members can insert retours') THEN
    DROP POLICY "Company members can insert retours" ON retours;
  END IF;
END $$;

CREATE POLICY "Company members can select retours" ON retours FOR SELECT TO authenticated USING (company_id = get_my_company_id());
CREATE POLICY "Company members can insert retours" ON retours FOR INSERT TO authenticated WITH CHECK (company_id = get_my_company_id());
CREATE POLICY "Company members can update retours" ON retours FOR UPDATE TO authenticated USING (company_id = get_my_company_id()) WITH CHECK (company_id = get_my_company_id());
CREATE POLICY "Company members can delete retours" ON retours FOR DELETE TO authenticated USING (company_id = get_my_company_id());

DROP POLICY IF EXISTS "Company members can select retour_lignes" ON retour_lignes;
DROP POLICY IF EXISTS "Company members can update retour_lignes" ON retour_lignes;
DROP POLICY IF EXISTS "Company members can delete retour_lignes" ON retour_lignes;
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'retour_lignes' AND policyname = 'Company members can insert retour_lignes') THEN
    DROP POLICY "Company members can insert retour_lignes" ON retour_lignes;
  END IF;
END $$;

CREATE POLICY "Company members can select retour_lignes" ON retour_lignes FOR SELECT TO authenticated
  USING (retour_id IN (SELECT id FROM retours WHERE company_id = get_my_company_id()));
CREATE POLICY "Company members can insert retour_lignes" ON retour_lignes FOR INSERT TO authenticated
  WITH CHECK (retour_id IN (SELECT id FROM retours WHERE company_id = get_my_company_id()));
CREATE POLICY "Company members can update retour_lignes" ON retour_lignes FOR UPDATE TO authenticated
  USING (retour_id IN (SELECT id FROM retours WHERE company_id = get_my_company_id()));
CREATE POLICY "Company members can delete retour_lignes" ON retour_lignes FOR DELETE TO authenticated
  USING (retour_id IN (SELECT id FROM retours WHERE company_id = get_my_company_id()));

DROP POLICY IF EXISTS "Company members can select mouvements_stock" ON mouvements_stock;
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'mouvements_stock' AND policyname = 'Company members can insert mouvements_stock') THEN
    DROP POLICY "Company members can insert mouvements_stock" ON mouvements_stock;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'mouvements_stock' AND policyname = 'Company members can update mouvements_stock') THEN
    DROP POLICY "Company members can update mouvements_stock" ON mouvements_stock;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'mouvements_stock' AND policyname = 'Company members can delete mouvements_stock') THEN
    DROP POLICY "Company members can delete mouvements_stock" ON mouvements_stock;
  END IF;
END $$;

CREATE POLICY "Company members can select mouvements_stock" ON mouvements_stock FOR SELECT TO authenticated USING (company_id = get_my_company_id());
CREATE POLICY "Company members can insert mouvements_stock" ON mouvements_stock FOR INSERT TO authenticated WITH CHECK (company_id = get_my_company_id());
CREATE POLICY "Company members can update mouvements_stock" ON mouvements_stock FOR UPDATE TO authenticated USING (company_id = get_my_company_id()) WITH CHECK (company_id = get_my_company_id());

DROP POLICY IF EXISTS "Company members can select roles" ON roles;
DROP POLICY IF EXISTS "Company admins can update roles" ON roles;
DROP POLICY IF EXISTS "Company admins can delete roles" ON roles;
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'roles' AND policyname = 'Company admins can insert roles') THEN
    DROP POLICY "Company admins can insert roles" ON roles;
  END IF;
END $$;

CREATE POLICY "Company members can select roles" ON roles FOR SELECT TO authenticated USING (company_id = get_my_company_id());
CREATE POLICY "Company admins can insert roles" ON roles FOR INSERT TO authenticated WITH CHECK (company_id = get_my_company_id() AND get_my_role() = 'admin');
CREATE POLICY "Company admins can update roles" ON roles FOR UPDATE TO authenticated USING (company_id = get_my_company_id() AND get_my_role() = 'admin') WITH CHECK (company_id = get_my_company_id() AND get_my_role() = 'admin');
CREATE POLICY "Company admins can delete roles" ON roles FOR DELETE TO authenticated USING (company_id = get_my_company_id() AND get_my_role() = 'admin');

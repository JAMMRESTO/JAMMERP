/*
  # Open all tables to anon role for PIN-based auth

  1. Changes
    - Since PIN auth doesn't use Supabase JWT tokens, all data access
      happens through the anon key
    - Add anon policies to: caisses, comptes_charges, encaissements, decaissements, societe

  2. Security
    - Application-level security via PIN authentication
    - Tables are protected by the application layer
*/

-- caisses
CREATE POLICY "Anon can read caisses"
  ON caisses FOR SELECT TO anon USING (true);
CREATE POLICY "Anon can insert caisses"
  ON caisses FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "Anon can update caisses"
  ON caisses FOR UPDATE TO anon USING (true) WITH CHECK (true);
CREATE POLICY "Anon can delete caisses"
  ON caisses FOR DELETE TO anon USING (true);

-- comptes_charges
CREATE POLICY "Anon can read comptes_charges"
  ON comptes_charges FOR SELECT TO anon USING (true);
CREATE POLICY "Anon can insert comptes_charges"
  ON comptes_charges FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "Anon can update comptes_charges"
  ON comptes_charges FOR UPDATE TO anon USING (true) WITH CHECK (true);
CREATE POLICY "Anon can delete comptes_charges"
  ON comptes_charges FOR DELETE TO anon USING (true);

-- encaissements
CREATE POLICY "Anon can read encaissements"
  ON encaissements FOR SELECT TO anon USING (true);
CREATE POLICY "Anon can insert encaissements"
  ON encaissements FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "Anon can update encaissements"
  ON encaissements FOR UPDATE TO anon USING (true) WITH CHECK (true);

-- decaissements
CREATE POLICY "Anon can read decaissements"
  ON decaissements FOR SELECT TO anon USING (true);
CREATE POLICY "Anon can insert decaissements"
  ON decaissements FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "Anon can update decaissements"
  ON decaissements FOR UPDATE TO anon USING (true) WITH CHECK (true);

-- societe
CREATE POLICY "Anon can read societe"
  ON societe FOR SELECT TO anon USING (true);
CREATE POLICY "Anon can insert societe"
  ON societe FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "Anon can update societe"
  ON societe FOR UPDATE TO anon USING (true) WITH CHECK (true);

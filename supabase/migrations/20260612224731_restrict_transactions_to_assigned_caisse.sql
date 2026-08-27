/*
  Restrict encaissements and decaissements visibility by caisse.
  - Admins can see all transactions
  - Caissiers can only see transactions from their assigned caisse
*/

-- ═══ ENCAISSEMENTS ═══

DROP POLICY IF EXISTS "App session can read encaissements" ON public.encaissements;
CREATE POLICY "App session can read encaissements" ON public.encaissements FOR SELECT
  TO anon USING (
    extensions.is_app_authenticated() AND (
      EXISTS (SELECT 1 FROM profiles WHERE profiles.id = extensions.get_current_profile_id() AND profiles.role = 'admin')
      OR
      EXISTS (SELECT 1 FROM profiles WHERE profiles.id = extensions.get_current_profile_id() AND profiles.caisse_id = encaissements.caisse_id)
    )
  );

DROP POLICY IF EXISTS "App session can insert encaissements" ON public.encaissements;
CREATE POLICY "App session can insert encaissements" ON public.encaissements FOR INSERT
  TO anon WITH CHECK (
    extensions.is_app_authenticated() AND (
      EXISTS (SELECT 1 FROM profiles WHERE profiles.id = extensions.get_current_profile_id() AND profiles.role = 'admin')
      OR
      EXISTS (SELECT 1 FROM profiles WHERE profiles.id = extensions.get_current_profile_id() AND profiles.caisse_id = encaissements.caisse_id)
    )
  );

DROP POLICY IF EXISTS "App session can update encaissements" ON public.encaissements;
CREATE POLICY "App session can update encaissements" ON public.encaissements FOR UPDATE
  TO anon 
  USING (
    extensions.is_app_authenticated() AND (
      EXISTS (SELECT 1 FROM profiles WHERE profiles.id = extensions.get_current_profile_id() AND profiles.role = 'admin')
      OR
      EXISTS (SELECT 1 FROM profiles WHERE profiles.id = extensions.get_current_profile_id() AND profiles.caisse_id = encaissements.caisse_id)
    )
  )
  WITH CHECK (
    extensions.is_app_authenticated() AND (
      EXISTS (SELECT 1 FROM profiles WHERE profiles.id = extensions.get_current_profile_id() AND profiles.role = 'admin')
      OR
      EXISTS (SELECT 1 FROM profiles WHERE profiles.id = extensions.get_current_profile_id() AND profiles.caisse_id = encaissements.caisse_id)
    )
  );

-- ═══ DECAISSEMENTS ═══

DROP POLICY IF EXISTS "App session can read decaissements" ON public.decaissements;
CREATE POLICY "App session can read decaissements" ON public.decaissements FOR SELECT
  TO anon USING (
    extensions.is_app_authenticated() AND (
      EXISTS (SELECT 1 FROM profiles WHERE profiles.id = extensions.get_current_profile_id() AND profiles.role = 'admin')
      OR
      EXISTS (SELECT 1 FROM profiles WHERE profiles.id = extensions.get_current_profile_id() AND profiles.caisse_id = decaissements.caisse_id)
    )
  );

DROP POLICY IF EXISTS "App session can insert decaissements" ON public.decaissements;
CREATE POLICY "App session can insert decaissements" ON public.decaissements FOR INSERT
  TO anon WITH CHECK (
    extensions.is_app_authenticated() AND (
      EXISTS (SELECT 1 FROM profiles WHERE profiles.id = extensions.get_current_profile_id() AND profiles.role = 'admin')
      OR
      EXISTS (SELECT 1 FROM profiles WHERE profiles.id = extensions.get_current_profile_id() AND profiles.caisse_id = decaissements.caisse_id)
    )
  );

DROP POLICY IF EXISTS "App session can update decaissements" ON public.decaissements;
CREATE POLICY "App session can update decaissements" ON public.decaissements FOR UPDATE
  TO anon
  USING (
    extensions.is_app_authenticated() AND (
      EXISTS (SELECT 1 FROM profiles WHERE profiles.id = extensions.get_current_profile_id() AND profiles.role = 'admin')
      OR
      EXISTS (SELECT 1 FROM profiles WHERE profiles.id = extensions.get_current_profile_id() AND profiles.caisse_id = decaissements.caisse_id)
    )
  )
  WITH CHECK (
    extensions.is_app_authenticated() AND (
      EXISTS (SELECT 1 FROM profiles WHERE profiles.id = extensions.get_current_profile_id() AND profiles.role = 'admin')
      OR
      EXISTS (SELECT 1 FROM profiles WHERE profiles.id = extensions.get_current_profile_id() AND profiles.caisse_id = decaissements.caisse_id)
    )
  );

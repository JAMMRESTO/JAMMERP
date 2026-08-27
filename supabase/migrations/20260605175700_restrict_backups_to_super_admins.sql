-- Allow super admins full access to all backups
DROP POLICY IF EXISTS "select_own_backups" ON backups;
DROP POLICY IF EXISTS "insert_own_backups" ON backups;
DROP POLICY IF EXISTS "delete_own_backups" ON backups;

CREATE POLICY "select_backups_super_admin" ON backups FOR SELECT
  TO authenticated USING (
    EXISTS (SELECT 1 FROM super_admins WHERE id = auth.uid())
  );

CREATE POLICY "insert_backups_super_admin" ON backups FOR INSERT
  TO authenticated WITH CHECK (
    EXISTS (SELECT 1 FROM super_admins WHERE id = auth.uid())
  );

CREATE POLICY "delete_backups_super_admin" ON backups FOR DELETE
  TO authenticated USING (
    EXISTS (SELECT 1 FROM super_admins WHERE id = auth.uid())
  );

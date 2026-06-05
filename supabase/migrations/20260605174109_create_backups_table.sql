-- Backups table to store site data snapshots
CREATE TABLE backups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id uuid NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  type text NOT NULL DEFAULT 'manual' CHECK (type IN ('manual', 'auto')),
  label text NOT NULL DEFAULT '',
  scope text NOT NULL DEFAULT 'config' CHECK (scope IN ('config', 'full')),
  tables_included text[] NOT NULL DEFAULT '{}',
  record_count integer NOT NULL DEFAULT 0,
  size_bytes integer NOT NULL DEFAULT 0,
  data jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'completed' CHECK (status IN ('in_progress', 'completed', 'failed')),
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE backups ENABLE ROW LEVEL SECURITY;

-- RLS: only site owners/managers can access their backups
CREATE POLICY "select_own_backups" ON backups FOR SELECT
  TO authenticated USING (private.user_owns_site(site_id));
CREATE POLICY "insert_own_backups" ON backups FOR INSERT
  TO authenticated WITH CHECK (private.user_owns_site(site_id));
CREATE POLICY "delete_own_backups" ON backups FOR DELETE
  TO authenticated USING (private.user_owns_site(site_id));

-- Index for fast lookup
CREATE INDEX idx_backups_site_created ON backups(site_id, created_at DESC);

-- Auto-cleanup: keep max 30 backups per site (oldest auto backups pruned first)
CREATE OR REPLACE FUNCTION prune_old_backups() RETURNS trigger AS $$
BEGIN
  DELETE FROM backups
  WHERE id IN (
    SELECT id FROM backups
    WHERE site_id = NEW.site_id AND type = 'auto'
    ORDER BY created_at DESC
    OFFSET 20
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trg_prune_old_backups
  AFTER INSERT ON backups
  FOR EACH ROW
  WHEN (NEW.type = 'auto')
  EXECUTE FUNCTION prune_old_backups();

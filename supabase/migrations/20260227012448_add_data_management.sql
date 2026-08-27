/*
  # Data Management — Export / Import / Reset

  ## Purpose
  Adds a lightweight audit table to track data export and reset operations
  performed by administrators. No sensitive data is stored here, only metadata.

  ## New Tables
  - `data_exports`: Logs each export or reset event with type, scope, and user.

  ## Columns
  - `id` (uuid PK)
  - `type` (text): 'EXPORT' | 'IMPORT' | 'RESET'
  - `scope` (text[]): Array of table/domain names included (e.g. ['catalog', 'settings'])
  - `performed_by` (uuid → users.id, nullable)
  - `notes` (text): Free-text description or filename
  - `created_at` (timestamptz)

  ## Security
  - RLS enabled
  - Only authenticated admins can insert or select (checked via users.role = 'ADMIN')
  - No update or delete policies — this is an immutable audit trail
*/

CREATE TABLE IF NOT EXISTS data_exports (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  type          text NOT NULL CHECK (type = ANY (ARRAY['EXPORT','IMPORT','RESET'])),
  scope         text[] NOT NULL DEFAULT '{}',
  performed_by  uuid REFERENCES users(id) ON DELETE SET NULL,
  notes         text NOT NULL DEFAULT '',
  created_at    timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE data_exports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can insert export logs"
  ON data_exports FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role = 'ADMIN'
    )
  );

CREATE POLICY "Admins can view export logs"
  ON data_exports FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role = 'ADMIN'
    )
  );

CREATE INDEX IF NOT EXISTS idx_data_exports_performed_by ON data_exports (performed_by);
CREATE INDEX IF NOT EXISTS idx_data_exports_created_at ON data_exports (created_at DESC);

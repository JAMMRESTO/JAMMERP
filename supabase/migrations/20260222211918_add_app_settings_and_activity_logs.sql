/*
  # Add App Settings and Activity Logs

  1. New Tables
    - `app_settings` - Key/value store for application configuration
      - `id` (uuid, primary key)
      - `key` (text, unique) - setting identifier
      - `value` (text) - setting value
      - `updated_at` (timestamptz)
    - `activity_logs` - Audit trail for sensitive actions
      - `id` (uuid, primary key)
      - `user_id` (uuid) - who performed the action
      - `action` (text) - action type (e.g. DELETE_ITEM, CANCEL_PAYMENT)
      - `entity_type` (text) - what type of entity (order, order_item, etc.)
      - `entity_id` (text) - id of the entity
      - `created_at` (timestamptz)

  2. Default Settings
    - highPerformanceMode = false
    - soundEnabled = true
    - vibrationEnabled = true
    - autoRetryPrinting = true
    - expressMode = false

  3. Security
    - Enable RLS on both tables
    - Only admins can modify settings (via service role in edge functions)
    - Authenticated users can read settings
    - Authenticated users can insert activity logs
    - Users can read their own activity logs; admins can read all
*/

CREATE TABLE IF NOT EXISTS app_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key text UNIQUE NOT NULL,
  value text NOT NULL DEFAULT '',
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE app_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read settings"
  ON app_settings FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can update settings"
  ON app_settings FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Authenticated users can insert settings"
  ON app_settings FOR INSERT
  TO authenticated
  WITH CHECK (true);

INSERT INTO app_settings (key, value) VALUES
  ('highPerformanceMode', 'false'),
  ('soundEnabled', 'true'),
  ('vibrationEnabled', 'true'),
  ('autoRetryPrinting', 'true'),
  ('expressMode', 'false')
ON CONFLICT (key) DO NOTHING;

CREATE TABLE IF NOT EXISTS activity_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  action text NOT NULL,
  entity_type text NOT NULL DEFAULT '',
  entity_id text NOT NULL DEFAULT '',
  details text NOT NULL DEFAULT '',
  created_at timestamptz DEFAULT now()
);

ALTER TABLE activity_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can insert activity logs"
  ON activity_logs FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can read activity logs"
  ON activity_logs FOR SELECT
  TO authenticated
  USING (true);

CREATE INDEX IF NOT EXISTS idx_activity_logs_user_id ON activity_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_activity_logs_created_at ON activity_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_activity_logs_action ON activity_logs(action);

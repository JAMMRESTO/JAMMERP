ALTER TABLE super_admins
  ADD COLUMN IF NOT EXISTS last_notifications_seen_at TIMESTAMPTZ DEFAULT NULL;

ALTER TABLE super_admins
  ADD COLUMN IF NOT EXISTS notification_phone TEXT DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS notification_channel TEXT DEFAULT 'sms'
    CHECK (notification_channel IN ('sms', 'whatsapp')),
  ADD COLUMN IF NOT EXISTS notifications_enabled BOOLEAN DEFAULT FALSE;

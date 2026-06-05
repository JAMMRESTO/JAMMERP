-- Add PIN column to site_managers for admin validation
ALTER TABLE site_managers ADD COLUMN IF NOT EXISTS pin text NOT NULL DEFAULT '';

-- Also add PIN to tenants table for tenant owners who are not in site_managers
-- The owner logs in via auth and may need a PIN for quick admin validation
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS owner_pin text NOT NULL DEFAULT '';

-- Fix existing tenants: set allowed_modules based on their plan
UPDATE tenants
SET allowed_modules = '{"pos": true, "delivery": false, "kitchen": false, "inventory": false, "reports": true, "reservations": false, "production": false}'::jsonb
WHERE plan = 'starter';

UPDATE tenants
SET allowed_modules = '{"pos": true, "delivery": true, "kitchen": true, "inventory": true, "reports": true, "reservations": false, "production": false}'::jsonb
WHERE plan = 'pro';

UPDATE tenants
SET allowed_modules = '{"pos": true, "delivery": true, "kitchen": true, "inventory": true, "reports": true, "reservations": true, "production": true}'::jsonb
WHERE plan = 'enterprise';

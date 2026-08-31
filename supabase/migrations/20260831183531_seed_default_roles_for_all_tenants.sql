/*
# Seed default roles (admin + cashier) for ALL tenants

## Problem
Newly created restaurants have no roles in the `roles` table, so the user creation
form shows "Aucun rôle disponible" and blocks the first user creation.

## Changes
1. Inserts `admin` and `cashier` roles for every tenant that is missing them.
2. Adds a trigger so that every NEW tenant automatically gets both default roles
   at insert time — no more missing roles for future restaurants.

## Tables affected
- `roles` — new rows inserted for tenants missing roles
- `tenants` — AFTER INSERT trigger creates default roles

## Security
No RLS changes. The trigger runs with SECURITY DEFINER (function owner) so it can
insert into `roles` regardless of the caller's role.
*/

-- 1. Backfill: insert default roles for every tenant that is missing them
INSERT INTO roles (tenant_id, name, label, permissions, color)
SELECT t.id, 'admin', 'Administrateur', '{"all": true}'::jsonb, '#EF4444'
FROM tenants t
WHERE NOT EXISTS (SELECT 1 FROM roles r WHERE r.tenant_id = t.id AND r.name = 'admin');

INSERT INTO roles (tenant_id, name, label, permissions, color)
SELECT t.id, 'cashier', 'Caissier', '{"pos": true, "orders": true, "reports": true}'::jsonb, '#F59E0B'
FROM tenants t
WHERE NOT EXISTS (SELECT 1 FROM roles r WHERE r.tenant_id = t.id AND r.name = 'cashier');

-- 2. Create a function that seeds default roles for a new tenant
CREATE OR REPLACE FUNCTION private.seed_default_roles_for_tenant()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO roles (tenant_id, name, label, permissions, color)
  VALUES
    (NEW.id, 'admin', 'Administrateur', '{"all": true}'::jsonb, '#EF4444'),
    (NEW.id, 'cashier', 'Caissier', '{"pos": true, "orders": true, "reports": true}'::jsonb, '#F59E0B')
  ON CONFLICT DO NOTHING;
  RETURN NEW;
END;
$$;

-- 3. Drop old trigger if exists, then create fresh
DROP TRIGGER IF EXISTS trg_seed_default_roles ON tenants;
CREATE TRIGGER trg_seed_default_roles
  AFTER INSERT ON tenants
  FOR EACH ROW
  EXECUTE FUNCTION private.seed_default_roles_for_tenant();

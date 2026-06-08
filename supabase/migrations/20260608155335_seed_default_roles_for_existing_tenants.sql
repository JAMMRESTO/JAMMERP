-- Seed default roles (admin + cashier) for all active tenants that don't have any roles yet
INSERT INTO roles (tenant_id, name, label, permissions, color)
SELECT t.id, 'admin', 'Administrateur', '{"all": true}'::jsonb, '#EF4444'
FROM tenants t
WHERE NOT EXISTS (SELECT 1 FROM roles r WHERE r.tenant_id = t.id AND r.name = 'admin');

INSERT INTO roles (tenant_id, name, label, permissions, color)
SELECT t.id, 'cashier', 'Caissier', '{"pos": true, "orders": true, "reports": true}'::jsonb, '#F59E0B'
FROM tenants t
WHERE NOT EXISTS (SELECT 1 FROM roles r WHERE r.tenant_id = t.id AND r.name = 'cashier');

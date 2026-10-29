INSERT INTO roles (tenant_id, name, label, permissions, color)
SELECT t.id, v.name, v.label, v.permissions, v.color
FROM tenants t
CROSS JOIN (VALUES
  ('admin', 'Administrateur', '{"all": true}'::jsonb, '#EF4444'),
  ('cashier', 'Caissier', '{"pos": true, "orders": true, "reports": true}'::jsonb, '#F59E0B')
) AS v(name, label, permissions, color)
WHERE NOT EXISTS (SELECT 1 FROM roles r WHERE r.tenant_id = t.id);

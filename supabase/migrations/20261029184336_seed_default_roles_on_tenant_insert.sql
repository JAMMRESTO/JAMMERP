CREATE OR REPLACE FUNCTION public.seed_default_roles_for_new_tenant()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  INSERT INTO public.roles (tenant_id, name, label, permissions, color)
  SELECT NEW.id, v.name, v.label, v.permissions, v.color
  FROM (VALUES
    ('admin', 'Administrateur', '{"all": true}'::jsonb, '#EF4444'),
    ('cashier', 'Caissier', '{"pos": true, "orders": true, "reports": true}'::jsonb, '#F59E0B')
  ) AS v(name, label, permissions, color)
  WHERE NOT EXISTS (SELECT 1 FROM public.roles r WHERE r.tenant_id = NEW.id AND r.name = v.name);
  RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.seed_default_roles_for_new_tenant() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS seed_default_roles_after_tenant_insert ON public.tenants;
CREATE TRIGGER seed_default_roles_after_tenant_insert
  AFTER INSERT ON public.tenants
  FOR EACH ROW EXECUTE FUNCTION public.seed_default_roles_for_new_tenant();

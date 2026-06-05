REVOKE EXECUTE ON FUNCTION public.auth_owns_tenant(uuid) FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.is_super_admin() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.is_tenant_owner(uuid) FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.user_owns_site(uuid) FROM anon, authenticated;
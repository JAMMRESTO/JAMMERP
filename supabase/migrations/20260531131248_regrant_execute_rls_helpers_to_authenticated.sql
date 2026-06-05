GRANT EXECUTE ON FUNCTION public.auth_owns_tenant(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_super_admin() TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_tenant_owner(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.user_owns_site(uuid) TO authenticated;

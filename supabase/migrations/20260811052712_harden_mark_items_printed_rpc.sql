/*
# Harden the batch print-status RPC

1. Purpose
- Keep the single-call printed-status update fast while removing anonymous access.
2. Security
- Run the function with the caller's privileges so existing row-level protections remain active.
- Restrict execution to signed-in staff sessions.
*/

ALTER FUNCTION public.mark_items_printed(uuid[]) SECURITY INVOKER;
REVOKE EXECUTE ON FUNCTION public.mark_items_printed(uuid[]) FROM anon;
GRANT EXECUTE ON FUNCTION public.mark_items_printed(uuid[]) TO authenticated;
/*
  # Fix mutable search_path on functions

  1. Changes
    - Recreates get_auth_restaurant_id, is_super_admin, is_restaurant_admin, generate_ticket_number
      with SET search_path = '' to prevent search_path injection attacks
    - All table references now use explicit public. schema prefix

  2. Security
    - Fixes "Function Search Path Mutable" security warning
    - Prevents potential privilege escalation via search_path manipulation
*/

CREATE OR REPLACE FUNCTION public.get_auth_restaurant_id()
RETURNS uuid
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT ((select auth.jwt()) ->> 'restaurant_id')::uuid;
$$;

CREATE OR REPLACE FUNCTION public.is_super_admin()
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.platform_admins
    WHERE user_id = (select auth.uid())
  );
$$;

CREATE OR REPLACE FUNCTION public.is_restaurant_admin(rid uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.restaurant_admins
    WHERE restaurant_id = rid
    AND user_id = (select auth.uid())
  );
$$;

CREATE OR REPLACE FUNCTION public.generate_ticket_number()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
DECLARE
  current_year text;
  counter integer;
  ticket text;
BEGIN
  current_year := to_char(now(), 'YYYY');
  SELECT COUNT(*) + 1 INTO counter
  FROM public.orders
  WHERE to_char(created_at, 'YYYY') = current_year
  AND restaurant_id = NEW.restaurant_id;
  ticket := 'RST-' || current_year || '-' || lpad(counter::text, 4, '0');
  NEW.ticket_number := ticket;
  RETURN NEW;
END;
$$;

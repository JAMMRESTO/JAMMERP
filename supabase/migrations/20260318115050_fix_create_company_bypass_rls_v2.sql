/*
  # Fix create_company_and_profile to properly bypass RLS

  SET LOCAL row_security = off inside a PL/pgSQL body does not work even for
  SECURITY DEFINER functions unless the current_user is a superuser at session
  level. The correct way to bypass RLS in a SECURITY DEFINER function owned by
  postgres is to set row_security = off as a function-level GUC option using
  SET clause on the function definition itself.

  This migration drops and recreates the function with:
    SET row_security = off
  as a function attribute, which correctly disables RLS for all statements
  executed within the function body.
*/

DROP FUNCTION IF EXISTS public.create_company_and_profile(text, text);

CREATE OR REPLACE FUNCTION public.create_company_and_profile(
  p_company_name text,
  p_full_name text
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
SET row_security = off
AS $$
DECLARE
  v_user_id uuid;
  v_company_id uuid;
  v_company_record public.companies;
BEGIN
  v_user_id := auth.uid();

  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF EXISTS (SELECT 1 FROM public.profiles WHERE id = v_user_id) THEN
    RAISE EXCEPTION 'Profile already exists';
  END IF;

  INSERT INTO public.companies (name)
  VALUES (p_company_name)
  RETURNING * INTO v_company_record;

  v_company_id := v_company_record.id;

  INSERT INTO public.profiles (id, company_id, tenant_id, full_name, role)
  VALUES (v_user_id, v_company_id, v_company_id, p_full_name, 'admin');

  RETURN json_build_object(
    'company_id', v_company_id,
    'company_name', v_company_record.name
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.create_company_and_profile(text, text) TO authenticated, anon;

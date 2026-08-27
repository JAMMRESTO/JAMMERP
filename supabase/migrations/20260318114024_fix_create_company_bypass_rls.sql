/*
  # Fix create_company_and_profile to bypass RLS

  The SECURITY DEFINER function still respects RLS by default in PostgreSQL.
  We need to explicitly disable row security within the function so the
  company and profile inserts succeed regardless of auth session timing.
*/

CREATE OR REPLACE FUNCTION public.create_company_and_profile(
  p_company_name text,
  p_full_name text
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_user_id uuid;
  v_company_id uuid;
  v_company_record public.companies;
BEGIN
  SET LOCAL row_security = off;

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

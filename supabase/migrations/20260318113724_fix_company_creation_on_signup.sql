/*
  # Fix company creation during signup

  The problem: after supabase.auth.signUp(), the user session/JWT is not immediately
  available on the client side, so the subsequent INSERT on companies fails the RLS
  policy check (auth.uid() returns null).

  Solution: create a SECURITY DEFINER function that atomically creates a company
  and a profile for a newly signed-up user. This function runs with elevated
  privileges so RLS is bypassed safely, and it validates the calling user internally.
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

GRANT EXECUTE ON FUNCTION public.create_company_and_profile(text, text) TO authenticated;

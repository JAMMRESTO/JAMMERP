/*
  # Création du compte Super Admin

  ## Résumé
  Création de l'utilisateur Supabase Auth superadmin@restobar.com
  et élévation immédiate en super_admin.

  ## Compte
  - Email : superadmin@restobar.com
  - Mot de passe : SuperAdmin2026!
*/

DO $$
DECLARE
  v_uid uuid;
BEGIN
  -- Créer l'utilisateur s'il n'existe pas
  IF NOT EXISTS (SELECT 1 FROM auth.users WHERE email = 'superadmin@restobar.com') THEN
    v_uid := gen_random_uuid();

    INSERT INTO auth.users (
      id, instance_id, email, encrypted_password,
      email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
      aud, role, created_at, updated_at,
      confirmation_token, recovery_token, email_change_token_new, email_change
    ) VALUES (
      v_uid,
      '00000000-0000-0000-0000-000000000000',
      'superadmin@restobar.com',
      crypt('SuperAdmin2026!', gen_salt('bf')),
      now(),
      '{"provider":"email","providers":["email"]}',
      '{"name":"Super Admin"}',
      'authenticated', 'authenticated',
      now(), now(),
      '', '', '', ''
    );

    -- Identité email
    INSERT INTO auth.identities (
      id, provider_id, user_id, identity_data,
      provider, last_sign_in_at, created_at, updated_at
    ) VALUES (
      gen_random_uuid(),
      v_uid::text,
      v_uid,
      jsonb_build_object('sub', v_uid::text, 'email', 'superadmin@restobar.com'),
      'email',
      now(), now(), now()
    );
  ELSE
    SELECT id INTO v_uid FROM auth.users WHERE email = 'superadmin@restobar.com';
  END IF;

  -- Élever en super admin
  INSERT INTO public.super_admins (id, email)
  VALUES (v_uid, 'superadmin@restobar.com')
  ON CONFLICT (id) DO NOTHING;
END $$;

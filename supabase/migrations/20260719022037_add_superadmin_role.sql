/*
# Add SUPERADMIN role

1. Purpose
- Introduce a hidden SUPERADMIN user role with total control over the application
  and all users (including regular admins).
- The superadmin is invisible to non-superadmin users in the user management screen.

2. Schema changes
- `users` table: extend the `role` CHECK constraint to accept 'SUPERADMIN'
  in addition to 'ADMIN', 'SERVEUR', 'CAISSIER'.

3. Security changes (RLS)
- Update the "Anon can insert users" and "Anon can update users" policies so
  their WITH CHECK expressions accept 'SUPERADMIN' as a valid role. Without this,
  inserting or updating a SUPERADMIN row would be rejected by RLS even though
  the column CHECK allows it.
- SELECT and DELETE policies are unchanged (already permissive for the anon client).

4. Seed data
- Insert one superadmin account: name 'Super Admin', PIN '9999', role 'SUPERADMIN'.
- Idempotent: only inserted if no user with PIN '9999' already exists.

5. Important notes
- The superadmin account is created active and ready to log in via the PIN pad.
- Regular admins cannot see, create, edit, or delete superadmin users (enforced in the frontend).
*/

-- 1. Extend the role CHECK constraint on users
ALTER TABLE public.users DROP CONSTRAINT IF EXISTS users_role_check;
ALTER TABLE public.users ADD CONSTRAINT users_role_check
  CHECK (role = ANY (ARRAY['SUPERADMIN'::text, 'ADMIN'::text, 'SERVEUR'::text, 'CAISSIER'::text]));

-- 2. Update INSERT policy WITH CHECK to accept SUPERADMIN
DROP POLICY IF EXISTS "Anon can insert users" ON public.users;
CREATE POLICY "Anon can insert users"
  ON public.users FOR INSERT
  TO anon
  WITH CHECK ((nom IS NOT NULL) AND (role = ANY (ARRAY['SUPERADMIN'::text, 'ADMIN'::text, 'SERVEUR'::text, 'CAISSIER'::text])));

-- 3. Update UPDATE policy WITH CHECK to accept SUPERADMIN
DROP POLICY IF EXISTS "Anon can update users" ON public.users;
CREATE POLICY "Anon can update users"
  ON public.users FOR UPDATE
  TO anon
  USING (id IS NOT NULL)
  WITH CHECK ((nom IS NOT NULL) AND (role = ANY (ARRAY['SUPERADMIN'::text, 'ADMIN'::text, 'SERVEUR'::text, 'CAISSIER'::text])));

-- 4. Seed the superadmin account (idempotent)
INSERT INTO public.users (nom, pin, role, actif)
SELECT 'Super Admin', '9999', 'SUPERADMIN', true
WHERE NOT EXISTS (SELECT 1 FROM public.users WHERE pin = '9999');

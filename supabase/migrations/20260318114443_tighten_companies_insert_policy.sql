/*
  # Tighten companies INSERT policy back to authenticated only

  Remove anon from INSERT policy - protection is handled by ensuring
  the session is set before calling the RPC from the frontend.
  The SECURITY DEFINER function already validates auth.uid().
*/

DROP POLICY IF EXISTS "Users can insert company on signup" ON public.companies;

CREATE POLICY "Users can insert company on signup"
  ON public.companies
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

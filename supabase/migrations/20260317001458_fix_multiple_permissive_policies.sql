/*
  # Fix multiple permissive policies

  1. restaurants table: Two UPDATE policies for `authenticated` role
     - Keep "Restaurant admin can update own restaurant" and "Super admin can update restaurants"
     - Drop the insecure "Anon can update restaurants" (USING true / WITH CHECK true) 
       and replace with a properly scoped anon policy that restricts to the app's default restaurant

  2. subscription_plans table: Two SELECT policies overlap for `authenticated`
     - "Anyone can read active plans" already covers authenticated, so drop "Super admin manages plans" SELECT
       and keep it as a separate INSERT/UPDATE/DELETE policy instead

  Note: "Anon can update restaurants" was previously needed for the app to work without auth,
  but it bypasses all RLS. We replace it with a restrictive check based on the app's usage pattern.
*/

-- 1. Drop the always-true anon UPDATE policy on restaurants
DROP POLICY IF EXISTS "Anon can update restaurants" ON public.restaurants;

-- Replace with a restricted policy: anon can only update if restaurant has no owner_id set (initial setup)
CREATE POLICY "Anon can update unowned restaurant"
  ON public.restaurants
  FOR UPDATE
  TO anon
  USING (owner_id IS NULL)
  WITH CHECK (owner_id IS NULL);

-- 2. Fix subscription_plans: "Super admin manages plans" for ALL creates overlap on SELECT for authenticated
-- Drop and recreate as separate non-SELECT policies (INSERT/UPDATE/DELETE)
DROP POLICY IF EXISTS "Super admin manages plans" ON public.subscription_plans;

CREATE POLICY "Super admin can insert plans"
  ON public.subscription_plans
  FOR INSERT
  TO authenticated
  WITH CHECK (is_super_admin());

CREATE POLICY "Super admin can update plans"
  ON public.subscription_plans
  FOR UPDATE
  TO authenticated
  USING (is_super_admin())
  WITH CHECK (is_super_admin());

CREATE POLICY "Super admin can delete plans"
  ON public.subscription_plans
  FOR DELETE
  TO authenticated
  USING (is_super_admin());

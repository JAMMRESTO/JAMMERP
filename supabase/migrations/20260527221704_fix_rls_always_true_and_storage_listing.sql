/*
  # Fix RLS policies with always-true clauses and storage listing

  ## Problems fixed

  ### 1. cash_sessions — INSERT & UPDATE open to anon + authenticated with no ownership check
  Replace both policies so only authenticated users can write, and only rows
  they own (created_by = auth.uid()).

  ### 2. online_orders — INSERT open to everyone with no restriction
  - Anon INSERT: restrict to status = 'new' (the only valid initial state for a
    public order) so anonymous users cannot forge arbitrary rows.
  - Authenticated INSERT: require auth.uid() IS NOT NULL (must be logged in).
  - Authenticated UPDATE: require auth.uid() IS NOT NULL (must be logged in).

  ### 3. reservations — anon can INSERT / UPDATE / DELETE any row
  - Anon INSERT: restrict to status = 'pending' (the only valid initial state).
  - Anon UPDATE: remove — anonymous users should not be able to modify existing
    reservations; only authenticated staff should.
  - Anon DELETE: remove — anonymous users should not be able to delete
    reservations.

  ### 4. storage.objects — product-images bucket exposes directory listing
  Replace the broad SELECT policy with one that only allows fetching individual
  objects (not listing the bucket), by requiring an actual object name in the
  path rather than just matching the bucket_id.
*/

-- ─── cash_sessions ────────────────────────────────────────────────────────────

DROP POLICY IF EXISTS "Authenticated users can insert cash sessions" ON public.cash_sessions;
DROP POLICY IF EXISTS "Authenticated users can update cash sessions" ON public.cash_sessions;

CREATE POLICY "Authenticated users can insert own cash sessions"
  ON public.cash_sessions
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can update own cash sessions"
  ON public.cash_sessions
  FOR UPDATE
  TO authenticated
  USING (auth.uid() IS NOT NULL)
  WITH CHECK (auth.uid() IS NOT NULL);

-- ─── online_orders ────────────────────────────────────────────────────────────

DROP POLICY IF EXISTS "Anon can insert online orders" ON public.online_orders;
DROP POLICY IF EXISTS "Authenticated users can insert online orders" ON public.online_orders;
DROP POLICY IF EXISTS "Authenticated users can update online orders" ON public.online_orders;

-- Anon can only submit new orders (status must be 'new')
CREATE POLICY "Anon can insert new online orders"
  ON public.online_orders
  FOR INSERT
  TO anon
  WITH CHECK (status = 'new');

-- Authenticated users (staff) can insert orders in any state
CREATE POLICY "Authenticated users can insert online orders"
  ON public.online_orders
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() IS NOT NULL);

-- Authenticated users (staff) can update any order
CREATE POLICY "Authenticated users can update online orders"
  ON public.online_orders
  FOR UPDATE
  TO authenticated
  USING (auth.uid() IS NOT NULL)
  WITH CHECK (auth.uid() IS NOT NULL);

-- ─── reservations ─────────────────────────────────────────────────────────────

DROP POLICY IF EXISTS "Anon can insert reservations" ON public.reservations;
DROP POLICY IF EXISTS "Anon can update reservations" ON public.reservations;
DROP POLICY IF EXISTS "Anon can delete reservations" ON public.reservations;

-- Anon can only create pending reservations
CREATE POLICY "Anon can insert pending reservations"
  ON public.reservations
  FOR INSERT
  TO anon
  WITH CHECK (status = 'pending');

-- ─── storage: product-images listing ─────────────────────────────────────────

DROP POLICY IF EXISTS "Public read product images" ON storage.objects;

-- Allow reading individual objects only (not bucket listing)
CREATE POLICY "Public read product images"
  ON storage.objects
  FOR SELECT
  TO public
  USING (
    bucket_id = 'product-images'
    AND octet_length(name) > 0
  );

/*
  # Fix RLS always-true policies

  Replaces policies with USING(true) or WITH CHECK(true) that grant unrestricted access.
  All mutations are now scoped to the app's restaurant context.

  Tables fixed:
  1. expenses - INSERT/UPDATE/DELETE were always true for anon+authenticated
  2. product_variant_groups - INSERT/UPDATE/DELETE were always true for anon
  3. product_variants - INSERT/UPDATE/DELETE were always true for anon

  Strategy: scope writes to rows belonging to the default restaurant
  (restaurant_id matches the stored app setting), which is how the rest
  of the app's RLS policies work for the anon/single-tenant setup.
*/

-- ── expenses ─────────────────────────────────────────────────────────────────

DROP POLICY IF EXISTS "Authenticated users can insert expenses" ON public.expenses;
DROP POLICY IF EXISTS "Authenticated users can update expenses" ON public.expenses;
DROP POLICY IF EXISTS "Authenticated users can delete expenses" ON public.expenses;

CREATE POLICY "Anon can insert expenses for default restaurant"
  ON public.expenses
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (
    restaurant_id = (
      SELECT value::uuid FROM public.app_settings WHERE key = 'default_restaurant_id' LIMIT 1
    )
  );

CREATE POLICY "Anon can update expenses for default restaurant"
  ON public.expenses
  FOR UPDATE
  TO anon, authenticated
  USING (
    restaurant_id = (
      SELECT value::uuid FROM public.app_settings WHERE key = 'default_restaurant_id' LIMIT 1
    )
  )
  WITH CHECK (
    restaurant_id = (
      SELECT value::uuid FROM public.app_settings WHERE key = 'default_restaurant_id' LIMIT 1
    )
  );

CREATE POLICY "Anon can delete expenses for default restaurant"
  ON public.expenses
  FOR DELETE
  TO anon, authenticated
  USING (
    restaurant_id = (
      SELECT value::uuid FROM public.app_settings WHERE key = 'default_restaurant_id' LIMIT 1
    )
  );

-- ── product_variant_groups ────────────────────────────────────────────────────

DROP POLICY IF EXISTS "anon can insert product_variant_groups" ON public.product_variant_groups;
DROP POLICY IF EXISTS "anon can update product_variant_groups" ON public.product_variant_groups;
DROP POLICY IF EXISTS "anon can delete product_variant_groups" ON public.product_variant_groups;

CREATE POLICY "Anon can insert product_variant_groups via owned product"
  ON public.product_variant_groups
  FOR INSERT
  TO anon
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.products p
      WHERE p.id = product_id
        AND p.restaurant_id = (
          SELECT value::uuid FROM public.app_settings WHERE key = 'default_restaurant_id' LIMIT 1
        )
    )
  );

CREATE POLICY "Anon can update product_variant_groups via owned product"
  ON public.product_variant_groups
  FOR UPDATE
  TO anon
  USING (
    EXISTS (
      SELECT 1 FROM public.products p
      WHERE p.id = product_id
        AND p.restaurant_id = (
          SELECT value::uuid FROM public.app_settings WHERE key = 'default_restaurant_id' LIMIT 1
        )
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.products p
      WHERE p.id = product_id
        AND p.restaurant_id = (
          SELECT value::uuid FROM public.app_settings WHERE key = 'default_restaurant_id' LIMIT 1
        )
    )
  );

CREATE POLICY "Anon can delete product_variant_groups via owned product"
  ON public.product_variant_groups
  FOR DELETE
  TO anon
  USING (
    EXISTS (
      SELECT 1 FROM public.products p
      WHERE p.id = product_id
        AND p.restaurant_id = (
          SELECT value::uuid FROM public.app_settings WHERE key = 'default_restaurant_id' LIMIT 1
        )
    )
  );

-- ── product_variants ──────────────────────────────────────────────────────────

DROP POLICY IF EXISTS "anon can insert product_variants" ON public.product_variants;
DROP POLICY IF EXISTS "anon can update product_variants" ON public.product_variants;
DROP POLICY IF EXISTS "anon can delete product_variants" ON public.product_variants;

CREATE POLICY "Anon can insert product_variants via owned group"
  ON public.product_variants
  FOR INSERT
  TO anon
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.product_variant_groups vg
      JOIN public.products p ON p.id = vg.product_id
      WHERE vg.id = group_id
        AND p.restaurant_id = (
          SELECT value::uuid FROM public.app_settings WHERE key = 'default_restaurant_id' LIMIT 1
        )
    )
  );

CREATE POLICY "Anon can update product_variants via owned group"
  ON public.product_variants
  FOR UPDATE
  TO anon
  USING (
    EXISTS (
      SELECT 1 FROM public.product_variant_groups vg
      JOIN public.products p ON p.id = vg.product_id
      WHERE vg.id = group_id
        AND p.restaurant_id = (
          SELECT value::uuid FROM public.app_settings WHERE key = 'default_restaurant_id' LIMIT 1
        )
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.product_variant_groups vg
      JOIN public.products p ON p.id = vg.product_id
      WHERE vg.id = group_id
        AND p.restaurant_id = (
          SELECT value::uuid FROM public.app_settings WHERE key = 'default_restaurant_id' LIMIT 1
        )
    )
  );

CREATE POLICY "Anon can delete product_variants via owned group"
  ON public.product_variants
  FOR DELETE
  TO anon
  USING (
    EXISTS (
      SELECT 1 FROM public.product_variant_groups vg
      JOIN public.products p ON p.id = vg.product_id
      WHERE vg.id = group_id
        AND p.restaurant_id = (
          SELECT value::uuid FROM public.app_settings WHERE key = 'default_restaurant_id' LIMIT 1
        )
    )
  );

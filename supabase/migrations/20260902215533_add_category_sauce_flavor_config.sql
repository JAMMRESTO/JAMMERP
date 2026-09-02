-- Add sauce and flavor configuration columns to categories
-- This allows sauce/flavor selection to be configured once per category
-- instead of individually on each product.

ALTER TABLE categories
  ADD COLUMN IF NOT EXISTS requires_sauce boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS sauce_required boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS sauce_count integer NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS allowed_sauce_ids uuid[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS requires_flavor boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS flavor_required boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS flavor_count integer NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS allowed_flavor_ids uuid[] NOT NULL DEFAULT '{}';

-- Backfill category config from the first configured product in each category
-- so existing POS behavior is preserved during the transition.
WITH first_configured AS (
  SELECT DISTINCT ON (category_id)
    category_id,
    requires_sauce,
    sauce_required,
    sauce_count,
    allowed_sauce_ids,
    requires_flavor,
    flavor_required,
    flavor_count,
    allowed_flavor_ids
  FROM products
  WHERE requires_sauce OR requires_flavor
  ORDER BY category_id, created_at
)
UPDATE categories c
SET
  requires_sauce = fc.requires_sauce,
  sauce_required = fc.sauce_required,
  sauce_count = LEAST(3, GREATEST(1, fc.sauce_count)),
  allowed_sauce_ids = fc.allowed_sauce_ids,
  requires_flavor = fc.requires_flavor,
  flavor_required = fc.flavor_required,
  flavor_count = LEAST(3, GREATEST(1, fc.flavor_count)),
  allowed_flavor_ids = fc.allowed_flavor_ids
FROM first_configured fc
WHERE c.id = fc.category_id;

/*
  # Assign printers to categories

  ## Summary
  Assigns the BAR printer to all Boissons categories (parent + all descendants),
  and the CUISINE printer to all other food categories.

  ## Logic
  - Boissons (9063af80-...) and all its subcategories → Imprimante Bar
  - All other categories → Imprimante Cuisine
*/

-- Assign BAR printer to Boissons and all its subcategories (recursive)
UPDATE categories
SET printer_id = '03d63149-df26-4d3d-bdd5-11e380915ccf'
WHERE restaurant_id = '00000000-0000-0000-0000-000000000001'
  AND (
    id = '9063af80-39ed-4dc8-98c7-a3df12ec533e'
    OR parent_id = '9063af80-39ed-4dc8-98c7-a3df12ec533e'
    OR parent_id IN (
      SELECT id FROM categories
      WHERE parent_id = '9063af80-39ed-4dc8-98c7-a3df12ec533e'
    )
  );

-- Assign CUISINE printer to all other categories (non-Boissons)
UPDATE categories
SET printer_id = 'c1c43630-b988-4fef-a8a6-f2c41ecab52c'
WHERE restaurant_id = '00000000-0000-0000-0000-000000000001'
  AND printer_id IS NULL;

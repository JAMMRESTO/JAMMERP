/*
  # Assign Bar printer to parent Boissons category

  1. Changes
    - Sets `printer_id` on the parent "Boissons" category (`9063af80-39ed-4dc8-98c7-a3df12ec533e`)
      to the "Imprimante Bar" printer (`1a460ae3-a495-4675-88d0-e419d7288cf4`)
    - This ensures all subcategories (Biere, Vins, Cocktails, Jus, etc.) inherit
      the Bar printer when they don't have their own printer assigned

  2. Important Notes
    - Subcategories can still override by setting their own printer_id
    - The application routing code now supports parent inheritance
*/

UPDATE categories
SET printer_id = '1a460ae3-a495-4675-88d0-e419d7288cf4'
WHERE id = '9063af80-39ed-4dc8-98c7-a3df12ec533e'
  AND printer_id IS NULL;

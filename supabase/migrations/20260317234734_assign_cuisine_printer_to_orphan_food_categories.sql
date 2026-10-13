/*
  # Assign Cuisine printer to food categories missing a printer

  1. Changes
    - Sets `printer_id` on orphan top-level food categories to "Imprimante Cuisine"
    - Affected categories: Desserts, Entrees, Grillades, Plats Principaux, Poissons & Fruits de mer
    - These are all food categories that should print to the kitchen

  2. Important Notes
    - Only updates categories that currently have no printer assigned
    - Does not affect subcategories (they inherit from parent via app logic)
*/

UPDATE categories
SET printer_id = 'c1c43630-b988-4fef-a8a6-f2c41ecab52c'
WHERE id IN (
  '93caa43d-e2a9-4b45-9e45-b0fcfb42d73a',
  '78d790b1-c3a8-4d0e-a5af-520bdc42401c',
  'd15e7d6a-f121-4745-a7f0-8b381b14b6b7',
  '3867e04d-1d64-4e2a-a75b-d03178b06c94',
  '60504ac6-111a-41a7-a445-80eec1c2d108'
)
AND printer_id IS NULL;

/*
  # Ajout de site_id sur toutes les tables de données

  ## Résumé
  Toutes les tables métier reçoivent une colonne `site_id` référençant la table `sites`.
  C'est le pilier de l'isolation des données entre sites (et donc entre tenants).

  ## Tables modifiées (ajout de site_id)
  - categories, products, stock_movements
  - sales, sale_items, payments
  - restaurant_tables, orders, order_items
  - drivers, deliveries, driver_payments
  - ingredients, recipes, recipe_items, productions
  - warehouses, warehouse_stock, warehouse_transfers, warehouse_transfer_items
  - online_orders, cash_sessions, customers

  ## Sécurité
  - RLS existant conservé (policies anon restent en place)
  - Les queries applicatives filtrent toujours par site_id
  - Migration additive : IF NOT EXISTS partout

  ## Notes
  1. ON DELETE SET NULL plutôt que CASCADE pour éviter la perte de données historiques
  2. Indexes créés pour les performances des filtres par site
*/

-- Helper : ajoute site_id si absent
DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'categories','products','stock_movements',
    'sales','sale_items','payments',
    'restaurant_tables','orders','order_items',
    'drivers','deliveries','driver_payments',
    'ingredients','recipes','recipe_items','productions',
    'warehouses','warehouse_stock','warehouse_transfers','warehouse_transfer_items',
    'online_orders','cash_sessions','customers'
  ]
  LOOP
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = t AND table_schema = 'public') THEN
      IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = t AND column_name = 'site_id' AND table_schema = 'public'
      ) THEN
        EXECUTE format('ALTER TABLE %I ADD COLUMN site_id uuid REFERENCES sites(id) ON DELETE SET NULL', t);
        EXECUTE format('CREATE INDEX IF NOT EXISTS idx_%s_site_id ON %I(site_id)', t, t);
        RAISE NOTICE 'Added site_id to table: %', t;
      END IF;
    END IF;
  END LOOP;
END $$;

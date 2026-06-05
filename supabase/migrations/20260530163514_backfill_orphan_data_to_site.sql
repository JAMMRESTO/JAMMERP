/*
  # Rattachement des données orphelines au site FIESTA

  ## Résumé
  Toutes les lignes créées avant la mise en place du multi-tenant ont un site_id NULL.
  Cette migration les rattache au seul site existant : FIESTA (slug: principal).

  ## Tables concernées
  - products        : 16 lignes
  - categories      : 8 lignes
  - orders          : 1 ligne
  - customers       : 3 lignes
  - cash_sessions   : 5 lignes

  ## Note
  On sélectionne dynamiquement l'id du site 'principal' pour éviter tout hardcode.
*/

DO $$
DECLARE
  v_site_id uuid;
BEGIN
  SELECT id INTO v_site_id FROM sites WHERE slug = 'principal' LIMIT 1;

  IF v_site_id IS NULL THEN
    RAISE EXCEPTION 'Site principal introuvable';
  END IF;

  UPDATE products     SET site_id = v_site_id WHERE site_id IS NULL;
  UPDATE categories   SET site_id = v_site_id WHERE site_id IS NULL;
  UPDATE orders       SET site_id = v_site_id WHERE site_id IS NULL;
  UPDATE customers    SET site_id = v_site_id WHERE site_id IS NULL;
  UPDATE cash_sessions SET site_id = v_site_id WHERE site_id IS NULL;
END $$;

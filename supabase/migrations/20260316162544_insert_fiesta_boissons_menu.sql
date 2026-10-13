/*
  # Insert Fiesta Boissons Menu

  ## Summary
  Inserts the complete Fiesta drinks menu.

  ## Structure
  One top-level parent category: BOISSONS (ordre 12, after existing categories)
  Subcategories:
    - Cocktails Sans Alcool
    - Cocktails Avec Alcool
    - Liqueurs > GIN, WHISKY, RHUM, TEQUILA, PASTIS 61, PORTO, VODKA
    - Bière
    - Vins
    - Soft (boissons)
    - Jus
    - Jus Locaux
    - Jus Naturels
    - Boissons Chaudes (extended version from boisson menu)
    - Supplément

  ## Notes
  - Boissons Chaudes already exists in Petit Dejeuner subcategory.
    Here we add the extended boisson version as a subcategory of BOISSONS.
  - Coco PM/GM has two sizes: base 1000, Grande +1000
  - Vin Bouteille is a separate product at 12000
*/

DO $$
DECLARE
  rid uuid := '00000000-0000-0000-0000-000000000001'::uuid;

  cat_boissons uuid;

  sub_cocktails_sans uuid;
  sub_cocktails_avec uuid;
  sub_liqueurs uuid;
  sub_gin uuid;
  sub_whisky uuid;
  sub_rhum uuid;
  sub_tequila uuid;
  sub_pastis uuid;
  sub_porto uuid;
  sub_vodka uuid;
  sub_supplement uuid;
  sub_biere uuid;
  sub_vins uuid;
  sub_soft_boisson uuid;
  sub_jus uuid;
  sub_jus_locaux uuid;
  sub_jus_naturels uuid;
  sub_boissons_chaudes uuid;

  p_id uuid;
  vg_id uuid;

BEGIN

  -- ===================== PARENT CATEGORY =====================

  INSERT INTO categories (nom, ordre, actif, restaurant_id)
    VALUES ('Boissons', 12, true, rid)
    RETURNING id INTO cat_boissons;

  -- ===================== SUBCATEGORIES =====================

  INSERT INTO categories (nom, ordre, actif, restaurant_id, parent_id) VALUES ('Cocktails Sans Alcool', 1, true, rid, cat_boissons) RETURNING id INTO sub_cocktails_sans;
  INSERT INTO categories (nom, ordre, actif, restaurant_id, parent_id) VALUES ('Cocktails Avec Alcool', 2, true, rid, cat_boissons) RETURNING id INTO sub_cocktails_avec;
  INSERT INTO categories (nom, ordre, actif, restaurant_id, parent_id) VALUES ('Liqueurs', 3, true, rid, cat_boissons) RETURNING id INTO sub_liqueurs;
  INSERT INTO categories (nom, ordre, actif, restaurant_id, parent_id) VALUES ('Bière', 4, true, rid, cat_boissons) RETURNING id INTO sub_biere;
  INSERT INTO categories (nom, ordre, actif, restaurant_id, parent_id) VALUES ('Vins', 5, true, rid, cat_boissons) RETURNING id INTO sub_vins;
  INSERT INTO categories (nom, ordre, actif, restaurant_id, parent_id) VALUES ('Soft', 6, true, rid, cat_boissons) RETURNING id INTO sub_soft_boisson;
  INSERT INTO categories (nom, ordre, actif, restaurant_id, parent_id) VALUES ('Jus', 7, true, rid, cat_boissons) RETURNING id INTO sub_jus;
  INSERT INTO categories (nom, ordre, actif, restaurant_id, parent_id) VALUES ('Jus Locaux', 8, true, rid, cat_boissons) RETURNING id INTO sub_jus_locaux;
  INSERT INTO categories (nom, ordre, actif, restaurant_id, parent_id) VALUES ('Jus Naturels', 9, true, rid, cat_boissons) RETURNING id INTO sub_jus_naturels;
  INSERT INTO categories (nom, ordre, actif, restaurant_id, parent_id) VALUES ('Boissons Chaudes', 10, true, rid, cat_boissons) RETURNING id INTO sub_boissons_chaudes;
  INSERT INTO categories (nom, ordre, actif, restaurant_id, parent_id) VALUES ('Supplément', 11, true, rid, cat_boissons) RETURNING id INTO sub_supplement;

  -- Liqueurs sub-subcategories
  INSERT INTO categories (nom, ordre, actif, restaurant_id, parent_id) VALUES ('Gin', 1, true, rid, sub_liqueurs) RETURNING id INTO sub_gin;
  INSERT INTO categories (nom, ordre, actif, restaurant_id, parent_id) VALUES ('Whisky', 2, true, rid, sub_liqueurs) RETURNING id INTO sub_whisky;
  INSERT INTO categories (nom, ordre, actif, restaurant_id, parent_id) VALUES ('Rhum', 3, true, rid, sub_liqueurs) RETURNING id INTO sub_rhum;
  INSERT INTO categories (nom, ordre, actif, restaurant_id, parent_id) VALUES ('Tequila', 4, true, rid, sub_liqueurs) RETURNING id INTO sub_tequila;
  INSERT INTO categories (nom, ordre, actif, restaurant_id, parent_id) VALUES ('Pastis 61', 5, true, rid, sub_liqueurs) RETURNING id INTO sub_pastis;
  INSERT INTO categories (nom, ordre, actif, restaurant_id, parent_id) VALUES ('Porto & Apéritifs', 6, true, rid, sub_liqueurs) RETURNING id INTO sub_porto;
  INSERT INTO categories (nom, ordre, actif, restaurant_id, parent_id) VALUES ('Vodka', 7, true, rid, sub_liqueurs) RETURNING id INTO sub_vodka;

  -- ===================== COCKTAILS SANS ALCOOL =====================

  INSERT INTO products (category_id, nom, prix, actif, restaurant_id) VALUES
    (sub_cocktails_sans, 'Fiesta', 5000, true, rid),
    (sub_cocktails_sans, 'Virgin Mojito', 5000, true, rid),
    (sub_cocktails_sans, 'Virgin Colada', 5000, true, rid),
    (sub_cocktails_sans, 'Lac Rose', 5000, true, rid),
    (sub_cocktails_sans, 'Passionata', 5000, true, rid),
    (sub_cocktails_sans, 'Belier', 5000, true, rid),
    (sub_cocktails_sans, 'Fly', 5000, true, rid),
    (sub_cocktails_sans, 'Honey Moon', 5000, true, rid),
    (sub_cocktails_sans, 'Limonade', 5000, true, rid),
    (sub_cocktails_sans, 'Florida', 5000, true, rid),
    (sub_cocktails_sans, 'Fiesta Smoothie', 5000, true, rid),
    (sub_cocktails_sans, 'Smoothie', 5000, true, rid);

  -- ===================== COCKTAILS AVEC ALCOOL =====================

  INSERT INTO products (category_id, nom, prix, actif, restaurant_id) VALUES
    (sub_cocktails_avec, 'Mojito', 6000, true, rid),
    (sub_cocktails_avec, 'Tequila Sunrise', 6000, true, rid),
    (sub_cocktails_avec, 'T-Punch', 6000, true, rid),
    (sub_cocktails_avec, 'T-Punch Ginger', 6000, true, rid),
    (sub_cocktails_avec, 'Caipirinha', 6000, true, rid),
    (sub_cocktails_avec, 'Aperol Spiritz', 6000, true, rid),
    (sub_cocktails_avec, 'Gin Fizz', 6000, true, rid),
    (sub_cocktails_avec, 'Margarita', 6000, true, rid),
    (sub_cocktails_avec, 'Cuba Libre', 6000, true, rid),
    (sub_cocktails_avec, 'Long Island', 6000, true, rid),
    (sub_cocktails_avec, 'Blue Hawaienne', 6000, true, rid);

  -- ===================== GIN =====================

  INSERT INTO products (category_id, nom, prix, actif, restaurant_id) VALUES
    (sub_gin, 'Gordons', 4000, true, rid),
    (sub_gin, 'Bombay', 4000, true, rid),
    (sub_gin, 'Tanqueray', 4000, true, rid),
    (sub_gin, 'Larios', 4000, true, rid),
    (sub_gin, 'Malibu', 4000, true, rid);

  -- ===================== WHISKY =====================

  INSERT INTO products (category_id, nom, prix, actif, restaurant_id) VALUES
    (sub_whisky, 'Glenfiddich', 5000, true, rid),
    (sub_whisky, 'Ballantines', 5000, true, rid),
    (sub_whisky, 'J-B', 5000, true, rid),
    (sub_whisky, 'Grant''s', 5000, true, rid),
    (sub_whisky, 'Red Label', 5000, true, rid),
    (sub_whisky, 'Black Label', 5000, true, rid),
    (sub_whisky, 'Jack Daniel', 5000, true, rid),
    (sub_whisky, 'Gentleman', 5000, true, rid),
    (sub_whisky, 'Chivas 12ans', 5000, true, rid),
    (sub_whisky, 'Chivas 18ans', 5000, true, rid),
    (sub_whisky, 'Double Jack', 5000, true, rid),
    (sub_whisky, 'Clan Campbell', 5000, true, rid),
    (sub_whisky, 'Hennessy', 5000, true, rid);

  -- ===================== RHUM =====================

  INSERT INTO products (category_id, nom, prix, actif, restaurant_id) VALUES
    (sub_rhum, 'Saint James Brun', 4000, true, rid),
    (sub_rhum, 'Saint James Blanc', 4000, true, rid);

  -- ===================== TEQUILA =====================

  INSERT INTO products (category_id, nom, prix, actif, restaurant_id) VALUES
    (sub_tequila, 'Tequila', 3000, true, rid);

  -- ===================== PASTIS 61 =====================

  INSERT INTO products (category_id, nom, prix, actif, restaurant_id) VALUES
    (sub_pastis, 'Ricard', 3000, true, rid),
    (sub_pastis, 'Pastis', 3000, true, rid);

  -- ===================== PORTO & APÉRITIFS =====================

  INSERT INTO products (category_id, nom, prix, actif, restaurant_id) VALUES
    (sub_porto, 'Porto Rouge', 4000, true, rid),
    (sub_porto, 'Porto Blanc', 4000, true, rid),
    (sub_porto, 'Campari', 4000, true, rid),
    (sub_porto, 'Martini Blanc', 4000, true, rid),
    (sub_porto, 'Aperol', 4000, true, rid),
    (sub_porto, 'Baileys', 4000, true, rid);

  -- ===================== VODKA =====================

  INSERT INTO products (category_id, nom, prix, actif, restaurant_id) VALUES
    (sub_vodka, 'Absolut', 4000, true, rid),
    (sub_vodka, 'Sky Vodka', 4000, true, rid);

  -- ===================== BIÈRE =====================

  INSERT INTO products (category_id, nom, prix, actif, restaurant_id) VALUES
    (sub_biere, 'Heineken', 2500, true, rid),
    (sub_biere, 'Desperados', 2500, true, rid),
    (sub_biere, 'Flag', 2000, true, rid),
    (sub_biere, 'Gazelle', 2000, true, rid),
    (sub_biere, '33 Sport', 2000, true, rid),
    (sub_biere, 'Guinness', 2000, true, rid);

  -- ===================== VINS =====================

  INSERT INTO products (category_id, nom, prix, actif, restaurant_id) VALUES
    (sub_vins, 'Rouge', 3000, true, rid),
    (sub_vins, 'Blanc', 3000, true, rid),
    (sub_vins, 'Rosé', 3000, true, rid),
    (sub_vins, 'Bouteille', 12000, true, rid);

  -- ===================== SOFT (boissons) =====================

  -- Coco with PM/GM variant
  INSERT INTO products (category_id, nom, prix, actif, restaurant_id)
    VALUES (sub_soft_boisson, 'Coco', 1000, true, rid)
    RETURNING id INTO p_id;
  INSERT INTO product_variant_groups (product_id, nom, required, ordre) VALUES (p_id, 'Taille', true, 1) RETURNING id INTO vg_id;
  INSERT INTO product_variants (group_id, nom, prix_delta, default_selected, actif) VALUES (vg_id, 'PM', 0, true, true), (vg_id, 'GM', 1000, false, true);

  INSERT INTO products (category_id, nom, prix, actif, restaurant_id) VALUES
    (sub_soft_boisson, 'Coca Cola', 1000, true, rid),
    (sub_soft_boisson, 'Sprite', 1000, true, rid),
    (sub_soft_boisson, 'Fanta', 1000, true, rid),
    (sub_soft_boisson, 'Tonic', 1000, true, rid),
    (sub_soft_boisson, 'Vimto', 1000, true, rid),
    (sub_soft_boisson, 'Gazelle Ananas', 1000, true, rid),
    (sub_soft_boisson, 'Soda', 1000, true, rid),
    (sub_soft_boisson, 'Soda Orange', 1600, true, rid),
    (sub_soft_boisson, 'Pepsi', 1000, true, rid),
    (sub_soft_boisson, 'Ceres', 2000, true, rid),
    (sub_soft_boisson, 'RedBull', 2000, true, rid),
    (sub_soft_boisson, 'Diabolo menthe / grenadine', 1500, true, rid),
    (sub_soft_boisson, 'Eau', 600, true, rid);

  -- ===================== JUS =====================

  INSERT INTO products (category_id, nom, prix, actif, restaurant_id) VALUES
    (sub_jus, 'Ananas', 1000, true, rid),
    (sub_jus, 'Goyave', 1000, true, rid),
    (sub_jus, 'Pomme', 1000, true, rid),
    (sub_jus, 'Orange', 1000, true, rid),
    (sub_jus, 'Mangue', 1000, true, rid);

  -- ===================== JUS LOCAUX =====================

  INSERT INTO products (category_id, nom, prix, actif, restaurant_id) VALUES
    (sub_jus_locaux, 'Bissap Rouge', 1500, true, rid),
    (sub_jus_locaux, 'Bissap Blanc', 1500, true, rid),
    (sub_jus_locaux, 'Bouye', 1500, true, rid),
    (sub_jus_locaux, 'Gingembre', 1500, true, rid),
    (sub_jus_locaux, 'Mixte', 2000, true, rid);

  -- ===================== JUS NATURELS =====================

  INSERT INTO products (category_id, nom, prix, actif, restaurant_id) VALUES
    (sub_jus_naturels, 'Orange pressée', 2000, true, rid),
    (sub_jus_naturels, 'Citron pressé', 2000, true, rid),
    (sub_jus_naturels, 'Pamplemousse pressée', 2000, true, rid),
    (sub_jus_naturels, 'Mixte', 2600, true, rid);

  -- ===================== BOISSONS CHAUDES (extended) =====================

  INSERT INTO products (category_id, nom, prix, actif, restaurant_id) VALUES
    (sub_boissons_chaudes, 'Expresso', 1500, true, rid),
    (sub_boissons_chaudes, 'Crème', 2000, true, rid),
    (sub_boissons_chaudes, 'Ginger', 2000, true, rid),
    (sub_boissons_chaudes, 'Cappuccino', 2000, true, rid),
    (sub_boissons_chaudes, 'Café au lait', 2500, true, rid),
    (sub_boissons_chaudes, 'Thé infusion', 1500, true, rid),
    (sub_boissons_chaudes, 'Thé au lait', 2000, true, rid),
    (sub_boissons_chaudes, 'Chocolat chaud', 2000, true, rid),
    (sub_boissons_chaudes, 'Lait chaud', 1500, true, rid),
    (sub_boissons_chaudes, 'Lait froid', 1500, true, rid),
    (sub_boissons_chaudes, 'Grogue sans alcool', 3500, true, rid),
    (sub_boissons_chaudes, 'Grogue avec alcool', 5000, true, rid);

  -- ===================== SUPPLÉMENT =====================

  INSERT INTO products (category_id, nom, prix, actif, restaurant_id) VALUES
    (sub_supplement, 'Boisson 1', 1000, true, rid),
    (sub_supplement, 'Boisson 2', 2000, true, rid),
    (sub_supplement, 'Boisson 3', 3000, true, rid),
    (sub_supplement, 'Boisson 4', 4000, true, rid);

END $$;

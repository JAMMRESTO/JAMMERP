/*
  # Insert Fiesta Menu - Categories, Subcategories & Products

  ## Summary
  Inserts the complete Fiesta restaurant menu extracted from the PDF.

  ## Structure
  Two top-level parent categories:
    - PETIT DEJEUNER (with subcategories: Viennoiserie, Boissons Chaudes, Nos Omelettes)
    - SOFT (with subcategories: Nos Salades)
    - NOS ENTREES
    - NOS SOUPES
    - NOS PIZZAS
    - CHAWARMAS
    - HAMBURGERS
    - SANDWICHS
    - TACOS
    - ASSIETTES > NOS PATTES, NOS PLATS, POISSONS, VOLAILLES, VIANDE, DIBI, BROCHETTES, NOS BLANQUETTES
    - DESSERTS (with subcategories: Crêpes Sucrées, Gaufres Sucrées, Crêpes Salées, Gaufres Salées)

  ## Notes
  - restaurant_id defaults to 00000000-0000-0000-0000-000000000001
  - For pizzas with two sizes, we use the smaller price as base and create a variant group for taille
  - All prices in FCFA (integer)
*/

DO $$
DECLARE
  rid uuid := '00000000-0000-0000-0000-000000000001'::uuid;

  -- Parent category IDs
  cat_pdej uuid;
  cat_soft uuid;
  cat_entrees uuid;
  cat_soupes uuid;
  cat_pizzas uuid;
  cat_chawarmas uuid;
  cat_hamburgers uuid;
  cat_sandwichs uuid;
  cat_tacos uuid;
  cat_assiettes uuid;
  cat_desserts uuid;

  -- Subcategory IDs
  sub_viennoiserie uuid;
  sub_boissons_chaudes uuid;
  sub_omelettes uuid;
  sub_salades uuid;
  sub_pattes uuid;
  sub_plats uuid;
  sub_poissons uuid;
  sub_volailles uuid;
  sub_viande uuid;
  sub_dibi uuid;
  sub_brochettes uuid;
  sub_blanquettes uuid;
  sub_crepes_sucrees uuid;
  sub_gaufres_sucrees uuid;
  sub_crepes_salees uuid;
  sub_gaufres_salees uuid;

  -- Product IDs for variant groups
  p_id uuid;
  vg_id uuid;

BEGIN

  -- ===================== PARENT CATEGORIES =====================

  INSERT INTO categories (nom, ordre, actif, restaurant_id) VALUES ('Petit Dejeuner', 1, true, rid) RETURNING id INTO cat_pdej;
  INSERT INTO categories (nom, ordre, actif, restaurant_id) VALUES ('Soft', 2, true, rid) RETURNING id INTO cat_soft;
  INSERT INTO categories (nom, ordre, actif, restaurant_id) VALUES ('Nos Entrées', 3, true, rid) RETURNING id INTO cat_entrees;
  INSERT INTO categories (nom, ordre, actif, restaurant_id) VALUES ('Nos Soupes', 4, true, rid) RETURNING id INTO cat_soupes;
  INSERT INTO categories (nom, ordre, actif, restaurant_id) VALUES ('Nos Pizzas', 5, true, rid) RETURNING id INTO cat_pizzas;
  INSERT INTO categories (nom, ordre, actif, restaurant_id) VALUES ('Chawarmas', 6, true, rid) RETURNING id INTO cat_chawarmas;
  INSERT INTO categories (nom, ordre, actif, restaurant_id) VALUES ('Hamburgers', 7, true, rid) RETURNING id INTO cat_hamburgers;
  INSERT INTO categories (nom, ordre, actif, restaurant_id) VALUES ('Sandwichs', 8, true, rid) RETURNING id INTO cat_sandwichs;
  INSERT INTO categories (nom, ordre, actif, restaurant_id) VALUES ('Tacos', 9, true, rid) RETURNING id INTO cat_tacos;
  INSERT INTO categories (nom, ordre, actif, restaurant_id) VALUES ('Assiettes', 10, true, rid) RETURNING id INTO cat_assiettes;
  INSERT INTO categories (nom, ordre, actif, restaurant_id) VALUES ('Desserts', 11, true, rid) RETURNING id INTO cat_desserts;

  -- ===================== SUBCATEGORIES =====================

  -- Petit Dejeuner subcategories
  INSERT INTO categories (nom, ordre, actif, restaurant_id, parent_id) VALUES ('Viennoiserie', 1, true, rid, cat_pdej) RETURNING id INTO sub_viennoiserie;
  INSERT INTO categories (nom, ordre, actif, restaurant_id, parent_id) VALUES ('Boissons Chaudes', 2, true, rid, cat_pdej) RETURNING id INTO sub_boissons_chaudes;
  INSERT INTO categories (nom, ordre, actif, restaurant_id, parent_id) VALUES ('Nos Omelettes', 3, true, rid, cat_pdej) RETURNING id INTO sub_omelettes;

  -- Soft subcategories
  INSERT INTO categories (nom, ordre, actif, restaurant_id, parent_id) VALUES ('Nos Salades', 1, true, rid, cat_soft) RETURNING id INTO sub_salades;

  -- Assiettes subcategories
  INSERT INTO categories (nom, ordre, actif, restaurant_id, parent_id) VALUES ('Nos Pâtes', 1, true, rid, cat_assiettes) RETURNING id INTO sub_pattes;
  INSERT INTO categories (nom, ordre, actif, restaurant_id, parent_id) VALUES ('Nos Plats', 2, true, rid, cat_assiettes) RETURNING id INTO sub_plats;
  INSERT INTO categories (nom, ordre, actif, restaurant_id, parent_id) VALUES ('Poissons', 3, true, rid, cat_assiettes) RETURNING id INTO sub_poissons;
  INSERT INTO categories (nom, ordre, actif, restaurant_id, parent_id) VALUES ('Volailles', 4, true, rid, cat_assiettes) RETURNING id INTO sub_volailles;
  INSERT INTO categories (nom, ordre, actif, restaurant_id, parent_id) VALUES ('Viande', 5, true, rid, cat_assiettes) RETURNING id INTO sub_viande;
  INSERT INTO categories (nom, ordre, actif, restaurant_id, parent_id) VALUES ('Dibi', 6, true, rid, cat_assiettes) RETURNING id INTO sub_dibi;
  INSERT INTO categories (nom, ordre, actif, restaurant_id, parent_id) VALUES ('Brochettes', 7, true, rid, cat_assiettes) RETURNING id INTO sub_brochettes;
  INSERT INTO categories (nom, ordre, actif, restaurant_id, parent_id) VALUES ('Nos Blanquettes', 8, true, rid, cat_assiettes) RETURNING id INTO sub_blanquettes;

  -- Desserts subcategories
  INSERT INTO categories (nom, ordre, actif, restaurant_id, parent_id) VALUES ('Crêpes Sucrées', 1, true, rid, cat_desserts) RETURNING id INTO sub_crepes_sucrees;
  INSERT INTO categories (nom, ordre, actif, restaurant_id, parent_id) VALUES ('Gaufres Sucrées', 2, true, rid, cat_desserts) RETURNING id INTO sub_gaufres_sucrees;
  INSERT INTO categories (nom, ordre, actif, restaurant_id, parent_id) VALUES ('Crêpes Salées', 3, true, rid, cat_desserts) RETURNING id INTO sub_crepes_salees;
  INSERT INTO categories (nom, ordre, actif, restaurant_id, parent_id) VALUES ('Gaufres Salées', 4, true, rid, cat_desserts) RETURNING id INTO sub_gaufres_salees;

  -- ===================== PRODUCTS: VIENNOISERIE =====================

  INSERT INTO products (category_id, nom, prix, actif, restaurant_id) VALUES
    (sub_viennoiserie, 'Croissants', 800, true, rid),
    (sub_viennoiserie, 'Pain aux raisins', 800, true, rid),
    (sub_viennoiserie, 'Pain au chocolat', 800, true, rid),
    (sub_viennoiserie, 'Tartine', 800, true, rid),
    (sub_viennoiserie, 'Ricole aux crevettes', 2000, true, rid),
    (sub_viennoiserie, 'Nems', 3000, true, rid),
    (sub_viennoiserie, 'Quiche', 3000, true, rid);

  -- ===================== PRODUCTS: BOISSONS CHAUDES =====================

  INSERT INTO products (category_id, nom, prix, actif, restaurant_id) VALUES
    (sub_boissons_chaudes, 'Expresso', 1500, true, rid),
    (sub_boissons_chaudes, 'Crème', 2000, true, rid),
    (sub_boissons_chaudes, 'Ginger', 2000, true, rid),
    (sub_boissons_chaudes, 'Cappuccino', 2500, true, rid),
    (sub_boissons_chaudes, 'Café au lait', 2500, true, rid),
    (sub_boissons_chaudes, 'Thé infusion', 1500, true, rid),
    (sub_boissons_chaudes, 'Thé au lait', 2000, true, rid),
    (sub_boissons_chaudes, 'Chocolat chaud', 2000, true, rid),
    (sub_boissons_chaudes, 'Lait chaud', 1500, true, rid),
    (sub_boissons_chaudes, 'Lait froid', 1500, true, rid);

  -- ===================== PRODUCTS: OMELETTES =====================

  INSERT INTO products (category_id, nom, prix, actif, restaurant_id) VALUES
    (sub_omelettes, 'Nature', 2500, true, rid),
    (sub_omelettes, 'Espagnole', 3000, true, rid),
    (sub_omelettes, 'Fromage', 3000, true, rid),
    (sub_omelettes, 'Jambon-fromage', 4000, true, rid),
    (sub_omelettes, 'Jambon', 3000, true, rid),
    (sub_omelettes, 'Sur le plat', 2500, true, rid),
    (sub_omelettes, 'Baveuse aux crevettes', 4000, true, rid),
    (sub_omelettes, 'Soufflée', 3000, true, rid),
    (sub_omelettes, 'Oeuf brouillé à la crème', 4000, true, rid);

  -- ===================== PRODUCTS: SALADES =====================

  INSERT INTO products (category_id, nom, prix, actif, restaurant_id) VALUES
    (sub_salades, 'Salade composée', 4000, true, rid),
    (sub_salades, 'Salade niçoise', 4000, true, rid),
    (sub_salades, 'Salade du chef', 4000, true, rid),
    (sub_salades, 'Bol de salade', 3000, true, rid),
    (sub_salades, 'Salade russe', 4000, true, rid),
    (sub_salades, 'Salade de fruits de mer', 7000, true, rid),
    (sub_salades, 'Salade César', 6000, true, rid),
    (sub_salades, 'Salade exotic', 5000, true, rid),
    (sub_salades, 'Salade saumon', 5000, true, rid),
    (sub_salades, 'Velouté de carotte', 3000, true, rid),
    (sub_salades, 'Salade Feta', 4000, true, rid),
    (sub_salades, 'Gambas tempura', 6000, true, rid);

  -- ===================== PRODUCTS: ENTREES =====================

  INSERT INTO products (category_id, nom, prix, actif, restaurant_id) VALUES
    (cat_entrees, 'Carpaccio de Bœuf au parmesan', 7000, true, rid),
    (cat_entrees, 'Ceviche de lotte', 6000, true, rid),
    (cat_entrees, 'Tartare au saumon d''avocat', 9000, true, rid);

  -- ===================== PRODUCTS: SOUPES =====================

  INSERT INTO products (category_id, nom, prix, actif, restaurant_id) VALUES
    (cat_soupes, 'Soupe viande', 4000, true, rid),
    (cat_soupes, 'Soupe de poulet', 5000, true, rid),
    (cat_soupes, 'Soupe aux fruits de mer', 6000, true, rid),
    (cat_soupes, 'Soupe de poisson', 6000, true, rid);

  -- ===================== PRODUCTS: PIZZAS (with taille variants) =====================
  -- For pizzas with 5000/6000: base=5000, Grande=+1000
  -- For pizzas with 6000/8000: base=6000, Grande=+2000
  -- For pizzas with 5000/7000: base=5000, Grande=+2000

  -- REINE 5000/6000
  INSERT INTO products (category_id, nom, prix, actif, restaurant_id) VALUES (cat_pizzas, 'Reine', 5000, true, rid) RETURNING id INTO p_id;
  INSERT INTO product_variant_groups (product_id, nom, required, ordre) VALUES (p_id, 'Taille', true, 1) RETURNING id INTO vg_id;
  INSERT INTO product_variants (group_id, nom, prix_delta, default_selected, actif) VALUES (vg_id, 'Petite', 0, true, true), (vg_id, 'Grande', 1000, false, true);

  -- ORIENTALE 5000/6000
  INSERT INTO products (category_id, nom, prix, actif, restaurant_id) VALUES (cat_pizzas, 'Orientale', 5000, true, rid) RETURNING id INTO p_id;
  INSERT INTO product_variant_groups (product_id, nom, required, ordre) VALUES (p_id, 'Taille', true, 1) RETURNING id INTO vg_id;
  INSERT INTO product_variants (group_id, nom, prix_delta, default_selected, actif) VALUES (vg_id, 'Petite', 0, true, true), (vg_id, 'Grande', 1000, false, true);

  -- VÉGÉTARIENNE 5000/6000
  INSERT INTO products (category_id, nom, prix, actif, restaurant_id) VALUES (cat_pizzas, 'Végétarienne', 5000, true, rid) RETURNING id INTO p_id;
  INSERT INTO product_variant_groups (product_id, nom, required, ordre) VALUES (p_id, 'Taille', true, 1) RETURNING id INTO vg_id;
  INSERT INTO product_variants (group_id, nom, prix_delta, default_selected, actif) VALUES (vg_id, 'Petite', 0, true, true), (vg_id, 'Grande', 1000, false, true);

  -- FERMIÈRE 5000/6000
  INSERT INTO products (category_id, nom, prix, actif, restaurant_id) VALUES (cat_pizzas, 'Fermière', 5000, true, rid) RETURNING id INTO p_id;
  INSERT INTO product_variant_groups (product_id, nom, required, ordre) VALUES (p_id, 'Taille', true, 1) RETURNING id INTO vg_id;
  INSERT INTO product_variants (group_id, nom, prix_delta, default_selected, actif) VALUES (vg_id, 'Petite', 0, true, true), (vg_id, 'Grande', 1000, false, true);

  -- TROIS FROMAGE 5000/6000
  INSERT INTO products (category_id, nom, prix, actif, restaurant_id) VALUES (cat_pizzas, 'Trois Fromage', 5000, true, rid) RETURNING id INTO p_id;
  INSERT INTO product_variant_groups (product_id, nom, required, ordre) VALUES (p_id, 'Taille', true, 1) RETURNING id INTO vg_id;
  INSERT INTO product_variants (group_id, nom, prix_delta, default_selected, actif) VALUES (vg_id, 'Petite', 0, true, true), (vg_id, 'Grande', 1000, false, true);

  -- FRUITS DE MER 6000/8000
  INSERT INTO products (category_id, nom, prix, actif, restaurant_id) VALUES (cat_pizzas, 'Fruits de Mer', 6000, true, rid) RETURNING id INTO p_id;
  INSERT INTO product_variant_groups (product_id, nom, required, ordre) VALUES (p_id, 'Taille', true, 1) RETURNING id INTO vg_id;
  INSERT INTO product_variants (group_id, nom, prix_delta, default_selected, actif) VALUES (vg_id, 'Petite', 0, true, true), (vg_id, 'Grande', 2000, false, true);

  -- CALZONE 5000/6000
  INSERT INTO products (category_id, nom, prix, actif, restaurant_id) VALUES (cat_pizzas, 'Calzone', 5000, true, rid) RETURNING id INTO p_id;
  INSERT INTO product_variant_groups (product_id, nom, required, ordre) VALUES (p_id, 'Taille', true, 1) RETURNING id INTO vg_id;
  INSERT INTO product_variants (group_id, nom, prix_delta, default_selected, actif) VALUES (vg_id, 'Petite', 0, true, true), (vg_id, 'Grande', 1000, false, true);

  -- BOLOGNAISE 5000/6000
  INSERT INTO products (category_id, nom, prix, actif, restaurant_id) VALUES (cat_pizzas, 'Bolognaise', 5000, true, rid) RETURNING id INTO p_id;
  INSERT INTO product_variant_groups (product_id, nom, required, ordre) VALUES (p_id, 'Taille', true, 1) RETURNING id INTO vg_id;
  INSERT INTO product_variants (group_id, nom, prix_delta, default_selected, actif) VALUES (vg_id, 'Petite', 0, true, true), (vg_id, 'Grande', 1000, false, true);

  -- CHAWARMA PIZZA 5000/6000
  INSERT INTO products (category_id, nom, prix, actif, restaurant_id) VALUES (cat_pizzas, 'Chawarma', 5000, true, rid) RETURNING id INTO p_id;
  INSERT INTO product_variant_groups (product_id, nom, required, ordre) VALUES (p_id, 'Taille', true, 1) RETURNING id INTO vg_id;
  INSERT INTO product_variants (group_id, nom, prix_delta, default_selected, actif) VALUES (vg_id, 'Petite', 0, true, true), (vg_id, 'Grande', 1000, false, true);

  -- FIESTA PIZZA 5000/6000
  INSERT INTO products (category_id, nom, prix, actif, restaurant_id) VALUES (cat_pizzas, 'Fiesta', 5000, true, rid) RETURNING id INTO p_id;
  INSERT INTO product_variant_groups (product_id, nom, required, ordre) VALUES (p_id, 'Taille', true, 1) RETURNING id INTO vg_id;
  INSERT INTO product_variants (group_id, nom, prix_delta, default_selected, actif) VALUES (vg_id, 'Petite', 0, true, true), (vg_id, 'Grande', 1000, false, true);

  -- THE BOSS 5000/7000
  INSERT INTO products (category_id, nom, prix, actif, restaurant_id) VALUES (cat_pizzas, 'The Boss', 5000, true, rid) RETURNING id INTO p_id;
  INSERT INTO product_variant_groups (product_id, nom, required, ordre) VALUES (p_id, 'Taille', true, 1) RETURNING id INTO vg_id;
  INSERT INTO product_variants (group_id, nom, prix_delta, default_selected, actif) VALUES (vg_id, 'Petite', 0, true, true), (vg_id, 'Grande', 2000, false, true);

  -- ELIA 5000/7000
  INSERT INTO products (category_id, nom, prix, actif, restaurant_id) VALUES (cat_pizzas, 'Elia', 5000, true, rid) RETURNING id INTO p_id;
  INSERT INTO product_variant_groups (product_id, nom, required, ordre) VALUES (p_id, 'Taille', true, 1) RETURNING id INTO vg_id;
  INSERT INTO product_variants (group_id, nom, prix_delta, default_selected, actif) VALUES (vg_id, 'Petite', 0, true, true), (vg_id, 'Grande', 2000, false, true);

  -- INDIENNE 5000/6000
  INSERT INTO products (category_id, nom, prix, actif, restaurant_id) VALUES (cat_pizzas, 'Indienne', 5000, true, rid) RETURNING id INTO p_id;
  INSERT INTO product_variant_groups (product_id, nom, required, ordre) VALUES (p_id, 'Taille', true, 1) RETURNING id INTO vg_id;
  INSERT INTO product_variants (group_id, nom, prix_delta, default_selected, actif) VALUES (vg_id, 'Petite', 0, true, true), (vg_id, 'Grande', 1000, false, true);

  -- GÉNÉRALE 6000/8000
  INSERT INTO products (category_id, nom, prix, actif, restaurant_id) VALUES (cat_pizzas, 'Générale', 6000, true, rid) RETURNING id INTO p_id;
  INSERT INTO product_variant_groups (product_id, nom, required, ordre) VALUES (p_id, 'Taille', true, 1) RETURNING id INTO vg_id;
  INSERT INTO product_variants (group_id, nom, prix_delta, default_selected, actif) VALUES (vg_id, 'Petite', 0, true, true), (vg_id, 'Grande', 2000, false, true);

  -- AFRICAINE 6000/7000
  INSERT INTO products (category_id, nom, prix, actif, restaurant_id) VALUES (cat_pizzas, 'Africaine', 6000, true, rid) RETURNING id INTO p_id;
  INSERT INTO product_variant_groups (product_id, nom, required, ordre) VALUES (p_id, 'Taille', true, 1) RETURNING id INTO vg_id;
  INSERT INTO product_variants (group_id, nom, prix_delta, default_selected, actif) VALUES (vg_id, 'Petite', 0, true, true), (vg_id, 'Grande', 1000, false, true);

  -- MIXTE MER (prix fixe)
  INSERT INTO products (category_id, nom, prix, actif, restaurant_id) VALUES (cat_pizzas, 'Mixte Mer', 8500, true, rid);

  -- ===================== PRODUCTS: CHAWARMAS =====================

  INSERT INTO products (category_id, nom, prix, actif, restaurant_id) VALUES
    (cat_chawarmas, 'Simple', 2500, true, rid),
    (cat_chawarmas, 'Royal', 3000, true, rid),
    (cat_chawarmas, 'Poulet', 2500, true, rid),
    (cat_chawarmas, 'Poulet Royal', 3000, true, rid),
    (cat_chawarmas, 'Assiette de chawarma', 5000, true, rid);

  -- ===================== PRODUCTS: HAMBURGERS =====================

  INSERT INTO products (category_id, nom, prix, actif, restaurant_id) VALUES
    (cat_hamburgers, 'Simple', 2500, true, rid),
    (cat_hamburgers, 'Royal', 3000, true, rid),
    (cat_hamburgers, 'Double', 3500, true, rid),
    (cat_hamburgers, 'Chicken Burger', 2500, true, rid),
    (cat_hamburgers, 'Double chicken', 3500, true, rid),
    (cat_hamburgers, 'Assiette Hamburger', 5000, true, rid);

  -- ===================== PRODUCTS: SANDWICHS =====================

  INSERT INTO products (category_id, nom, prix, actif, restaurant_id) VALUES
    (cat_sandwichs, 'Steak', 2000, true, rid),
    (cat_sandwichs, 'Poulet', 2500, true, rid),
    (cat_sandwichs, 'Viande hachée', 2000, true, rid),
    (cat_sandwichs, 'Poulet pané', 3000, true, rid),
    (cat_sandwichs, 'Philadelphia', 3000, true, rid),
    (cat_sandwichs, 'Merguez', 2500, true, rid),
    (cat_sandwichs, 'Pacha', 3000, true, rid),
    (cat_sandwichs, 'Norvégienne', 2500, true, rid);

  -- ===================== PRODUCTS: TACOS =====================

  INSERT INTO products (category_id, nom, prix, actif, restaurant_id) VALUES
    (cat_tacos, 'Poulet', 3000, true, rid),
    (cat_tacos, 'Viande', 3000, true, rid),
    (cat_tacos, 'Hachée', 3000, true, rid),
    (cat_tacos, 'Mixte', 3500, true, rid),
    (cat_tacos, 'Cordon bleu', 3000, true, rid),
    (cat_tacos, 'Merguez', 3000, true, rid),
    (cat_tacos, 'Americain', 3000, true, rid),
    (cat_tacos, 'Mexicaine', 3000, true, rid);

  -- ===================== PRODUCTS: NOS PÂTES =====================

  INSERT INTO products (category_id, nom, prix, actif, restaurant_id) VALUES
    (sub_pattes, 'Spaghetti aux fruits de mer', 7000, true, rid),
    (sub_pattes, 'Spaghetti carbonara', 5000, true, rid),
    (sub_pattes, 'Spaghetti bolognaise', 6000, true, rid),
    (sub_pattes, 'Tagliatelle', 6000, true, rid),
    (sub_pattes, 'Napolitano à la viande', 6000, true, rid);

  -- ===================== PRODUCTS: NOS PLATS =====================

  INSERT INTO products (category_id, nom, prix, actif, restaurant_id) VALUES
    (sub_plats, 'Tournedos de Bœuf', 5500, true, rid),
    (sub_plats, 'Tournedos de poulet à la sauce poivre', 6000, true, rid),
    (sub_plats, 'Pavé de saumon d''hôtel au beurre', 7000, true, rid),
    (sub_plats, 'Bœuf Bourguignon', 6000, true, rid),
    (sub_plats, 'Cromesquis de pomme de terre au poulet', 5000, true, rid);

  -- ===================== PRODUCTS: POISSONS =====================

  INSERT INTO products (category_id, nom, prix, actif, restaurant_id) VALUES
    (sub_poissons, 'Filet de sole meunière', 7000, true, rid),
    (sub_poissons, 'Maquereau en Escabèche', 7000, true, rid),
    (sub_poissons, 'Tilapia à la Provinciale', 7000, true, rid),
    (sub_poissons, 'Thiof GM', 10000, true, rid),
    (sub_poissons, 'Thiof Moyenne', 7500, true, rid),
    (sub_poissons, 'Dorade GM', 9000, true, rid),
    (sub_poissons, 'Dorade moyenne', 7000, true, rid);

  -- ===================== PRODUCTS: VOLAILLES =====================

  INSERT INTO products (category_id, nom, prix, actif, restaurant_id) VALUES
    (sub_volailles, 'Poulet entier', 9000, true, rid),
    (sub_volailles, '1/2 Poulet', 5000, true, rid),
    (sub_volailles, '1/4 Poulet', 3500, true, rid),
    (sub_volailles, 'Ailes de poulet', 4000, true, rid),
    (sub_volailles, 'Tenders', 4000, true, rid),
    (sub_volailles, 'Émincé de poulet', 6000, true, rid),
    (sub_volailles, 'Brochette de poulet', 6000, true, rid);

  -- ===================== PRODUCTS: VIANDE =====================

  INSERT INTO products (category_id, nom, prix, actif, restaurant_id) VALUES
    (sub_viande, 'Filet de bœuf', 9000, true, rid),
    (sub_viande, 'Entrecôtes', 6000, true, rid),
    (sub_viande, 'Rumsteak', 7000, true, rid),
    (sub_viande, 'Assiette de Foie', 5000, true, rid),
    (sub_viande, 'Côtes d''agneau', 6000, true, rid),
    (sub_viande, 'Braisé de bœuf', 6000, true, rid);

  -- ===================== PRODUCTS: DIBI =====================

  INSERT INTO products (category_id, nom, prix, actif, restaurant_id) VALUES
    (sub_dibi, 'Dibi 1Kg', 10000, true, rid),
    (sub_dibi, 'Dibi Saf 1Kg', 12000, true, rid),
    (sub_dibi, 'Dibi Poulet', 10000, true, rid);

  -- ===================== PRODUCTS: BROCHETTES =====================

  INSERT INTO products (category_id, nom, prix, actif, restaurant_id) VALUES
    (sub_brochettes, 'Brochettes de viande', 5000, true, rid),
    (sub_brochettes, 'Brochettes mixtes', 6000, true, rid),
    (sub_brochettes, 'Brochettes de poulet', 5000, true, rid),
    (sub_brochettes, 'Brochettes gambas', 8000, true, rid),
    (sub_brochettes, 'Brochettes surf turn', 8000, true, rid),
    (sub_brochettes, 'Brochettes de lotte', 5000, true, rid);

  -- ===================== PRODUCTS: NOS BLANQUETTES =====================

  INSERT INTO products (category_id, nom, prix, actif, restaurant_id) VALUES
    (sub_blanquettes, 'Blanquette de veau', 6000, true, rid),
    (sub_blanquettes, 'Blanquette de gambas', 7000, true, rid),
    (sub_blanquettes, 'Blanquette de poulet', 6000, true, rid),
    (sub_blanquettes, 'Blanquette Fruits de mer', 8500, true, rid);

  -- ===================== PRODUCTS: DESSERTS =====================

  INSERT INTO products (category_id, nom, prix, actif, restaurant_id) VALUES
    (cat_desserts, 'Crème brûlée', 4000, true, rid),
    (cat_desserts, 'Flan caramel', 4000, true, rid),
    (cat_desserts, 'Génoise au chantilly', 4000, true, rid);

  -- ===================== PRODUCTS: CRÊPES SUCRÉES =====================

  INSERT INTO products (category_id, nom, prix, actif, restaurant_id) VALUES
    (sub_crepes_sucrees, 'Nature ou nutella', 3000, true, rid),
    (sub_crepes_sucrees, 'Nutella banane', 3500, true, rid),
    (sub_crepes_sucrees, 'Nutella Fraise', 4000, true, rid),
    (sub_crepes_sucrees, 'Fruits de saison - boule de glace', 4000, true, rid);

  -- ===================== PRODUCTS: GAUFRES SUCRÉES =====================

  INSERT INTO products (category_id, nom, prix, actif, restaurant_id) VALUES
    (sub_gaufres_sucrees, 'Nature ou nutella', 3500, true, rid),
    (sub_gaufres_sucrees, 'Nutella banane', 4000, true, rid),
    (sub_gaufres_sucrees, 'Nutella Fraise', 4500, true, rid),
    (sub_gaufres_sucrees, 'Fruits de saison - boule de glace', 4500, true, rid);

  -- ===================== PRODUCTS: CRÊPES SALÉES =====================

  INSERT INTO products (category_id, nom, prix, actif, restaurant_id) VALUES
    (sub_crepes_salees, 'Dakaroise', 4000, true, rid),
    (sub_crepes_salees, 'Chicken', 4000, true, rid),
    (sub_crepes_salees, 'Stlouisienne', 4000, true, rid),
    (sub_crepes_salees, 'Crêpe mixte', 6000, true, rid);

  -- ===================== PRODUCTS: GAUFRES SALÉES =====================

  INSERT INTO products (category_id, nom, prix, actif, restaurant_id) VALUES
    (sub_gaufres_salees, 'Dakaroise', 4000, true, rid),
    (sub_gaufres_salees, 'Chicken', 4500, true, rid);

END $$;

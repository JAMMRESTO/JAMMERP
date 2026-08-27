/*
  # Seed Realistic Example Data

  Inserts realistic restaurant data for demonstration and reports:

  1. Drivers — 3 active livreurs with commission rates
  2. Recipes — 2 sample recipes linked to existing products
  3. Sales — ~60 paid sales spread over last 30 days
  4. Sale Items — 2–4 items per sale from the existing product catalog
  5. Payments — one payment per sale
  6. Deliveries — ~22 delivered + 2 pending
  7. Driver Payments — commissions for delivered orders
  8. Productions — 12 production runs over last 30 days
*/

-- ─────────────────────────────────────────────────────────
-- DRIVERS
-- ─────────────────────────────────────────────────────────
INSERT INTO drivers (name, phone, status, commission_rate, total_deliveries, total_earnings, notes) VALUES
  ('Moussa Diallo',    '+221 77 123 45 67', 'available', 12.00, 48, 57600, 'Livreur senior, très fiable'),
  ('Aminata Ndiaye',   '+221 76 234 56 78', 'busy',      10.00, 31, 31000, 'Secteur Plateau'),
  ('Ibrahima Sow',     '+221 70 345 67 89', 'offline',   15.00, 22, 49500, 'Scooter électrique')
ON CONFLICT DO NOTHING;

-- ─────────────────────────────────────────────────────────
-- RECIPES
-- ─────────────────────────────────────────────────────────
DO $$
DECLARE
  r1 uuid;
  r2 uuid;
BEGIN
  INSERT INTO recipes (product_id, name, description, batch_yield, total_cost, max_producible, margin_pct)
  VALUES (
    '2729b160-124e-452f-940b-20de4365a4ea'::uuid,
    'Recette Poulet Yassa',
    'Marinade citron-oignons, cuisson lente',
    4, 8500, 12, 69.2
  ) RETURNING id INTO r1;

  INSERT INTO recipe_items (recipe_id, ingredient_id, quantity, unit) VALUES
    (r1, '2e78286b-bb72-4194-88d3-f53feaac225b'::uuid, 1.2, 'kg'),
    (r1, '0941c6bf-641e-4663-a810-a767c3dcf8d4'::uuid, 0.5, 'kg'),
    (r1, '53b2d741-62ac-49fd-b216-1f6e0acf9e84'::uuid, 0.1, 'L'),
    (r1, 'e2c911b0-99fe-4353-929e-b67e09ae203f'::uuid, 0.01, 'kg'),
    (r1, 'b4654c00-05df-4b4e-a60a-7f612f35145b'::uuid, 0.005, 'kg');

  INSERT INTO recipes (product_id, name, description, batch_yield, total_cost, max_producible, margin_pct)
  VALUES (
    '202dcf9c-431a-4cb2-87fe-d4a908cb8a86'::uuid,
    'Recette Fondant Chocolat',
    'Fondant coeur coulant artisanal',
    8, 12000, 6, 53.1
  ) RETURNING id INTO r2;

  INSERT INTO recipe_items (recipe_id, ingredient_id, quantity, unit) VALUES
    (r2, 'd98a5b2b-023d-43d0-a5a6-ce287c1122be'::uuid, 0.3, 'kg'),
    (r2, 'b631e6f9-391f-4c85-b355-df0217c9f4be'::uuid, 4,   'pcs'),
    (r2, '45027ed6-02af-4fb2-bcec-5fde18792659'::uuid, 0.15,'kg'),
    (r2, '27da054f-09de-41b0-a672-1d4e4ecd9d49'::uuid, 0.1, 'kg'),
    (r2, 'e9a27879-2383-44bf-a01e-8a902584bcd4'::uuid, 0.08,'kg');
END $$;

-- ─────────────────────────────────────────────────────────
-- SALES + SALE_ITEMS + PAYMENTS
-- ─────────────────────────────────────────────────────────
DO $$
DECLARE
  sale_id uuid;
  days_ago int;
  sale_type text;
  types text[] := ARRAY['dine_in','dine_in','dine_in','takeaway','takeaway','delivery'];
  methods text[] := ARRAY['cash','cash','wave','orange_money','card'];
  cashier_id uuid := '00dda768-2520-4f2a-bcd0-e8d36238e685'::uuid;
  
  -- product pool: id (uuid), price
  p1 uuid := '2729b160-124e-452f-940b-20de4365a4ea'::uuid; p1v numeric := 6500;
  p2 uuid := 'd6bf8c90-d5c0-45a2-8175-41cf27baf50d'::uuid; p2v numeric := 7500;
  p3 uuid := 'c43527c2-da83-4ef8-9d2d-253b35d96df0'::uuid; p3v numeric := 8500;
  p4 uuid := '317c8582-82e9-4858-8ed2-ca76b40b093a'::uuid; p4v numeric := 9500;
  p5 uuid := '0e7579da-b958-4985-a8c0-de7c7dca39a8'::uuid; p5v numeric := 7000;
  p6 uuid := '8b3e07e4-a867-4029-b925-d3e299607173'::uuid; p6v numeric := 8000;
  p7 uuid := '7a73008a-1086-431f-871a-2a35667fb116'::uuid; p7v numeric := 2000;
  p8 uuid := 'ced1ec98-bc47-48d3-b9ca-3700d9d486ea'::uuid; p8v numeric := 1200;
  p9 uuid := '915b861e-fd06-44c0-87a7-8368adc3662a'::uuid; p9v numeric := 1500;
  p10 uuid := 'a114c8ae-f0aa-4cdc-bf78-a4e44aaaad25'::uuid; p10v numeric := 3500;
  p11 uuid := '4257497a-33ef-4de2-a457-a8774d84a723'::uuid; p11v numeric := 4000;
  p12 uuid := '202dcf9c-431a-4cb2-87fe-d4a908cb8a86'::uuid; p12v numeric := 4500;
  p13 uuid := 'bf8ad704-6b67-4c22-8be2-05bf57879ab0'::uuid; p13v numeric := 2500;
  p14 uuid := '6aa8fcc1-d397-4089-a665-8121d4e239d6'::uuid; p14v numeric := 3000;

  sub numeric;
  tot numeric;
  disc numeric;
  tax_amt numeric;
  i int;
  sale_ts timestamptz;
  table_names text[] := ARRAY['T01','T02','T03','T04','T05','T06','T07','T08'];
  cust_names text[] := ARRAY['Fatou Diallo','Mamadou Sow','Aissatou Ba','Oumar Diop','Mariama Fall','Ibou Niang','Seydou Diallo','Awa Cissé','Lamine Dieng','Khady Mbaye'];
BEGIN
  FOR i IN 1..62 LOOP
    days_ago := (i * 30 / 62);
    sale_ts := (NOW() - (days_ago || ' days')::interval - (((i * 17) % 10) || ' hours')::interval - '8 hours'::interval);
    sale_type := types[1 + (i % array_length(types, 1))];
    sub := 0; disc := 0;

    INSERT INTO sales (sale_type, status, table_number, customer_name, subtotal, tax_amount, discount_amount, total, cashier_id, created_at, paid_at)
    VALUES (
      sale_type, 'paid',
      CASE WHEN sale_type = 'dine_in' THEN table_names[1 + (i % array_length(table_names, 1))] ELSE '' END,
      cust_names[1 + (i % array_length(cust_names, 1))],
      0, 0, 0, 0, cashier_id, sale_ts, sale_ts + '2 minutes'::interval
    ) RETURNING id INTO sale_id;

    IF i % 5 = 0 THEN
      INSERT INTO sale_items (sale_id, product_id, product_name, unit_price, quantity, subtotal) VALUES
        (sale_id, p1, 'Poulet Yassa', p1v, 2, p1v*2),
        (sale_id, p7, 'Frites Maison', p7v, 2, p7v*2),
        (sale_id, p8, 'Coca-Cola', p8v, 2, p8v*2);
      sub := p1v*2 + p7v*2 + p8v*2;
    ELSIF i % 5 = 1 THEN
      INSERT INTO sale_items (sale_id, product_id, product_name, unit_price, quantity, subtotal) VALUES
        (sale_id, p2, 'Thiéboudienne', p2v, 1, p2v),
        (sale_id, p9, 'Jus Bissap', p9v, 2, p9v*2),
        (sale_id, p14, 'Salade de Fruits', p14v, 1, p14v);
      sub := p2v + p9v*2 + p14v;
    ELSIF i % 5 = 2 THEN
      INSERT INTO sale_items (sale_id, product_id, product_name, unit_price, quantity, subtotal) VALUES
        (sale_id, p4, 'Poulet Grillé 1/2', p4v, 1, p4v),
        (sale_id, p7, 'Frites Maison', p7v, 1, p7v),
        (sale_id, p12, 'Fondant Chocolat', p12v, 1, p12v),
        (sale_id, p8, 'Coca-Cola', p8v, 1, p8v);
      sub := p4v + p7v + p12v + p8v;
    ELSIF i % 5 = 3 THEN
      INSERT INTO sale_items (sale_id, product_id, product_name, unit_price, quantity, subtotal) VALUES
        (sale_id, p3, 'Tilapia Braisé', p3v, 2, p3v*2),
        (sale_id, p10, 'Salade César', p10v, 1, p10v);
      sub := p3v*2 + p10v;
    ELSE
      INSERT INTO sale_items (sale_id, product_id, product_name, unit_price, quantity, subtotal) VALUES
        (sale_id, p6, 'Mafé Bœuf', p6v, 1, p6v),
        (sale_id, p11, 'Sandwich Club', p11v, 2, p11v*2),
        (sale_id, p13, 'Soupe du jour', p13v, 1, p13v);
      sub := p6v + p11v*2 + p13v;
    END IF;

    disc := CASE WHEN i % 7 = 0 THEN ROUND(sub * 0.05) ELSE 0 END;
    tax_amt := ROUND((sub - disc) * 0.18);
    tot := sub - disc + tax_amt;
    UPDATE sales SET subtotal = sub, discount_amount = disc, tax_amount = tax_amt, total = tot WHERE id = sale_id;

    INSERT INTO payments (sale_id, method, amount) VALUES
      (sale_id, methods[1 + (i % array_length(methods, 1))], tot);
  END LOOP;
END $$;

-- ─────────────────────────────────────────────────────────
-- DELIVERIES
-- ─────────────────────────────────────────────────────────
DO $$
DECLARE
  driver_ids uuid[];
  drv uuid;
  s record;
  del_id uuid;
  i int := 0;
  fee numeric;
  comm numeric;
  addrs text[] := ARRAY[
    'Rue Carnot, Dakar Plateau',
    'Avenue Bourguiba, Fann Résidence',
    'Allée Seydou Nourou Tall, Médina',
    'Rue 10, Parcelles Assainies',
    'Boulevard du Général de Gaulle, Point E',
    'Rue de Kaolack, Grand Dakar',
    'Cité Lébous, Yoff',
    'Route de Ouakam, Mermoz'
  ];
BEGIN
  SELECT ARRAY_AGG(id ORDER BY created_at) INTO driver_ids FROM drivers LIMIT 3;

  FOR s IN (
    SELECT id, total, customer_name, created_at
    FROM sales WHERE status = 'paid'
    ORDER BY created_at LIMIT 22
  ) LOOP
    i := i + 1;
    drv := driver_ids[1 + (i % 3)];
    fee := 1500 + (i % 4) * 500;
    comm := ROUND(fee * 0.12);

    INSERT INTO deliveries (
      sale_id, driver_id, status,
      customer_name, customer_phone, delivery_address,
      delivery_fee, commission_amount,
      assigned_at, picked_up_at, delivered_at,
      created_at, updated_at
    ) VALUES (
      s.id, drv, 'delivered',
      s.customer_name,
      '+221 77 ' || LPAD(((i * 37891) % 10000000)::text, 7, '0'),
      addrs[1 + (i % array_length(addrs, 1))],
      fee, comm,
      s.created_at + '5 minutes'::interval,
      s.created_at + '15 minutes'::interval,
      s.created_at + '45 minutes'::interval,
      s.created_at, s.created_at + '45 minutes'::interval
    ) RETURNING id INTO del_id;

    INSERT INTO driver_payments (driver_id, delivery_id, payment_type, amount, status, paid_at)
    VALUES (drv, del_id, 'commission', comm, 'paid', s.created_at + '1 day'::interval);
  END LOOP;

  -- 2 pending/assigned deliveries
  INSERT INTO deliveries (status, customer_name, customer_phone, delivery_address, delivery_fee, commission_amount, created_at, updated_at)
  VALUES
    ('pending', 'Ndéye Sarr', '+221 76 999 11 22', 'Rue 12, Sicap Liberté', 2000, 240, NOW() - '35 minutes'::interval, NOW()),
    ('assigned', 'Boubacar Ly', '+221 77 888 33 44', 'Cité Keur Gorgui', 2500, 300, NOW() - '55 minutes'::interval, NOW());
END $$;

-- ─────────────────────────────────────────────────────────
-- PRODUCTIONS
-- ─────────────────────────────────────────────────────────
DO $$
DECLARE
  recipe_ids uuid[];
  r1 uuid; r2 uuid;
  prod_costs numeric[] := ARRAY[8500::numeric, 12000::numeric];
  i int;
  qty int;
  days_ago int;
BEGIN
  SELECT ARRAY_AGG(id ORDER BY created_at) INTO recipe_ids FROM recipes LIMIT 2;
  r1 := recipe_ids[1];
  r2 := recipe_ids[2];

  FOR i IN 1..12 LOOP
    days_ago := i * 2 + (i % 3);
    qty := 4 + (i % 5) * 2;

    INSERT INTO productions (
      recipe_id, product_name, quantity_produced, total_cost, unit_cost,
      loss_quantity, loss_reason, status, created_at, completed_at
    ) VALUES (
      CASE WHEN i % 2 = 0 THEN r1 ELSE r2 END,
      CASE WHEN i % 2 = 0 THEN 'Poulet Yassa' ELSE 'Fondant Chocolat' END,
      qty,
      ROUND(prod_costs[1 + (i % 2)] * qty / 4.0),
      ROUND(prod_costs[1 + (i % 2)] / 4.0),
      CASE WHEN i % 6 = 0 THEN 1 ELSE 0 END,
      CASE WHEN i % 6 = 0 THEN 'Cuisson trop longue' ELSE '' END,
      'completed',
      NOW() - (days_ago || ' days')::interval,
      NOW() - (days_ago || ' days')::interval + '2 hours'::interval
    );
  END LOOP;
END $$;

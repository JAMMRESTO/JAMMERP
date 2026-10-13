-- Fix orders that are fully paid (all items have paid_qty >= qty) but still VALIDE
-- and whose tables are still A_ENCAISSER
UPDATE orders o
SET statut = 'PAYEE', updated_at = now()
FROM (
  SELECT order_id
  FROM order_items
  GROUP BY order_id
  HAVING SUM(paid_qty) >= SUM(qty) AND SUM(qty) > 0
) fully_paid
WHERE o.id = fully_paid.order_id
  AND o.statut = 'VALIDE'
  AND o.order_type = 'TABLE';

-- Free tables that belong to orders now marked PAYEE but table still A_ENCAISSER
UPDATE tables t
SET statut = 'LIBRE', locked_by = null
FROM orders o
WHERE o.table_id = t.id
  AND o.statut = 'PAYEE'
  AND t.statut = 'A_ENCAISSER';

-- Also free tables where the order was already PAYEE but table was stuck (e.g. RST-2026-0205)
UPDATE tables t
SET statut = 'LIBRE', locked_by = null
WHERE t.statut = 'A_ENCAISSER'
  AND NOT EXISTS (
    SELECT 1 FROM orders o
    WHERE o.table_id = t.id AND o.statut IN ('BROUILLON', 'VALIDE')
  );

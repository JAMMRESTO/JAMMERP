-- Allow decimal quantities (e.g. 0.5) for component stock deduction
ALTER TABLE products ALTER COLUMN stock_deduction_quantity TYPE numeric USING stock_deduction_quantity::numeric;
ALTER TABLE products ALTER COLUMN stock_deduction_quantity SET DEFAULT 1;
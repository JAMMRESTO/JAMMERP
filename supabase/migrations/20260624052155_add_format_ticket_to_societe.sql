ALTER TABLE public.societe
  ADD COLUMN IF NOT EXISTS format_ticket text NOT NULL DEFAULT '80mm'
  CHECK (format_ticket IN ('80mm', '55mm'));

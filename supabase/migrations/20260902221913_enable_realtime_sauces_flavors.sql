-- Enable Supabase Realtime on sauces and flavors tables
-- so the POS and manager UIs update instantly when rows change.

ALTER PUBLICATION supabase_realtime ADD TABLE sauces;
ALTER PUBLICATION supabase_realtime ADD TABLE flavors;

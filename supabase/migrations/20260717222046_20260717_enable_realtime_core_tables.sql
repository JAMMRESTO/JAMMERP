-- Enable Supabase Realtime on core tables so the server, cashier, and kitchen
-- views receive instant postgres_changes events instead of relying on polling.
ALTER PUBLICATION supabase_realtime ADD TABLE tables;
ALTER PUBLICATION supabase_realtime ADD TABLE orders;
ALTER PUBLICATION supabase_realtime ADD TABLE order_items;

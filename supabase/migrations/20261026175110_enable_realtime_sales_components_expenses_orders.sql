/*
# Enable Realtime on sales, product_components, expenses, orders, cash_sessions

## Context
The app uses Supabase Realtime to push data changes to connected devices instantly.
Several critical tables were missing from the supabase_realtime publication:
- `sales` — needed so the admin dashboard updates instantly when a sale is paid at the POS
- `product_components` — needed so the POS reflects stock changes made by admin instantly
- `expenses` — needed so the dashboard expense KPI updates when an expense is recorded
- `orders` — needed so the dashboard "live orders" section updates in real time
- `cash_sessions` — needed so all devices see cash session state changes instantly

## Changes
1. Adds all five tables to the `supabase_realtime` publication.
2. Sets REPLICA IDENTITY FULL on each table so UPDATE/DELETE events carry the full row
   (default is REPLICA IDENTITY DEFAULT which only sends primary key on DELETE).

## Security
- No RLS or policy changes. Realtime respects existing RLS policies — clients only
  receive events for rows they are authorized to see.
*/

ALTER PUBLICATION supabase_realtime ADD TABLE public.sales;
ALTER PUBLICATION supabase_realtime ADD TABLE public.product_components;
ALTER PUBLICATION supabase_realtime ADD TABLE public.expenses;
ALTER PUBLICATION supabase_realtime ADD TABLE public.orders;
ALTER PUBLICATION supabase_realtime ADD TABLE public.cash_sessions;

ALTER TABLE public.sales REPLICA IDENTITY FULL;
ALTER TABLE public.product_components REPLICA IDENTITY FULL;
ALTER TABLE public.expenses REPLICA IDENTITY FULL;
ALTER TABLE public.orders REPLICA IDENTITY FULL;
ALTER TABLE public.cash_sessions REPLICA IDENTITY FULL;

/*
  # Enable Realtime on stats-related tables

  ## Purpose
  The admin statistics dashboard (AdminStatistics) and the cashier StatsBar
  subscribe to Supabase Realtime `postgres_changes` events on several tables
  so the UI refreshes instantly when data changes. However the
  `supabase_realtime` publication currently only contains `orders`,
  `order_items`, `print_jobs`, and `tables`. The tables `payments`,
  `cash_sessions`, and `cash_closures` are NOT in the publication, so no
  events are ever delivered for them and the dashboard never refreshes when
  payments, cash sessions, or cash closures change.

  ## Changes
  Adds the following tables to the `supabase_realtime` publication so that
  INSERT/UPDATE/DELETE events are broadcast to subscribed clients:
  - `payments` — drives revenue, ticket-average, and payment-method stats.
  - `cash_sessions` — drives the closures view (open/close sessions).
  - `cash_closures` — drives closure records (X/Z reports).

  Note: `expenses` is referenced by the frontend but does not yet exist in
  this database; it is intentionally omitted here and will be added in a
  later migration once the table is created.

  ## Security
  No RLS changes. Realtime publication membership only controls which tables
  broadcast change events; row-level visibility is still enforced by existing
  RLS policies on each table.

  ## Idempotency
  Each `ALTER PUBLICATION ... ADD TABLE` is wrapped in a DO block that checks
  `pg_publication_tables` first, so re-running this migration is safe.
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'payments'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.payments;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'cash_sessions'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.cash_sessions;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'cash_closures'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.cash_closures;
  END IF;
END $$;

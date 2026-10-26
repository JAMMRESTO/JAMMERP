/*
# Link sales to cash sessions

## Context
Sales were matched to cash sessions only by time range (paid_at between opened_at and closed_at).
This caused confusion: sales made just after midnight but belonging to the previous evening's session
appeared in the next day's report, making daily totals not match cash closures.

## Changes
1. Adds `cash_session_id` column to `sales` (nullable uuid, FK to cash_sessions).
2. Backfills existing paid sales with the cash_session_id of the session that was open at paid_at time.
3. Adds an index on cash_session_id for fast session-based queries.
4. No RLS policy changes needed — the column is accessible through existing sales policies.

## Security
- No new tables. No policy changes. The column inherits existing sales RLS.
*/

-- 1. Add column
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'sales' AND column_name = 'cash_session_id'
  ) THEN
    ALTER TABLE sales ADD COLUMN cash_session_id uuid;
  END IF;
END $$;

-- 2. Backfill: for each paid sale, find the open session at paid_at time
UPDATE sales s
SET cash_session_id = sub.session_id
FROM (
  SELECT DISTINCT ON (s2.id)
    s2.id AS sale_id,
    cs.id AS session_id
  FROM sales s2
  JOIN cash_sessions cs
    ON cs.site_id = s2.site_id
    AND s2.paid_at IS NOT NULL
    AND s2.paid_at >= cs.opened_at
    AND (cs.closed_at IS NULL OR s2.paid_at <= cs.closed_at)
  WHERE s2.cash_session_id IS NULL
    AND s2.status = 'paid'
  ORDER BY s2.id, cs.opened_at DESC
) sub
WHERE s.id = sub.sale_id;

-- 3. Add FK constraint (after backfill so existing rows are valid)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'sales_cash_session_id_fkey'
  ) THEN
    ALTER TABLE sales
      ADD CONSTRAINT sales_cash_session_id_fkey
      FOREIGN KEY (cash_session_id) REFERENCES cash_sessions(id) ON DELETE SET NULL;
  END IF;
END $$;

-- 4. Index for fast lookups
CREATE INDEX IF NOT EXISTS idx_sales_cash_session_id ON sales(cash_session_id) WHERE cash_session_id IS NOT NULL;

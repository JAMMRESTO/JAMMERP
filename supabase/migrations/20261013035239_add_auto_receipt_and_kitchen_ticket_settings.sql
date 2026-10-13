-- Idempotent: only insert if the key does not already exist.
-- This preserves any value the restaurant may have already saved.

INSERT INTO app_settings (key, value, updated_at)
SELECT 'autoReceiptPrint', 'false', now()
WHERE NOT EXISTS (SELECT 1 FROM app_settings WHERE key = 'autoReceiptPrint');

INSERT INTO app_settings (key, value, updated_at)
SELECT 'kitchenTicketWithReceipt', 'false', now()
WHERE NOT EXISTS (SELECT 1 FROM app_settings WHERE key = 'kitchenTicketWithReceipt');

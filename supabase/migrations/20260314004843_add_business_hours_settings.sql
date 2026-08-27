/*
  # Add Business Hours Settings

  ## Summary
  Adds configurable business open/close hour settings to app_settings table.

  ## Changes
  - Inserts default values for `business_open_hour` (8) and `business_close_hour` (3)
  - These control the "business day" window used by cash closures and statistics
  - A business day starting at 8:00 and ending at 3:00 (next calendar day) means:
    - After midnight but before 3:00 AM still belongs to the PREVIOUS business day

  ## Notes
  - Hours are stored as integers (0-23)
  - No schema change needed, uses existing app_settings key/value table
*/

INSERT INTO app_settings (key, value)
VALUES
  ('business_open_hour', '8'),
  ('business_close_hour', '3')
ON CONFLICT (key) DO NOTHING;

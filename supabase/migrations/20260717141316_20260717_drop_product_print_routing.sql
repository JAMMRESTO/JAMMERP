/*
# Drop product_print_routing table

## Summary
Removes the `product_print_routing` table which was never consistently used by the application.

## Context
The table allowed per-product and per-category printer overrides, but the fabrication.ts service
(used for kitchen/bar printing) always ignored it and read `categories.printer_id` directly.
This created a split routing path where rules configured in product_print_routing were silently
ignored half the time.

## Changes
1. Drop table `product_print_routing` and its associated policies/indexes.
2. All printer routing now uses a single path: `categories.printer_id` with parent inheritance.
*/

DROP TABLE IF EXISTS product_print_routing;

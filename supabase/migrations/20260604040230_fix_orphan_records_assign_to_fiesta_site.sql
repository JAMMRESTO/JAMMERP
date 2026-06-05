/*
  # Migration 1/6 — Fix orphan records without site_id / tenant_id

  ## Problem
  The initial seed migrations created data before multi-tenancy was added,
  leaving rows with site_id = NULL or tenant_id = NULL. These rows are
  invisible to RLS policies and unreachable by the application.

  ## Actions
  1. categories (7 orphans) — reassigned to FIESTA VDN site (the original seed site)
  2. settings (10 orphans) — deleted (all are exact duplicates of existing FIESTA VDN
     settings, or hold null values with no usable data)
  3. roles (2 orphans: admin, cashier) — reassigned to FIESTA tenant
  4. users (1 orphan: Administrateur seed user) — reassigned to FIESTA site + tenant

  ## Site/tenant used
  - Site  : FIESTA VDN  (91cdad33-fbbc-4202-b7db-1d6441256230)
  - Tenant: LAFIESTA    (28e5952f-eb37-4215-89c7-812a683ec086)
*/

-- 1. Assign orphan categories to FIESTA VDN
UPDATE categories
SET site_id = '91cdad33-fbbc-4202-b7db-1d6441256230'
WHERE site_id IS NULL;

-- 2. Delete orphan settings (all are duplicates or null-value rows)
DELETE FROM settings WHERE site_id IS NULL;

-- 3. Assign orphan roles to FIESTA tenant
UPDATE roles
SET tenant_id = '28e5952f-eb37-4215-89c7-812a683ec086'
WHERE tenant_id IS NULL;

-- 4. Assign orphan user (Administrateur seed) to FIESTA site + tenant
UPDATE users
SET
  site_id   = '91cdad33-fbbc-4202-b7db-1d6441256230',
  tenant_id = '28e5952f-eb37-4215-89c7-812a683ec086'
WHERE tenant_id IS NULL;

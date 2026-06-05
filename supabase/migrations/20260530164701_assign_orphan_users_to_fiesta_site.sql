/*
  # Assign orphan users to FIESTA site

  ## Problem
  All existing users have site_id = NULL, so they are never returned
  when the app queries users filtered by site_id. This causes the
  "Aucun utilisateur configuré" message on the login screen.

  ## Fix
  Assign all users with site_id IS NULL to the FIESTA site
  (b478ff57-5d6d-456d-a92a-de1be1800a78).
*/

UPDATE users
SET site_id = 'b478ff57-5d6d-456d-a92a-de1be1800a78'
WHERE site_id IS NULL;

/*
  # Enable Realtime for user_permissions table

  Adds the user_permissions table to the Supabase Realtime publication
  so that permission changes made by an admin are instantly pushed
  to connected clients, without waiting for a polling interval.
*/

ALTER PUBLICATION supabase_realtime ADD TABLE user_permissions;

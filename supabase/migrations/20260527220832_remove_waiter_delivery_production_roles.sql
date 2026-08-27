/*
  # Remove waiter, delivery and production roles

  Deletes the three roles no longer needed:
  - waiter (Serveur)
  - delivery (Livreur)
  - production (Production)

  No users are assigned to these roles so no data is lost.
*/

DELETE FROM public.roles WHERE name IN ('waiter', 'delivery', 'production');

/*
  # Activer Realtime sur products et categories

  Active la réplication Realtime Supabase sur les tables products et categories
  afin que tous les appareils connectés reçoivent les changements en temps réel
  sans rechargement manuel.
*/

ALTER PUBLICATION supabase_realtime ADD TABLE public.products;
ALTER PUBLICATION supabase_realtime ADD TABLE public.categories;

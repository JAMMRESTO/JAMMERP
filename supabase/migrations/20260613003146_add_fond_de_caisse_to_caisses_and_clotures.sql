/*
# Ajout du fond de caisse

1. Tables modifiées
   - `caisses` : ajout de `fond_de_caisse` (NUMERIC 15,2 DEFAULT 0) — le montant d'ouverture de la caisse pour la période en cours
   - `clotures_caisses` : ajout de `fond_de_caisse` (NUMERIC 15,2 DEFAULT 0) — snapshot du fond au moment de la clôture

2. Logique métier
   - Solde réel = fond_de_caisse + total_encaissements - total_decaissements
   - Après chaque clôture, fond_de_caisse est remis à 0 sur la caisse
   - Le caissier/admin saisit le fond d'ouverture avant de commencer une nouvelle période

3. Sécurité
   - Pas de nouvelles politiques RLS nécessaires : les colonnes héritent des politiques existantes sur leurs tables
   - La mise à jour de fond_de_caisse se fait via la edge function (service_role) pour contourner les restrictions RLS sur UPDATE caisses
*/

ALTER TABLE caisses ADD COLUMN IF NOT EXISTS fond_de_caisse NUMERIC(15,2) NOT NULL DEFAULT 0;
ALTER TABLE clotures_caisses ADD COLUMN IF NOT EXISTS fond_de_caisse NUMERIC(15,2) NOT NULL DEFAULT 0;

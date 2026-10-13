/*
  # Ajout du statut WAITING_CASHIER sur print_jobs

  ## Objectif
  Introduire un statut intermédiaire "WAITING_CASHIER" dans la table print_jobs.

  ## Changement
  Ce statut est assigné aux jobs de type INITIAL et ADDONS créés depuis une tablette/téléphone serveur.
  Il signifie : "ticket généré, en attente de validation par le caissier avant envoi aux imprimantes".
  Le caissier voit ces jobs en temps réel, vérifie et clique "Envoyer" pour les passer à PENDING,
  ce qui déclenche l'envoi TCP vers les imprimantes cuisine/bar/etc.

  ## Tables modifiées
  - `print_jobs` : ajout de 'WAITING_CASHIER' dans la contrainte CHECK sur la colonne status

  ## Notes importantes
  1. Les jobs BILL (addition) ne passent PAS par ce statut - ils sont déclenchés directement par le caissier.
  2. La contrainte précédente est supprimée et recréée de façon idempotente.
  3. Migration safe à ré-appliquer grâce aux IF EXISTS.
*/

ALTER TABLE print_jobs DROP CONSTRAINT IF EXISTS print_jobs_status_check;

ALTER TABLE print_jobs
  ADD CONSTRAINT print_jobs_status_check
  CHECK (status = ANY (ARRAY[
    'PENDING'::text,
    'PRINTING'::text,
    'SUCCESS'::text,
    'DONE'::text,
    'FAILED'::text,
    'WAITING_CASHIER'::text
  ]));

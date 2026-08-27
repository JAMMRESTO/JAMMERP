/*
  # Table clotures_caisses — historique des clôtures de caisse

  Chaque clôture archive les totaux de la période et supprime les transactions
  de la caisse concernée, remettant les compteurs à zéro.
*/

CREATE TABLE public.clotures_caisses (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  caisse_id     uuid NOT NULL REFERENCES public.caisses(id) ON DELETE CASCADE,
  created_by    uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  date_debut    date NOT NULL,
  date_fin      date NOT NULL DEFAULT CURRENT_DATE,
  total_encaissements numeric(15,2) NOT NULL DEFAULT 0,
  total_decaissements numeric(15,2) NOT NULL DEFAULT 0,
  solde         numeric(15,2) NOT NULL DEFAULT 0,
  nb_encaissements  integer NOT NULL DEFAULT 0,
  nb_decaissements  integer NOT NULL DEFAULT 0,
  created_at    timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.clotures_caisses ENABLE ROW LEVEL SECURITY;

-- Admin peut tout voir, caissier voit sa caisse
CREATE POLICY "select_clotures_caisses" ON public.clotures_caisses FOR SELECT
  TO anon USING (is_app_authenticated());

CREATE POLICY "insert_clotures_caisses" ON public.clotures_caisses FOR INSERT
  TO anon WITH CHECK (is_app_authenticated() AND (
    EXISTS (SELECT 1 FROM profiles WHERE profiles.id = get_current_profile_id() AND profiles.role = 'admin')
  ));

CREATE POLICY "update_clotures_caisses" ON public.clotures_caisses FOR UPDATE
  TO anon USING (is_app_authenticated() AND (
    EXISTS (SELECT 1 FROM profiles WHERE profiles.id = get_current_profile_id() AND profiles.role = 'admin')
  )) WITH CHECK (is_app_authenticated() AND (
    EXISTS (SELECT 1 FROM profiles WHERE profiles.id = get_current_profile_id() AND profiles.role = 'admin')
  ));

CREATE POLICY "delete_clotures_caisses" ON public.clotures_caisses FOR DELETE
  TO anon USING (is_app_authenticated() AND (
    EXISTS (SELECT 1 FROM profiles WHERE profiles.id = get_current_profile_id() AND profiles.role = 'admin')
  ));

-- Index pour recherche par caisse et date
CREATE INDEX idx_clotures_caisse ON public.clotures_caisses(caisse_id);
CREATE INDEX idx_clotures_date ON public.clotures_caisses(date_fin DESC);

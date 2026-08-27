
-- Update get_stats_globales to include archived clotures
CREATE OR REPLACE FUNCTION public.get_stats_globales(
  p_date_from date DEFAULT NULL,
  p_date_to date DEFAULT NULL
)
RETURNS TABLE(
  total_encaissements numeric,
  total_decaissements numeric,
  solde numeric,
  nb_encaissements bigint,
  nb_decaissements bigint
)
LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
RETURN QUERY
WITH enc AS (
  SELECT COALESCE(SUM(montant), 0) AS total, COUNT(*) AS nb
  FROM public.encaissements
  WHERE (p_date_from IS NULL OR date_transaction >= p_date_from)
  AND (p_date_to IS NULL OR date_transaction <= p_date_to)
),
dec AS (
  SELECT COALESCE(SUM(montant), 0) AS total, COUNT(*) AS nb
  FROM public.decaissements
  WHERE (p_date_from IS NULL OR date_transaction >= p_date_from)
  AND (p_date_to IS NULL OR date_transaction <= p_date_to)
),
clotures AS (
  SELECT
    COALESCE(SUM(cc.total_encaissements), 0) AS total_enc,
    COALESCE(SUM(cc.total_decaissements), 0) AS total_dec,
    COALESCE(SUM(cc.nb_encaissements), 0) AS nb_enc,
    COALESCE(SUM(cc.nb_decaissements), 0) AS nb_dec
  FROM public.clotures_caisses cc
  WHERE (p_date_from IS NULL OR cc.date_fin >= p_date_from)
  AND (p_date_to IS NULL OR cc.date_debut <= p_date_to)
)
SELECT
  enc.total + clotures.total_enc,
  dec.total + clotures.total_dec,
  (enc.total + clotures.total_enc) - (dec.total + clotures.total_dec),
  enc.nb + clotures.nb_enc,
  dec.nb + clotures.nb_dec
FROM enc, dec, clotures;
END;
$$;

-- Update get_stats_par_caisse to include archived clotures
CREATE OR REPLACE FUNCTION public.get_stats_par_caisse(
  p_date_from date DEFAULT NULL,
  p_date_to date DEFAULT NULL
)
RETURNS TABLE(
  caisse_id uuid,
  caisse_nom text,
  total_encaissements numeric,
  total_decaissements numeric,
  solde numeric,
  nb_encaissements bigint,
  nb_decaissements bigint
)
LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
RETURN QUERY
SELECT
  c.id,
  c.nom,
  COALESCE(SUM(e.montant), 0) + COALESCE(cl.total_enc, 0),
  COALESCE(SUM(d.montant), 0) + COALESCE(cl.total_dec, 0),
  (COALESCE(SUM(e.montant), 0) + COALESCE(cl.total_enc, 0)) - (COALESCE(SUM(d.montant), 0) + COALESCE(cl.total_dec, 0)),
  COUNT(DISTINCT e.id) + COALESCE(cl.nb_enc, 0),
  COUNT(DISTINCT d.id) + COALESCE(cl.nb_dec, 0)
FROM public.caisses c
LEFT JOIN public.encaissements e ON e.caisse_id = c.id
  AND (p_date_from IS NULL OR e.date_transaction >= p_date_from)
  AND (p_date_to IS NULL OR e.date_transaction <= p_date_to)
LEFT JOIN public.decaissements d ON d.caisse_id = c.id
  AND (p_date_from IS NULL OR d.date_transaction >= p_date_from)
  AND (p_date_to IS NULL OR d.date_transaction <= p_date_to)
LEFT JOIN LATERAL (
  SELECT
    SUM(cc.total_encaissements)::numeric AS total_enc,
    SUM(cc.total_decaissements)::numeric AS total_dec,
    SUM(cc.nb_encaissements)::bigint AS nb_enc,
    SUM(cc.nb_decaissements)::bigint AS nb_dec
  FROM public.clotures_caisses cc
  WHERE cc.caisse_id = c.id
  AND (p_date_from IS NULL OR cc.date_fin >= p_date_from)
  AND (p_date_to IS NULL OR cc.date_debut <= p_date_to)
) cl ON true
GROUP BY c.id, c.nom, cl.total_enc, cl.total_dec, cl.nb_enc, cl.nb_dec
ORDER BY c.nom;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_stats_globales(date, date) TO anon;
GRANT EXECUTE ON FUNCTION public.get_stats_par_caisse(date, date) TO anon;

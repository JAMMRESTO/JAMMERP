
-- Drop and recreate get_stats_par_jour to include archived clotures data.
DROP FUNCTION IF EXISTS public.get_stats_par_jour(date, date);

CREATE FUNCTION public.get_stats_par_jour(
  p_date_from date DEFAULT NULL,
  p_date_to date DEFAULT NULL
)
RETURNS TABLE(
  jour date,
  total_encaissements numeric,
  total_decaissements numeric,
  solde_jour numeric
)
LANGUAGE plpgsql SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
  v_from date := COALESCE(p_date_from, (CURRENT_DATE - INTERVAL '30 days')::date);
  v_to   date := COALESCE(p_date_to, CURRENT_DATE);
BEGIN
RETURN QUERY
WITH days AS (
  SELECT generate_series(v_from, v_to, '1 day'::interval)::date AS jour
),
enc_active AS (
  SELECT date_transaction AS jour, COALESCE(SUM(montant), 0) AS total
  FROM public.encaissements
  WHERE date_transaction BETWEEN v_from AND v_to
  GROUP BY date_transaction
),
dec_active AS (
  SELECT date_transaction AS jour, COALESCE(SUM(montant), 0) AS total
  FROM public.decaissements
  WHERE date_transaction BETWEEN v_from AND v_to
  GROUP BY date_transaction
),
clotures_enc AS (
  SELECT cc.date_fin AS jour, COALESCE(SUM(cc.total_encaissements), 0) AS total
  FROM public.clotures_caisses cc
  WHERE cc.date_fin BETWEEN v_from AND v_to
  GROUP BY cc.date_fin
),
clotures_dec AS (
  SELECT cc.date_fin AS jour, COALESCE(SUM(cc.total_decaissements), 0) AS total
  FROM public.clotures_caisses cc
  WHERE cc.date_fin BETWEEN v_from AND v_to
  GROUP BY cc.date_fin
)
SELECT
  d.jour,
  COALESCE(ea.total, 0) + COALESCE(ce.total, 0),
  COALESCE(da.total, 0) + COALESCE(cd.total, 0),
  (COALESCE(ea.total, 0) + COALESCE(ce.total, 0)) - (COALESCE(da.total, 0) + COALESCE(cd.total, 0))
FROM days d
LEFT JOIN enc_active ea ON ea.jour = d.jour
LEFT JOIN dec_active da ON da.jour = d.jour
LEFT JOIN clotures_enc ce ON ce.jour = d.jour
LEFT JOIN clotures_dec cd ON cd.jour = d.jour
ORDER BY d.jour;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_stats_par_jour(date, date) TO anon;


-- Step 1: Add archived flag and cloture reference to transaction tables
ALTER TABLE public.encaissements
  ADD COLUMN archived boolean NOT NULL DEFAULT false,
  ADD COLUMN cloture_id uuid REFERENCES public.clotures_caisses(id) ON DELETE SET NULL;

ALTER TABLE public.decaissements
  ADD COLUMN archived boolean NOT NULL DEFAULT false,
  ADD COLUMN cloture_id uuid REFERENCES public.clotures_caisses(id) ON DELETE SET NULL;

-- Step 2: Mark existing clotures as "individual records deleted" (pre-migration behavior)
-- New clotures will set this to true after keeping individual records
ALTER TABLE public.clotures_caisses
  ADD COLUMN has_individual_records boolean NOT NULL DEFAULT false;

-- Step 3: Performance indexes
CREATE INDEX IF NOT EXISTS enc_archived_idx ON public.encaissements(caisse_id, archived);
CREATE INDEX IF NOT EXISTS enc_cloture_idx ON public.encaissements(cloture_id) WHERE cloture_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS dec_archived_idx ON public.decaissements(caisse_id, archived);
CREATE INDEX IF NOT EXISTS dec_cloture_idx ON public.decaissements(cloture_id) WHERE cloture_id IS NOT NULL;

-- Step 4: Update get_stats_globales
-- Now: ALL encaissements + ALL decaissements (active + archived) 
--    + clotures WHERE has_individual_records=false (pre-migration deleted data)
DROP FUNCTION IF EXISTS public.get_stats_globales(date, date);
CREATE FUNCTION public.get_stats_globales(
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
LANGUAGE plpgsql SECURITY INVOKER
SET search_path = ''
AS $$
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
  WHERE cc.has_individual_records = false
  AND (p_date_from IS NULL OR cc.date_fin >= p_date_from)
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

GRANT EXECUTE ON FUNCTION public.get_stats_globales(date, date) TO anon;

-- Step 5: Update get_stats_par_caisse
DROP FUNCTION IF EXISTS public.get_stats_par_caisse(date, date);
CREATE FUNCTION public.get_stats_par_caisse(
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
LANGUAGE plpgsql SECURITY INVOKER
SET search_path = ''
AS $$
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
  AND cc.has_individual_records = false
  AND (p_date_from IS NULL OR cc.date_fin >= p_date_from)
  AND (p_date_to IS NULL OR cc.date_debut <= p_date_to)
) cl ON true
GROUP BY c.id, c.nom, cl.total_enc, cl.total_dec, cl.nb_enc, cl.nb_dec
ORDER BY c.nom;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_stats_par_caisse(date, date) TO anon;

-- Step 6: Update get_stats_par_jour to use individual records + old clotures
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
enc_by_day AS (
  SELECT date_transaction AS jour, COALESCE(SUM(montant), 0) AS total
  FROM public.encaissements
  WHERE date_transaction BETWEEN v_from AND v_to
  GROUP BY date_transaction
),
dec_by_day AS (
  SELECT date_transaction AS jour, COALESCE(SUM(montant), 0) AS total
  FROM public.decaissements
  WHERE date_transaction BETWEEN v_from AND v_to
  GROUP BY date_transaction
),
old_clotures_enc AS (
  SELECT cc.date_fin AS jour, COALESCE(SUM(cc.total_encaissements), 0) AS total
  FROM public.clotures_caisses cc
  WHERE cc.has_individual_records = false
    AND cc.date_fin BETWEEN v_from AND v_to
  GROUP BY cc.date_fin
),
old_clotures_dec AS (
  SELECT cc.date_fin AS jour, COALESCE(SUM(cc.total_decaissements), 0) AS total
  FROM public.clotures_caisses cc
  WHERE cc.has_individual_records = false
    AND cc.date_fin BETWEEN v_from AND v_to
  GROUP BY cc.date_fin
)
SELECT
  d.jour,
  COALESCE(e.total, 0) + COALESCE(ce.total, 0),
  COALESCE(da.total, 0) + COALESCE(cd.total, 0),
  (COALESCE(e.total, 0) + COALESCE(ce.total, 0)) - (COALESCE(da.total, 0) + COALESCE(cd.total, 0))
FROM days d
LEFT JOIN enc_by_day e ON e.jour = d.jour
LEFT JOIN dec_by_day da ON da.jour = d.jour
LEFT JOIN old_clotures_enc ce ON ce.jour = d.jour
LEFT JOIN old_clotures_dec cd ON cd.jour = d.jour
ORDER BY d.jour;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_stats_par_jour(date, date) TO anon;

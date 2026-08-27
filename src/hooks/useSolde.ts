import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '../lib/supabase';

const POLL_INTERVAL = 5000;

export function useSolde(caisseId: string | null) {
  const [solde, setSolde] = useState<number | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchSolde = useCallback(async () => {
    if (!caisseId) { setSolde(null); return; }

    const [encRes, decRes, caisseRes] = await Promise.all([
      supabase.from('encaissements').select('montant').eq('caisse_id', caisseId).eq('archived', false),
      supabase.from('decaissements').select('montant').eq('caisse_id', caisseId).eq('archived', false),
      supabase.from('caisses').select('fond_de_caisse').eq('id', caisseId).maybeSingle(),
    ]);

    const fond = Number(caisseRes.data?.fond_de_caisse ?? 0);
    const totalEnc = (encRes.data ?? []).reduce((s, r) => s + Number(r.montant), 0);
    const totalDec = (decRes.data ?? []).reduce((s, r) => s + Number(r.montant), 0);
    setSolde(fond + totalEnc - totalDec);
  }, [caisseId]);

  useEffect(() => {
    fetchSolde();

    intervalRef.current = setInterval(fetchSolde, POLL_INTERVAL);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [fetchSolde]);

  return solde;
}

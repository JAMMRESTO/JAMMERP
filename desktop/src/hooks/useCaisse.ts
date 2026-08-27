import { useState, useEffect, useCallback } from 'react';

const api = () => window.electronAPI;

export interface Caisse {
  id: string;
  nom: string;
  ordre: number;
  fond_de_caisse: number;
}

export function useCaisse(userId: string | null, userRole?: string) {
  const [caisses, setCaisses] = useState<Caisse[]>([]);
  const [caisseActive, setCaisseActive] = useState<Caisse | null>(null);

  const load = useCallback(async () => {
    if (!userId) return;
    const all = await api().caisses.getAll() as Caisse[];
    setCaisses(all);

    const profile = await api().auth.getProfile(userId);
    if (profile?.caisse_id && userRole === 'caissier') {
      const assigned = all.find(c => c.id === profile.caisse_id);
      setCaisseActive(assigned || all[0] || null);
    } else {
      const cached = localStorage.getItem(`mc_caisse_${userId}`);
      if (cached) {
        const found = all.find(c => c.id === cached);
        setCaisseActive(found || all[0] || null);
      } else {
        setCaisseActive(all[0] || null);
      }
    }
  }, [userId, userRole]);

  useEffect(() => { load(); }, [load]);

  const selectCaisse = useCallback((id: string) => {
    const c = caisses.find(c => c.id === id);
    if (c) {
      setCaisseActive(c);
      if (userId) localStorage.setItem(`mc_caisse_${userId}`, id);
    }
  }, [caisses, userId]);

  return { caisses, caisseActive, selectCaisse, reload: load };
}

import { useState, useEffect } from 'react';

const api = () => window.electronAPI;

export function useSolde(caisseId: string | null) {
  const [solde, setSolde] = useState<number | null>(null);

  useEffect(() => {
    if (!caisseId) { setSolde(null); return; }

    const fetch = async () => {
      const s = await api().solde.get(caisseId);
      setSolde(s);
    };

    fetch();
    const interval = setInterval(fetch, 5000);
    return () => clearInterval(interval);
  }, [caisseId]);

  return solde;
}

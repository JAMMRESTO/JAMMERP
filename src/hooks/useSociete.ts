import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

export interface SocieteInfo {
  nom: string;
  logo_url: string;
}

export function useSociete(organisationId: string | undefined) {
  const [societe, setSociete] = useState<SocieteInfo | null>(null);

  useEffect(() => {
    if (!organisationId) {
      setSociete(null);
      return;
    }

    supabase
      .from('societe')
      .select('nom, logo_url')
      .eq('organisation_id', organisationId)
      .maybeSingle()
      .then(({ data }) => {
        if (data) {
          setSociete({ nom: data.nom || '', logo_url: data.logo_url || '' });
        } else {
          setSociete(null);
        }
      });
  }, [organisationId]);

  return societe;
}

import { useState, useEffect } from 'react';

const api = () => window.electronAPI;

export interface Societe {
  id: string;
  nom: string;
  nom_societe: string;
  telephone: string;
  adresse: string;
  message_ticket: string;
  logo_url: string;
  format_ticket: string;
}

export function useSociete() {
  const [societe, setSociete] = useState<Societe | null>(null);

  useEffect(() => {
    api().societe.get().then(data => {
      if (data) setSociete(data as Societe);
    });
  }, []);

  return societe;
}

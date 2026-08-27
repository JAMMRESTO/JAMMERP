import { useState, useCallback } from 'react';

const api = () => window.electronAPI;

export interface AppUser {
  id: string;
  nom: string;
  email: string;
  role: string;
  caisse_id?: string;
  actif: boolean;
}

export function useAuth() {
  const [user, setUser] = useState<AppUser | null>(() => {
    const stored = localStorage.getItem('mc_desktop_user');
    return stored ? JSON.parse(stored) : null;
  });
  const [loading, setLoading] = useState(false);

  const signIn = useCallback(async (pin: string): Promise<{ error: string | null }> => {
    setLoading(true);
    try {
      const result = await api().auth.login(pin);
      if (result.error) {
        setLoading(false);
        return { error: result.error };
      }
      const u = result.user as AppUser;
      setUser(u);
      localStorage.setItem('mc_desktop_user', JSON.stringify(u));
      setLoading(false);
      return { error: null };
    } catch (err: any) {
      setLoading(false);
      return { error: err.message || 'Erreur de connexion' };
    }
  }, []);

  const signOut = useCallback(() => {
    setUser(null);
    localStorage.removeItem('mc_desktop_user');
  }, []);

  return { user, loading, signIn, signOut };
}

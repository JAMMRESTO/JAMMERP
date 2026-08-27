import { useState, useEffect, useCallback } from 'react';
import { setSessionToken, clearSessionToken, getSessionToken } from '../lib/supabase';

export interface AppUser {
  id: string;
  nom: string;
  email: string;
  role: string;
  is_super_admin: boolean;
  organisation_id: string;
}

const USER_STORAGE_KEY = 'mc_session_user';
const AUTH_FN_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/auth-pin`;

async function callAuthFn(action: string, body: Record<string, unknown>) {
  const res = await fetch(`${AUTH_FN_URL}/${action}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
    },
    body: JSON.stringify(body),
  });
  return res.json();
}

function loadUser(): AppUser | null {
  try {
    const raw = localStorage.getItem(USER_STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as AppUser;
  } catch {
    return null;
  }
}

function saveUser(user: AppUser) {
  localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(user));
}

function clearUser() {
  localStorage.removeItem(USER_STORAGE_KEY);
}

export function useAuth() {
  const savedUser = loadUser();
  const savedToken = getSessionToken();
  const hasLocalSession = !!(savedUser && savedToken);

  const [user, setUser] = useState<AppUser | null>(hasLocalSession ? savedUser : null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!hasLocalSession) return;

    // Validate token in background — sign out silently if expired, refresh profile data
    callAuthFn('check-session', { token: savedToken! }).then(async (data) => {
      if (!data?.valid) {
        clearUser();
        clearSessionToken();
        setUser(null);
      } else if (savedUser) {
        // Refresh profile data (is_super_admin may have been added after initial login)
        try {
          const profileRes = await callAuthFn('get-profile', { token: savedToken! });
          if (profileRes?.user) {
            const refreshed: AppUser = {
              id: profileRes.user.id,
              nom: profileRes.user.nom,
              email: profileRes.user.email,
              role: profileRes.user.role,
              is_super_admin: profileRes.user.is_super_admin ?? false,
              organisation_id: profileRes.user.organisation_id ?? '',
            };
            saveUser(refreshed);
            setUser(refreshed);
          }
        } catch { /* non-critical, keep cached user */ }
      }
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const signIn = useCallback(async (pin: string): Promise<{ error: string | null }> => {
    let result;
    try {
      result = await callAuthFn('authenticate', { pin });
    } catch {
      return { error: 'Erreur serveur. Réessayez.' };
    }

    if (!result?.user) return { error: 'Code PIN incorrect.' };

    const row = result.user;
    const appUser: AppUser = {
      id: row.id,
      nom: row.nom,
      email: row.email,
      role: row.role,
      is_super_admin: row.is_super_admin ?? false,
      organisation_id: row.organisation_id ?? '',
    };

    let sessionResult;
    try {
      sessionResult = await callAuthFn('create-session', { profile_id: row.id });
    } catch {
      return { error: 'Impossible de créer la session.' };
    }

    if (!sessionResult?.token) return { error: 'Impossible de créer la session.' };

    setSessionToken(sessionResult.token as string);
    saveUser(appUser);
    setUser(appUser);

    return { error: null };
  }, []);

  const signOut = useCallback(async () => {
    const token = getSessionToken();
    if (token) {
      callAuthFn('destroy-session', { token }); // fire-and-forget
    }
    clearSessionToken();
    clearUser();
    setUser(null);
  }, []);

  const updateOrganisation = useCallback((orgId: string) => {
    setUser(prev => {
      if (!prev) return prev;
      const updated = { ...prev, organisation_id: orgId };
      saveUser(updated);
      return updated;
    });
  }, []);

  return { user, loading, signIn, signOut, updateOrganisation };
}

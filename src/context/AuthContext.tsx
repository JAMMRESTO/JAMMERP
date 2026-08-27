import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { supabase } from '../lib/supabase';
import { useTenant } from './TenantContext';
import type { UserWithRole } from '../types/database';

interface AuthContextType {
  currentUser: UserWithRole | null;
  isLocked: boolean;
  isLoading: boolean;
  login: (pin: string, userId?: string) => Promise<{ success: boolean; error?: string }>;
  logout: () => void;
  fullLogout: () => void;
  lockSession: () => void;
  unlockSession: (pin: string) => Promise<boolean>;
  allUsers: UserWithRole[];
  selectedUserId: string | null;
  selectUser: (userId: string) => void;
}

const AuthContext = createContext<AuthContextType | null>(null);

const SESSION_KEY = 'resto_session_user';
const LOCK_KEY = 'resto_session_locked';

export function AuthProvider({ children }: { children: ReactNode }) {
  const { currentSite, isSiteManager, signOut: tenantSignOut } = useTenant();

  const [currentUser, setCurrentUser] = useState<UserWithRole | null>(null);
  const [isLocked, setIsLocked] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [allUsers, setAllUsers] = useState<UserWithRole[]>([]);
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);

  // Reload staff users when site changes
  useEffect(() => {
    setCurrentUser(null);
    setSelectedUserId(null);
    setAllUsers([]);
    if (currentSite) {
      loadUsers(currentSite.id);
    } else {
      setIsLoading(false);
    }
  }, [currentSite?.id]);

  async function loadUsers(siteId: string) {
    setIsLoading(true);
    const { data } = await supabase
      .from('users')
      .select('*, role:roles(*)')
      .eq('site_id', siteId)
      .eq('is_active', true)
      .order('name');

    const users = (data ?? []) as UserWithRole[];
    setAllUsers(users);

    // Never auto-restore currentUser — PIN must always be re-entered
    // Just clear any stale localStorage keys
    localStorage.removeItem(SESSION_KEY);
    localStorage.removeItem(LOCK_KEY);

    setIsLoading(false);
  }

  function selectUser(userId: string) {
    setSelectedUserId(userId);
  }

  async function login(pin: string, userId?: string): Promise<{ success: boolean; error?: string }> {
    const targetId = userId ?? selectedUserId;
    if (!targetId) return { success: false, error: 'Aucun utilisateur sélectionné' };
    const user = allUsers.find(u => u.id === targetId);
    if (!user) return { success: false, error: 'Utilisateur introuvable' };
    if (user.pin !== pin) return { success: false, error: 'Code PIN incorrect' };

    setCurrentUser(user);
    setIsLocked(false);

    await supabase.from('sessions').insert({
      user_id: user.id,
      site_id: currentSite?.id ?? null,
      is_active: true,
    });

    return { success: true };
  }

  function logout() {
    if (currentUser) {
      supabase
        .from('sessions')
        .update({ is_active: false, logged_out_at: new Date().toISOString() })
        .eq('user_id', currentUser.id)
        .eq('is_active', true)
        .eq('site_id', currentSite?.id ?? '');
    }
    setCurrentUser(null);
    setSelectedUserId(null);
    setIsLocked(false);
    // For site managers (cashiers), keep the Supabase Auth session alive
    // so they return to the PIN screen, not the main login page.
    if (!isSiteManager) {
      tenantSignOut();
    }
  }

  function lockSession() {
    setIsLocked(true);
    setCurrentUser(null);
  }

  async function fullLogout() {
    if (currentUser) {
      supabase
        .from('sessions')
        .update({ is_active: false, logged_out_at: new Date().toISOString() })
        .eq('user_id', currentUser.id)
        .eq('is_active', true)
        .eq('site_id', currentSite?.id ?? '');
    }
    setCurrentUser(null);
    setSelectedUserId(null);
    setIsLocked(false);
    localStorage.removeItem(SESSION_KEY);
    localStorage.removeItem(LOCK_KEY);
    await tenantSignOut();
  }

  async function unlockSession(pin: string): Promise<boolean> {
    if (!selectedUserId) return false;
    const user = allUsers.find(u => u.id === selectedUserId);
    if (!user || user.pin !== pin) return false;
    setCurrentUser(user);
    setIsLocked(false);
    return true;
  }

  return (
    <AuthContext.Provider value={{
      currentUser,
      isLocked,
      isLoading,
      login,
      logout,
      fullLogout,
      lockSession,
      unlockSession,
      allUsers,
      selectedUserId,
      selectUser,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}

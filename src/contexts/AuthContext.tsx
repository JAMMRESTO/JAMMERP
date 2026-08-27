import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { User, UserPermissions } from '../lib/types';
import { supabase } from '../lib/supabase';

interface AuthContextType {
  user: User | null;
  permissions: UserPermissions | null;
  login: (user: User) => void;
  logout: () => void;
  isLoading: boolean;
  hasPermission: (key: keyof UserPermissions) => boolean;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [permissions, setPermissions] = useState<UserPermissions | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const loadPermissions = async (userId: string): Promise<UserPermissions | null> => {
    const { data } = await supabase
      .from('user_permissions')
      .select('*')
      .eq('user_id', userId)
      .maybeSingle();
    return data;
  };

  useEffect(() => {
    const stored = localStorage.getItem('restobar_user');
    if (stored) {
      try {
        const u = JSON.parse(stored) as User;
        setUser(u);
        loadPermissions(u.id).then(perms => {
          setPermissions(perms);
          setIsLoading(false);
        });
      } catch {
        localStorage.removeItem('restobar_user');
        setIsLoading(false);
      }
    } else {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!user || user.role === 'ADMIN' || user.role === 'SUPERADMIN') return;

    const refresh = () => loadPermissions(user.id).then(perms => { if (perms) setPermissions(perms); });

    const channel = supabase
      .channel(`user_permissions_${user.id}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'user_permissions', filter: `user_id=eq.${user.id}` },
        (payload) => {
          if (payload.new && typeof payload.new === 'object') {
            setPermissions(payload.new as UserPermissions);
          }
        }
      )
      .subscribe();

    const interval = setInterval(refresh, 10000);
    window.addEventListener('focus', refresh);

    return () => {
      supabase.removeChannel(channel);
      clearInterval(interval);
      window.removeEventListener('focus', refresh);
    };
  }, [user]);

  const login = (u: User) => {
    setUser(u);
    localStorage.setItem('restobar_user', JSON.stringify(u));
    loadPermissions(u.id).then(perms => setPermissions(perms));
  };

  const logout = () => {
    setUser(null);
    setPermissions(null);
    localStorage.removeItem('restobar_user');
  };

  const hasPermission = (key: keyof UserPermissions): boolean => {
    if (!user) return false;
    if (user.role === 'ADMIN' || user.role === 'SUPERADMIN') return true;
    if (!permissions) return false;
    const val = permissions[key];
    return typeof val === 'boolean' ? val : false;
  };

  return (
    <AuthContext.Provider value={{ user, permissions, login, logout, isLoading, hasPermission }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}

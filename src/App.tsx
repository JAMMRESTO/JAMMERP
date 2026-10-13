import { useEffect, useRef } from 'react';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { SettingsProvider, useSettings } from './contexts/SettingsContext';
import { useSubscriptionStatus } from './hooks/useSubscriptionStatus';
import { prewarmCaches } from './lib/printService';
import LoginScreen from './components/auth/LoginScreen';
import AdminLayout from './components/admin/AdminLayout';
import ServerLayout from './components/server/ServerLayout';
import CashierLayout from './components/cashier/CashierLayout';
import ToastContainer from './components/shared/Toast';
import InstallPrompt from './components/shared/InstallPrompt';
import UpdatePrompt from './components/shared/UpdatePrompt';
import PublicMenu from './components/public/PublicMenu';

function getPublicMenuSlug(): string | null {
  const path = window.location.pathname;
  const match = path.match(/^\/menu\/([^/]+)/);
  return match ? match[1] : null;
}

function AppRouter() {
  const { user, logout, isLoading } = useAuth();
  const { settings } = useSettings();
  const { isBlocked } = useSubscriptionStatus();
  const lastBlockedRef = useRef(false);

  useEffect(() => {
    if (isBlocked && user && user.role !== 'SUPERADMIN') {
      lastBlockedRef.current = true;
      logout();
    }
    if (!isBlocked) {
      lastBlockedRef.current = false;
    }
  }, [isBlocked, user, logout]);

  const publicMenuSlug = getPublicMenuSlug();
  if (publicMenuSlug) {
    return <PublicMenu slug={publicMenuSlug} />;
  }

  if (isLoading) {
    return (
      <div className="h-screen bg-gray-900 flex items-center justify-center">
        <div className="w-10 h-10 border-4 border-amber-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const cls = settings.highPerformanceMode ? 'high-perf h-full' : 'h-full';

  if (!user) return <div className={cls}><LoginScreen blocked={isBlocked} /></div>;

  if (user.role === 'ADMIN' || user.role === 'SUPERADMIN') return <div className={cls}><AdminLayout blocked={isBlocked} /></div>;
  if (user.role === 'SERVEUR') return <div className={cls}><ServerLayout /></div>;
  if (user.role === 'CAISSIER') return <div className={cls}><CashierLayout /></div>;

  return <div className={cls}><LoginScreen blocked={isBlocked} /></div>;
}

export default function App() {
  useEffect(() => {
    void prewarmCaches();
  }, []);

  return (
    <AuthProvider>
      <SettingsProvider>
        <AppRouter />
        <ToastContainer />
        <InstallPrompt />
        <UpdatePrompt />
      </SettingsProvider>
    </AuthProvider>
  );
}
